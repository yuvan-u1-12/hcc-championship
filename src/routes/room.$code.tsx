import { createFileRoute, useParams } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState } from "react";
import { TEAMS, getTeam, getEligibleBatters, getEligibleBowlers } from "@/lib/teams";
import {
  createInitialState,
  setOpeners,
  setBowler,
  setNewBatter,
  lockInput,
  resolveBall,
  startInnings,
  startNextInnings,
  declareInnings,
  matchElapsedMs,
  formatClock,
  addThinkTime,
  OVERS_PER_INNINGS,
  totalsBySide,
  leadTrailLabel,
  finalizeResult,
  teamForSide,
  computeTarget,
  zerosUsedThisOver,
} from "@/lib/gameEngine";
import type { GameState, Side, BatStats, BowlStats } from "@/lib/gameTypes";
import { PHASE_OF_OVER } from "@/lib/gameTypes";
import { joinRoom, leaveRoom, type RoomEvent } from "@/lib/realtime";
import { loadSide, loadState, saveSide, saveState } from "@/lib/storage";
import { extractBallEvents, extractInnings, matchIdFor } from "@/lib/matchEvents";
import { recordMatchProgress } from "@/lib/matchRecord.functions";

export const Route = createFileRoute("/room/$code")({
  component: Room,
});

const MAX_CHAT_LEN = 200;
const MAX_CHAT_HISTORY = 50;

// ===== Local (per-client) ball clock =====
// Each client measures the 20s window with its OWN clock, starting when it first
// sees a new ball. This avoids clock-skew / broadcast-latency shaving seconds off.
let lbKey: string | null = null;
let lbStart: number | null = null;
let lbPausedAt: number | null = null;

function syncLocalBallClock(s: GameState | null) {
  if (!s || s.phase !== "playing" || !s.ballStartedAt) {
    lbKey = null;
    lbStart = null;
    lbPausedAt = null;
    return;
  }
  const inn = s.innings[s.currentInnings];
  const key = `${s.currentInnings}:${inn?.ballsBowled ?? 0}:${s.ballStartedAt}`;
  if (key !== lbKey) {
    lbKey = key;
    lbStart = Date.now();
    lbPausedAt = null;
  }
  if (s.paused) {
    if (lbPausedAt === null) lbPausedAt = Date.now();
  } else if (lbPausedAt !== null) {
    if (lbStart !== null) lbStart += Date.now() - lbPausedAt;
    lbPausedAt = null;
  }
}

function localBallElapsed(): number | null {
  if (lbStart === null) return null;
  const now = lbPausedAt ?? Date.now();
  return Math.max(0, now - lbStart);
}

function Room() {
  const { code } = useParams({ from: "/room/$code" });
  const [side, setSide] = useState<Side | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const sendRef = useRef<((e: RoomEvent) => void) | null>(null);
  const sideRef = useRef<Side | null>(null);
  const myClientIdRef = useRef<string>(Math.random().toString(36).slice(2) + Date.now().toString(36));
  const peerClientIdRef = useRef<string | null>(null);
  const [, force] = useState(0);

  // hydrate identity + cached state
  useEffect(() => {
    const ident = loadSide(code);
    const cached = loadState(code);
    // identity priority: explicit side key → side recorded with the cached match
    // state (survives a lost/blocked side key) → away (link join, must pick team)
    const resolvedSide: Side = ident.side ?? cached?.side ?? "away";
    const resolvedTeam =
      ident.teamId ??
      (cached ? (resolvedSide === "host" ? cached.state.hostTeamId : cached.state.awayTeamId) : null);
    setSide(resolvedSide);
    sideRef.current = resolvedSide;
    setTeamId(resolvedTeam);
    // re-persist so the role is stable across any later refresh
    saveSide(code, resolvedSide, resolvedTeam);

    if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
      setState(cached.state);
      stateRef.current = cached.state;
    } else if (resolvedSide === "host" && !cached) {
      const init = createInitialState(code);
      init.hostTeamId = resolvedTeam;
      setState(init);
      stateRef.current = init;
    } else if (cached && resolvedSide === "host") {
      // stale cache but we are still the host — keep the match, don't reset it
      setState(cached.state);
      stateRef.current = cached.state;
    }
  }, [code]);

  // realtime
  useEffect(() => {
    if (!side) return;
    let chan: any = null;
    const pendingLeave: Record<string, ReturnType<typeof setTimeout>> = {};
    const peerStillPresent = (peerSide: Side) => {
      try {
        const st = chan?.presenceState?.() ?? {};
        return Object.values(st).some((arr: any) =>
          (arr as any[]).some((p) => p?.side === peerSide && p?.clientId !== myClientIdRef.current),
        );
      } catch {
        return false;
      }
    };
    const { channel, send: rawSend } = joinRoom(
      code,
      handleEvent,
      { side: sideRef.current!, clientId: myClientIdRef.current },
      {
        onJoin: ({ side: peerSide, clientId }) => {
          if (peerSide === sideRef.current) return;
          peerClientIdRef.current = clientId;
          // a (re)join cancels any pending disconnect judgement for that side
          if (pendingLeave[peerSide]) {
            clearTimeout(pendingLeave[peerSide]);
            delete pendingLeave[peerSide];
          }
          // host: if paused due to disconnect of this side, auto-resume
          if (sideRef.current === "host") {
            const cur = stateRef.current;
            if (cur && cur.paused && cur.pausedReason === "disconnect" && cur.disconnectedSide === peerSide) {
              const elapsed = cur.pausedAt ? Date.now() - cur.pausedAt : 0;
              applyAndBroadcast({
                ...cur,
                paused: false,
                pausedAt: null,
                pausedReason: undefined,
                disconnectedSide: null,
                pausedTotalMs: (cur.pausedTotalMs ?? 0) + elapsed,
                lastActionAt: Date.now() + 5000,
                hostConnected: true,
                awayConnected: true,
              });
            } else if (cur) {
              // ensure connected flags accurate and rebroadcast state for hydration
              applyAndBroadcast({ ...cur, hostConnected: true, awayConnected: true });
            }
          }
        },
        onLeave: ({ side: peerSide }) => {
          if (peerSide === sideRef.current) return;
          if (sideRef.current !== "host") return;
          if (pendingLeave[peerSide]) return;
          // grace period: presence "leave" fires on brief socket blips / tab throttling,
          // so only treat it as a real disconnect if they are still absent after 15s
          pendingLeave[peerSide] = setTimeout(() => {
            delete pendingLeave[peerSide];
            if (peerStillPresent(peerSide)) return;
            const cur = stateRef.current;
            if (!cur) return;
            if (cur.phase === "lobby" || cur.phase === "match_over") return;
            if (cur.paused) return;
            applyAndBroadcast({
              ...cur,
              paused: true,
              pausedAt: Date.now(),
              pausedReason: "disconnect",
              disconnectedSide: peerSide,
              awayConnected: peerSide === "away" ? false : cur.awayConnected,
              hostConnected: peerSide === "host" ? false : cur.hostConnected,
            });
          }, 15000);
        },
      },
    );
    chan = channel;
    // wrap send so every outgoing event carries our clientId
    const send = (e: RoomEvent) => rawSend({ ...e, _from: myClientIdRef.current } as RoomEvent);
    sendRef.current = send;
    // announce
    setTimeout(() => {
      send({ type: "hello", side: sideRef.current!, clientId: myClientIdRef.current, teamId });
    }, 300);
    // heartbeat: re-assert our presence so transient blips don't look like a leave
    const hb = setInterval(() => {
      try {
        channel.track({ side: sideRef.current!, clientId: myClientIdRef.current });
      } catch {}
    }, 20000);
    return () => {
      clearInterval(hb);
      Object.values(pendingLeave).forEach(clearTimeout);
      leaveRoom(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, code]);


  // persist on every change
  useEffect(() => {
    if (state) saveState(code, state, sideRef.current);
    stateRef.current = state;
  }, [state, code]);

  // Host persists completed balls as ball events (read-only use of engine output).
  const syncedRef = useRef<{ ids: Set<string>; sig: string; busy: boolean; again: boolean }>({ ids: new Set(), sig: "", busy: false, again: false });
  useEffect(() => {
    if (side !== "host" || !state || !state.hostTeamId || !state.awayTeamId) return;
    const matchId = matchIdFor(state);
    if (!matchId) return;
    const run = async () => {
      const s = stateRef.current;
      if (!s) return;
      const sync = syncedRef.current;
      if (sync.busy) { sync.again = true; return; }
      const events = extractBallEvents(s).filter((e) => !sync.ids.has(e.id));
      const final = s.phase === "match_over";
      const innings = extractInnings(s);
      const sig = `${matchId}|${JSON.stringify(innings)}|${final}|${s.tossWinner ?? ""}`;
      if (!events.length && sig === sync.sig) return;
      sync.busy = true;
      try {
        await recordMatchProgress({
          data: {
            matchId, roomCode: s.roomCode, hostTeamId: s.hostTeamId!, awayTeamId: s.awayTeamId!,
            tossWinner: s.tossWinner, tossChoice: s.tossChoice, innings, events,
            final: final ? { winner: s.winner, result: s.result } : undefined,
          },
        });
        events.forEach((e) => sync.ids.add(e.id));
        sync.sig = sig;
      } catch (err) {
        console.warn("[match-record] save failed, will retry", err);
      } finally {
        sync.busy = false;
        if (sync.again) { sync.again = false; void run(); }
      }
    };
    void run();
  }, [state, side]);

  // periodic time check (host runs engine; both sides force tick for timer)
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      if (!s || s.phase === "match_over" || s.phase === "lobby") {
        force((n) => n + 1);
        return;
      }
      if (sideRef.current === "host") {
        // auto-forfeit if peer has been disconnected for > 5 min
        if (s.paused && s.pausedReason === "disconnect" && s.pausedAt && Date.now() - s.pausedAt > 5 * 60 * 1000) {
          const winnerSide: Side = s.disconnectedSide === "host" ? "away" : "host";
          const winnerName = teamForSide(s, winnerSide)?.name ?? winnerSide;
          applyAndBroadcast({
            ...s,
            phase: "match_over",
            paused: false,
            pausedReason: undefined,
            result: `${winnerName} wins — opponent did not return within 5 minutes`,
            winner: winnerSide,
          });
          return;
        }
        // auto-pause when idle > 60s during active play
        if (
          !s.paused &&
          (s.phase === "playing" || s.phase === "select_bowler" || s.phase === "select_new_batter") &&
          Date.now() - s.lastActionAt > 60_000
        ) {
          applyAndBroadcast({ ...s, paused: true, pausedAt: Date.now(), pausedReason: "idle" });
          return;
        }
      }
      force((n) => n + 1); // refresh timer display on both sides
    }, 1000);
    return () => clearInterval(id);
  }, [side]);

  function broadcastState(s: GameState) {
    sendRef.current?.({ type: "state", state: s });
  }

  function applyAndBroadcast(s: GameState) {
    const next = { ...s, version: s.version + 1 };
    setState(next);
    stateRef.current = next;
    broadcastState(next);
  }

  function handleEvent(e: RoomEvent) {
    const mySide = sideRef.current!;
    const cur = stateRef.current;
    const senderId = (e as any)._from as string | undefined;

    if (e.type === "state") {
      // Only accept authoritative state from the known peer (host).
      // Away tracks the host as its peer; reject state from unknown clients.
      if (mySide === "host") return; // host never accepts state from anyone
      if (!senderId) return;
      if (peerClientIdRef.current && senderId !== peerClientIdRef.current) return;
      // first state we ever see locks in the peer (host) clientId
      if (!peerClientIdRef.current) peerClientIdRef.current = senderId;
      const incoming = e.state as GameState;
      if (!cur || incoming.version >= cur.version) {
        setState(incoming);
        stateRef.current = incoming;
      }
      return;
    }
    if (e.type === "hello") {
      // remember the peer's clientId from the handshake
      if (e.side !== mySide && senderId) {
        peerClientIdRef.current = senderId;
      }
      if (mySide === "host" && e.side === "away") {
        let s = cur ?? createInitialState(code);
        s = { ...s, awayTeamId: e.teamId ?? s.awayTeamId, awayConnected: true, hostConnected: true };
        if (s.hostTeamId && s.awayTeamId && s.phase === "lobby") {
          s = { ...s, phase: "toss" };
        }
        // auto-resume if paused due to away disconnect
        if (s.paused && s.pausedReason === "disconnect" && s.disconnectedSide === "away") {
          const elapsed = s.pausedAt ? Date.now() - s.pausedAt : 0;
          s = {
            ...s,
            paused: false,
            pausedAt: null,
            pausedReason: undefined,
            disconnectedSide: null,
            pausedTotalMs: (s.pausedTotalMs ?? 0) + elapsed,
            lastActionAt: Date.now() + 5000,
          };
        }
        applyAndBroadcast(s);
      }
      return;
    }
    // only host applies engine transitions
    if (mySide !== "host" || !cur) return;
    // For sender-attributed events, derive the side from the sender's clientId.
    // The host is the only client that authors state, so any event from a
    // non-host sender must be attributed to "away" regardless of the payload.
    const senderSide: Side | null = senderId
      ? senderId === myClientIdRef.current
        ? "host"
        : peerClientIdRef.current && senderId === peerClientIdRef.current
          ? "away"
          : null
      : null;
    switch (e.type) {
      case "toss_call": {
        const result: "heads" | "tails" = Math.random() < 0.5 ? "heads" : "tails";
        const winner: Side = e.call === result ? "away" : "host";
        applyAndBroadcast({
          ...cur,
          tossCall: e.call,
          tossResult: result,
          tossWinner: winner,
        });
        return;
      }
      case "toss_choice": {
        const battingSide: Side =
          e.choice === "bat" ? cur.tossWinner! : cur.tossWinner === "host" ? "away" : "host";
        const s1 = startInnings({ ...cur, tossChoice: e.choice }, 1, battingSide);
        applyAndBroadcast(s1);
        return;
      }
      case "select": {
        if (e.kind === "openers") {
          applyAndBroadcast(setOpeners(cur, e.payload.striker, e.payload.nonStriker));
        } else if (e.kind === "bowler") {
          applyAndBroadcast(setBowler(cur, e.payload.bowler));
        } else if (e.kind === "batter") {
          applyAndBroadcast(setNewBatter(cur, e.payload.batter));
        }
        return;
      }
      case "input": {
        // derive side from sender, not from payload (prevents spoofing)
        const actualSide: Side | null =
          senderSide ?? (e.side === "host" || e.side === "away" ? e.side : null);
        if (!actualSide) return;
        if (senderSide && senderSide !== e.side) return; // spoof attempt — drop
        // accumulate this side's active thinking time for the ball
        let working = cur;
        const reported = typeof (e as any).elapsedMs === "number" && isFinite((e as any).elapsedMs)
          ? Math.max(0, Math.min(10 * 60_000, (e as any).elapsedMs as number))
          : null;
        if (working.phase === "playing" && working.ballStartedAt && !working.paused) {
          const alreadyLocked = actualSide === "host" ? working.hostLocked : working.awayLocked;
          const elapsed = reported ?? Date.now() - working.ballStartedAt;
          const innC = working.innings[working.currentInnings];
          const isBatting = innC && actualSide === innC.battingSide;
          const player = innC ? (isBatting ? innC.striker : innC.bowler) ?? "?" : "?";
          if (!alreadyLocked) {
            // individual stopwatch: only counts the time this side actually took to move
            working = addThinkTime(working, actualSide, player !== "?" ? player : null, elapsed);
          }
        }
        let s = lockInput(working, actualSide, e.value);
        if (s.hostLocked && s.awayLocked) {
          s = resolveBall(s);
        }
        applyAndBroadcast(s);
        return;
      }
      case "follow_on": {
        const teamBSide = cur.innings[2]!.battingSide;
        applyAndBroadcast(startInnings({ ...cur, followOnOffered: true }, 3, teamBSide));
        return;
      }
      case "next_innings_choice": {
        applyAndBroadcast(startNextInnings(cur, e.battingSide));
        return;
      }
      case "declare": {
        applyAndBroadcast(declareInnings(cur));
        return;
      }
      case "chat": {
        // derive sender side from clientId; cap message length and history
        const fromSide: Side | null =
          senderSide ?? (e.side === "host" || e.side === "away" ? e.side : null);
        if (!fromSide) return;
        if (senderSide && senderSide !== e.side) return;
        const text = typeof e.text === "string" ? e.text.slice(0, MAX_CHAT_LEN).trim() : "";
        if (!text) return;
        const nextChat = [...cur.chat, { side: fromSide, text, t: Date.now() }];
        if (nextChat.length > MAX_CHAT_HISTORY) nextChat.splice(0, nextChat.length - MAX_CHAT_HISTORY);
        applyAndBroadcast({ ...cur, chat: nextChat });
        return;
      }
      case "pause": {
        if (cur.paused) return;
        applyAndBroadcast({ ...cur, paused: true, pausedAt: Date.now(), pausedReason: "manual" });
        return;
      }
      case "resume": {
        if (!cur.paused) return;
        // cannot manually resume a disconnect pause — must wait for reconnect
        if (cur.pausedReason === "disconnect") return;
        const elapsed = cur.pausedAt ? Date.now() - cur.pausedAt : 0;
        applyAndBroadcast({
          ...cur,
          paused: false,
          pausedAt: null,
          pausedReason: undefined,
          pausedTotalMs: (cur.pausedTotalMs ?? 0) + elapsed,
          ballStartedAt: cur.ballStartedAt ? cur.ballStartedAt + elapsed : cur.ballStartedAt,
          lastActionAt: Date.now() + 5000, // 5s grace so idle check doesn't immediately re-pause
        });
        return;
      }
    }
  }

  // ===== UI =====
  if (!side) return <Loading text="Loading..." />;
  if (!state) {
    // away waiting for host
    return (
      <Loading text={`Joining room ${code}…`} sub="Waiting for host to send game state." />
    );
  }

  return (
    <RoomUI
      code={code}
      mySide={side}
      myTeamId={teamId}
      state={state}
      send={(e) => {
        if (sideRef.current === "host") {
          handleEvent({ ...e, _from: myClientIdRef.current } as RoomEvent);
          return;
        }
        sendRef.current?.(e);
      }}
      onTeamPick={(id) => {
        setTeamId(id);
        saveSide(code, side, id);
        if (side === "host") {
          const ns = { ...state, hostTeamId: id };
          applyAndBroadcast(ns);
        } else {
          sendRef.current?.({ type: "hello", side: "away", clientId: "x", teamId: id });
        }
      }}
    />
  );
}

function Loading({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
      <div className="text-xl font-bold">{text}</div>
      {sub && <div className="text-sm text-white/60 mt-2">{sub}</div>}
    </div>
  );
}

// =============== Main Room UI ===============
function RoomUI({
  code,
  mySide,
  myTeamId,
  state,
  send,
  onTeamPick,
}: {
  code: string;
  mySide: Side;
  myTeamId: string | null;
  state: GameState;
  send: (e: RoomEvent) => void;
  onTeamPick: (id: string) => void;
}) {
  const hostTeam = state.hostTeamId ? getTeam(state.hostTeamId) : null;
  const awayTeam = state.awayTeamId ? getTeam(state.awayTeamId) : null;
  const inn = state.currentInnings > 0 ? state.innings[state.currentInnings] : null;
  syncLocalBallClock(state);

  // ---- Lobby waiting ----
  if (state.phase === "lobby") {
    if (mySide === "away" && !state.awayTeamId) {
      return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-white p-6">
          <h2 className="text-xl font-bold mb-3">Pick your team to join {code}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {TEAMS.map((t) => (
              <button
                key={t.id}
                onClick={() => onTeamPick(t.id)}
                className="rounded-xl p-4 border-2 border-white/10 hover:border-emerald-400"
                style={{ background: `linear-gradient(135deg, ${t.color}, ${t.accent})` }}
              >
                <div className="font-black text-xl">{t.id}</div>
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
        <div className="text-sm text-white/60">Room Code</div>
        <div className="text-5xl font-black tracking-widest my-2">{code}</div>
        <div className="text-sm text-white/60 mt-4">Share this link:</div>
        <code className="text-emerald-400 text-xs mt-1">
          {typeof window !== "undefined" ? window.location.href : ""}
        </code>
        <div className="mt-8">
          <div className="text-white/80">
            Host: {hostTeam?.name ?? "—"} • Away: {awayTeam?.name ?? "(waiting…)"}
          </div>
        </div>
      </div>
    );
  }

  // ---- Toss ----
  if (state.phase === "toss") {
    return <TossView state={state} mySide={mySide} send={send} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      <TopBar state={state} mySide={mySide} code={code} send={send} />
      {state.paused && <PauseOverlay state={state} mySide={mySide} send={send} />}
      <main className="flex-1 overflow-y-auto">
        {state.phase === "match_over" ? (
          <Scorecard state={state} code={code} isHost={mySide === "host"} />
        ) : state.phase === "innings_break" ? (
          <InningsBreak state={state} mySide={mySide} send={send} />
        ) : state.phase === "follow_on_decision" ? (
          <FollowOnDecision state={state} mySide={mySide} send={send} />
        ) : (
          <GameBoard state={state} mySide={mySide} send={send} />
        )}
      </main>
      <ChatBox state={state} mySide={mySide} send={send} />
    </div>
  );
}

// ============ Top Bar ============
function TopBar({ state, mySide, code, send }: { state: GameState; mySide: Side; code: string; send: (e: RoomEvent) => void }) {
  const hostTeam = getTeam(state.hostTeamId!);
  const awayTeam = getTeam(state.awayTeamId!);
  const inn = state.currentInnings > 0 ? state.innings[state.currentInnings] : null;
  const t = totalsBySide(state);
  const myLockedNow = mySide === "host" ? state.hostLocked : state.awayLocked;
  const liveBall =
    state.phase === "playing" && !state.paused && !myLockedNow ? localBallElapsed() ?? 0 : 0;
  const myThink = (state.thinkMs?.[mySide] ?? 0) + liveBall;
  const phase = inn ? PHASE_OF_OVER(inn.overNumber) : "—";
  const isIdle = Date.now() - state.lastActionAt > 60000;
  const canPause = state.phase !== "lobby" && state.phase !== "toss" && state.phase !== "match_over";

  return (
    <header className="border-b border-white/10 px-4 py-2 flex flex-wrap items-center gap-3 text-sm bg-black/30">
      <div className="font-bold">
        🏏 {hostTeam?.name} vs {awayTeam?.name}
      </div>
      <div className="text-white/60">Room {code}</div>
      <div className="ml-auto flex items-center gap-3">
        <span className="px-2 py-0.5 rounded bg-white/10">You: {mySide === "host" ? hostTeam?.name : awayTeam?.name}</span>
        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
          Innings {state.currentInnings || "—"} · {phase}
        </span>
        {inn && (
          <span className="font-mono px-2 py-0.5 rounded bg-white/10" title="Overs bowled in this innings">
            {inn.overNumber}.{inn.ballInOver} / {OVERS_PER_INNINGS} ov
          </span>
        )}
        {state.paused && <span className="text-amber-300">⏸ paused</span>}
        <span className="font-mono text-white/70" title="Your total playing time (waiting time excluded)">
          🧠 {formatClock(myThink)}
        </span>
        {canPause && !state.paused && (
          <button onClick={() => send({ type: "pause" })} className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/40">
            ⏸ Pause
          </button>
        )}
        {isIdle && <span className="text-amber-400 text-xs">⏸ idle</span>}
        <span className="text-white/70">
          {hostTeam?.id} {t.host} / {awayTeam?.id} {t.away}
        </span>
        {state.currentInnings === 4 && inn && (() => {
          const tgt = computeTarget(state);
          if (tgt === null) return null;
          const need = tgt - inn.runs;
          return (
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200">
              Target {tgt} · Need {need} run{need === 1 ? "" : "s"}
            </span>
          );
        })()}
      </div>
    </header>
  );
}

// ============ Toss ============
function TossView({
  state,
  mySide,
  send,
}: {
  state: GameState;
  mySide: Side;
  send: (e: RoomEvent) => void;
}) {
  const [flipping, setFlipping] = useState(false);
  const hostTeam = getTeam(state.hostTeamId!);
  const awayTeam = getTeam(state.awayTeamId!);

  // Coin flip animation timing
  useEffect(() => {
    if (state.tossResult && !flipping) setFlipping(true);
  }, [state.tossResult, flipping]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-950 to-slate-950 text-white p-6">
      <h2 className="text-2xl font-bold mb-2">The Toss</h2>
      <p className="text-white/60 mb-8">
        {awayTeam?.name} (Away) calls, {hostTeam?.name} (Home) flips.
      </p>

      <div
        className={`w-32 h-32 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 shadow-2xl flex items-center justify-center text-3xl font-black text-yellow-900 ${
          flipping ? "animate-spin" : ""
        }`}
        style={{ animationDuration: flipping ? "0.6s" : undefined }}
      >
        {state.tossResult ? (state.tossResult === "heads" ? "H" : "T") : "?"}
      </div>

      <div className="mt-8 w-full max-w-md">
        {!state.tossCall && mySide === "away" && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => send({ type: "toss_call", call: "heads" })} className="py-4 rounded-xl bg-yellow-500 text-yellow-950 font-bold">
              Call HEADS
            </button>
            <button onClick={() => send({ type: "toss_call", call: "tails" })} className="py-4 rounded-xl bg-yellow-700 text-yellow-100 font-bold">
              Call TAILS
            </button>
          </div>
        )}
        {!state.tossCall && mySide === "host" && (
          <div className="text-center text-white/70">Waiting for {awayTeam?.name} to call…</div>
        )}
        {state.tossCall && state.tossResult && state.tossWinner && !state.tossChoice && (
          <div className="text-center">
            <div className="mb-3 text-white/80">
              Call: <b>{state.tossCall.toUpperCase()}</b> · Result: <b>{state.tossResult.toUpperCase()}</b>
            </div>
            <div className="text-emerald-400 font-bold mb-4">
              {state.tossWinner === "host" ? hostTeam?.name : awayTeam?.name} won the toss!
            </div>
            {mySide === state.tossWinner ? (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => send({ type: "toss_choice", choice: "bat" })} className="py-4 rounded-xl bg-emerald-500 text-emerald-950 font-bold">
                  BAT FIRST
                </button>
                <button onClick={() => send({ type: "toss_choice", choice: "bowl" })} className="py-4 rounded-xl bg-indigo-500 font-bold">
                  BOWL FIRST
                </button>
              </div>
            ) : (
              <div className="text-white/70">Waiting for opponent to choose bat/bowl…</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Game Board ============
function GameBoard({
  state,
  mySide,
  send,
}: {
  state: GameState;
  mySide: Side;
  send: (e: RoomEvent) => void;
}) {
  const inn = state.innings[state.currentInnings]!;
  const battingSide = inn.battingSide;
  const bowlingSide: Side = battingSide === "host" ? "away" : "host";
  const iAmBatting = mySide === battingSide;
  const myLocked = mySide === "host" ? state.hostLocked : state.awayLocked;
  const phase = PHASE_OF_OVER(inn.overNumber);

  // --- Selection phases ---
  if (state.phase === "innings_setup" && state.pendingSelect?.type === "openers") {
    if (mySide === state.pendingSelect.forSide) {
      return <OpenersSelect state={state} mySide={mySide} send={send} />;
    }
    return <BlockingOverlay text={`Waiting for ${teamForSide(state, state.pendingSelect.forSide)!.name} to choose openers…`} />;
  }
  if (state.phase === "select_bowler" && state.pendingSelect) {
    if (mySide === state.pendingSelect.forSide) {
      return <BowlerSelect state={state} mySide={mySide} send={send} />;
    }
    return <BlockingOverlay text={`Waiting for ${teamForSide(state, state.pendingSelect.forSide)!.name} to choose next bowler…`} />;
  }
  if (state.phase === "select_new_batter" && state.pendingSelect) {
    if (mySide === state.pendingSelect.forSide) {
      return <NewBatterSelect state={state} mySide={mySide} send={send} />;
    }
    return <BlockingOverlay text={`Waiting for ${teamForSide(state, state.pendingSelect.forSide)!.name} to choose next batter…`} />;
  }

  // --- Playing ---
  return (
    <div className="p-4 max-w-3xl mx-auto">
      <LiveScore state={state} />
      <BallStrip inn={inn} />
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <PlayerCard
          title="Striker 🏏"
          name={inn.striker}
          stats={inn.striker ? inn.batStats[inn.striker] : undefined}
          type="bat"
        />
        <PlayerCard
          title={inn.isLMS ? "Last Man Standing 🛡️" : "Non-Striker"}
          name={inn.isLMS ? "— (solo, no rotation)" : inn.nonStriker}
          stats={!inn.isLMS && inn.nonStriker ? inn.batStats[inn.nonStriker] : undefined}
          type="bat"
        />
        <PlayerCard
          title="Bowler 🎯"
          name={inn.bowler}
          stats={inn.bowler ? inn.bowlStats[inn.bowler] : undefined}
          type="bowl"
        />
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
          <div className="font-bold mb-2">Phase: {phase}</div>
          <div className="text-white/70">
            {phase === "NORMAL"
              ? "Match → OUT. Different → bat scores runs."
              : "Match → runs squared (square!). ±1 → OUT. '0' is invincible."}
          </div>
          {leadTrailLabel(state) && (
            <div className="mt-2 text-emerald-400 font-semibold">{leadTrailLabel(state)}</div>
          )}
          {state.lastBall && (
            <div className="mt-2 text-xs text-white/60">
              Last: bat {state.lastBall.bat} vs bowl {state.lastBall.bowl} →{" "}
              {state.lastBall.isWicket ? "WICKET" : `${state.lastBall.runs} runs`}
              {state.lastBall.isWicket && state.lastBall.runs === 0 && <DuckAnim />}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="text-center text-white/70 text-sm mb-2">
          {iAmBatting ? "You're BATTING" : "You're BOWLING"} ·{" "}
          {myLocked
            ? "🔒 Locked — waiting for opponent…"
            : "Pick your number"}
        </div>
        <Numpad
          disabled={myLocked || state.phase !== "playing"}
          onPick={(n) =>
            send({ type: "input", side: mySide, value: n, elapsedMs: localBallElapsed() ?? 0 } as any)
          }
          batterMode={iAmBatting}
          batterZerosUsed={iAmBatting ? zerosUsedThisOver(inn) : 0}
        />
        {iAmBatting && (
          <button
            onClick={() => {
              if (confirm("Declare this innings now?")) send({ type: "declare" });
            }}
            className="mt-4 w-full py-3 rounded-lg bg-amber-500 text-amber-950 font-bold"
          >
            DECLARE INNINGS{inn.isLMS ? " (LMS)" : ""}
          </button>
        )}
      </div>
    </div>
  );
}

function LiveScore({ state }: { state: GameState }) {
  const inn = state.innings[state.currentInnings]!;
  const team = teamForSide(state, inn.battingSide)!;
  return (
    <div className="rounded-2xl bg-gradient-to-r from-emerald-900 to-slate-900 p-4 border border-white/10">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs text-white/60">Batting</div>
          <div className="text-xl font-bold">{team.name}</div>
        </div>
        <div className="text-4xl font-black">
          {inn.runs} / {inn.wickets}
        </div>
      </div>
      {state.currentInnings === 4 && (() => {
        const t = totalsBySide(state);
        const defending = inn.battingSide === "host" ? t.away : t.host;
        const need = defending + 1 - inn.runs;
        if (need > 0)
          return <div className="text-sm text-amber-300 mt-1">Need {need} to win</div>;
        return null;
      })()}
    </div>
  );
}

function BallStrip({ inn }: { inn: any }) {
  const overBalls = inn.balls.filter((b: any) => b.over === inn.overNumber + 1);
  return (
    <div className="flex gap-2 mt-3 flex-wrap">
      {overBalls.map((b: any, i: number) => (
        <div
          key={i}
          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
            b.isWicket ? "bg-red-600" : b.isSquare ? "bg-purple-600" : "bg-emerald-700"
          }`}
        >
          {b.isWicket ? "W" : b.runs}
        </div>
      ))}
      {Array.from({ length: 6 - overBalls.length }).map((_, i) => (
        <div key={i} className="w-9 h-9 rounded-full border border-white/20" />
      ))}
    </div>
  );
}

function PlayerCard({
  title,
  name,
  stats,
  type,
}: {
  title: string;
  name: string | null | undefined;
  stats?: BatStats | BowlStats;
  type: "bat" | "bowl";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-white/50">{title}</div>
      <div className="font-bold">{name ?? "—"}</div>
      {stats && type === "bat" && (
        <div className="text-xs text-white/70 mt-1">
          {(stats as BatStats).runs} ({(stats as BatStats).balls})
          {(stats as BatStats).dots ? ` · ${(stats as BatStats).dots} dots` : ""}
        </div>
      )}
      {stats && type === "bowl" && (
        <div className="text-xs text-white/70 mt-1">
          {Math.floor((stats as BowlStats).ballsBowled / 6)}.{(stats as BowlStats).ballsBowled % 6}o ·{" "}
          {(stats as BowlStats).runsConceded}r · {(stats as BowlStats).wickets}w
        </div>
      )}
    </div>
  );
}

function Numpad({
  disabled,
  onPick,
  batterMode,
  batterZerosUsed,
}: {
  disabled: boolean;
  onPick: (n: number) => void;
  batterMode: boolean;
  batterZerosUsed: number;
}) {
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 10];
  return (
    <div className="grid grid-cols-4 gap-2">
      {keys.map((n) => {
        const isZero = n === 0;
        const zeroDisabledForBatter = batterMode && isZero && batterZerosUsed >= 3;
        const zeroDisabledForBowler = !batterMode && isZero;
        const off = disabled || zeroDisabledForBatter || zeroDisabledForBowler;
        return (
          <button
            key={n}
            onClick={() => onPick(n)}
            disabled={off}
            className={`aspect-square rounded-xl text-2xl font-black border-2 transition-all ${
              off
                ? "bg-white/5 border-white/10 text-white/30"
                : "bg-emerald-600 border-emerald-300 hover:bg-emerald-500 active:scale-95"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function BlockingOverlay({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center max-w-md">
        <div className="animate-pulse text-4xl mb-3">⏳</div>
        <div className="font-bold text-lg">{text}</div>
        <div className="text-sm text-white/50 mt-2">Your numpad is disabled.</div>
      </div>
    </div>
  );
}

function DuckAnim() {
  return <span className="inline-block animate-bounce ml-2">🦆</span>;
}

// ============ Selection screens ============
function OpenersSelect({
  state,
  mySide,
  send,
}: {
  state: GameState;
  mySide: Side;
  send: (e: RoomEvent) => void;
}) {
  const inn = state.innings[state.currentInnings]!;
  const team = teamForSide(state, inn.battingSide)!;
  const eligible = getEligibleBatters(team);
  const [striker, setStriker] = useState<string>("");
  const [nonStriker, setNonStriker] = useState<string>("");
  const ready = striker && nonStriker && striker !== nonStriker;
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-1">Choose Openers — {team.name}</h2>
      <p className="text-sm text-white/60 mb-4">Only the top 5 squad members can bat.</p>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-sm font-bold mb-2">Striker</div>
          {eligible.map((p) => (
            <button
              key={p.name}
              onClick={() => setStriker(p.name)}
              className={`w-full text-left px-3 py-2 rounded-lg mb-1 border ${
                striker === p.name ? "border-emerald-400 bg-emerald-500/20" : "border-white/10 hover:border-white/30"
              }`}
            >
              {p.name} <span className="text-xs text-white/50">({p.role})</span>
            </button>
          ))}
        </div>
        <div>
          <div className="text-sm font-bold mb-2">Non-Striker</div>
          {eligible.map((p) => (
            <button
              key={p.name}
              onClick={() => setNonStriker(p.name)}
              disabled={p.name === striker}
              className={`w-full text-left px-3 py-2 rounded-lg mb-1 border disabled:opacity-30 ${
                nonStriker === p.name ? "border-emerald-400 bg-emerald-500/20" : "border-white/10 hover:border-white/30"
              }`}
            >
              {p.name} <span className="text-xs text-white/50">({p.role})</span>
            </button>
          ))}
        </div>
      </div>
      <button
        disabled={!ready}
        onClick={() => send({ type: "select", kind: "openers", payload: { striker, nonStriker }, from: mySide })}
        className="mt-6 w-full py-3 rounded-xl bg-emerald-500 text-emerald-950 font-bold disabled:opacity-30"
      >
        Confirm Openers
      </button>
    </div>
  );
}

function BowlerSelect({
  state,
  mySide,
  send,
}: {
  state: GameState;
  mySide: Side;
  send: (e: RoomEvent) => void;
}) {
  const inn = state.innings[state.currentInnings]!;
  const bowlingSide: Side = inn.battingSide === "host" ? "away" : "host";
  const team = teamForSide(state, bowlingSide)!;
  const eligible = getEligibleBowlers(team);
  const [pick, setPick] = useState("");
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-1">Choose Next Bowler — {team.name}</h2>
      <p className="text-sm text-white/60 mb-4">
        Cannot pick previous bowler{inn.prevBowler ? ` (${inn.prevBowler})` : ""}.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {eligible.map((p) => {
          const same = p.name === inn.prevBowler;
          return (
            <button
              key={p.name}
              disabled={same}
              onClick={() => setPick(p.name)}
              className={`px-3 py-2 rounded-lg text-left border disabled:opacity-30 ${
                pick === p.name ? "border-indigo-400 bg-indigo-500/20" : "border-white/10 hover:border-white/30"
              }`}
            >
              {p.name} <span className="text-xs text-white/50">({p.role})</span>
            </button>
          );
        })}
      </div>
      <button
        disabled={!pick}
        onClick={() => send({ type: "select", kind: "bowler", payload: { bowler: pick }, from: mySide })}
        className="mt-6 w-full py-3 rounded-xl bg-indigo-500 font-bold disabled:opacity-30"
      >
        Confirm Bowler
      </button>
    </div>
  );
}

function NewBatterSelect({
  state,
  mySide,
  send,
}: {
  state: GameState;
  mySide: Side;
  send: (e: RoomEvent) => void;
}) {
  const inn = state.innings[state.currentInnings]!;
  const team = teamForSide(state, inn.battingSide)!;
  const remaining = getEligibleBatters(team).filter((p) => inn.yetToBat.includes(p.name));
  const [pick, setPick] = useState("");
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-1">Next Batter — {team.name}</h2>
      <p className="text-sm text-white/60 mb-4">
        Wicket {inn.wickets} down. {inn.wickets === 4 ? "LMS begins!" : ""}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {remaining.map((p) => (
          <button
            key={p.name}
            onClick={() => setPick(p.name)}
            className={`px-3 py-2 rounded-lg text-left border ${
              pick === p.name ? "border-emerald-400 bg-emerald-500/20" : "border-white/10 hover:border-white/30"
            }`}
          >
            {p.name} <span className="text-xs text-white/50">({p.role})</span>
          </button>
        ))}
      </div>
      <button
        disabled={!pick}
        onClick={() => send({ type: "select", kind: "batter", payload: { batter: pick }, from: mySide })}
        className="mt-6 w-full py-3 rounded-xl bg-emerald-500 text-emerald-950 font-bold disabled:opacity-30"
      >
        Send In
      </button>
    </div>
  );
}

// ============ Innings break / follow-on ============
function InningsBreak({
  state,
  mySide,
  send,
}: {
  state: GameState;
  mySide: Side;
  send: (e: RoomEvent) => void;
}) {
  // Decide next batting side automatically
  const nextInnings = (state.currentInnings + 1) as 2 | 3 | 4;
  let nextSide: Side;
  if (nextInnings === 2) {
    nextSide = state.innings[1]!.battingSide === "host" ? "away" : "host";
  } else if (nextInnings === 3) {
    // back to team A (first innings batting side), unless follow-on
    nextSide = state.firstInningsBattingSide ?? (state.innings[1]!.battingSide);
  } else {
    // 4th innings: opposite of whoever batted in the 3rd innings
    const inn3Side = state.innings[3]!.battingSide;
    nextSide = inn3Side === "host" ? "away" : "host";
  }
  return (
    <div className="p-8 max-w-2xl mx-auto text-center">
      <h2 className="text-2xl font-bold mb-3">End of Innings {state.currentInnings}</h2>
      <div className="text-white/70 mb-4">
        Totals: {getTeam(state.hostTeamId!)?.name} {totalsBySide(state).host} ·{" "}
        {getTeam(state.awayTeamId!)?.name} {totalsBySide(state).away}
      </div>
      {state.lastBall && (
        <div className="mb-4 mx-auto max-w-md rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
          <div className="text-white/60 mb-1">Last ball of innings</div>
          <div className="font-semibold">
            {state.lastBall.striker} — bat <b>{state.lastBall.bat}</b> vs bowl{" "}
            <b>{state.lastBall.bowl}</b> ({state.lastBall.phase}) →{" "}
            {state.lastBall.isWicket ? (
              <span className="text-rose-400">WICKET</span>
            ) : (
              <span className="text-emerald-400">{state.lastBall.runs} runs</span>
            )}
          </div>
          {state.lastBall.isWicket && (
            <div className="text-xs text-white/60 mt-1">
              Bowler: {state.lastBall.bowler}
            </div>
          )}
        </div>
      )}
      <div className="mb-6">
        Innings {nextInnings} → <b>{teamForSide(state, nextSide)!.name}</b> bats next.
      </div>

      {mySide === "host" ? (
        <button
          onClick={() => send({ type: "next_innings_choice", battingSide: nextSide })}
          className="px-6 py-3 rounded-xl bg-emerald-500 text-emerald-950 font-bold"
        >
          Start Innings {nextInnings}
        </button>
      ) : (
        <div className="text-white/60">Waiting for host to start next innings…</div>
      )}
    </div>
  );
}

function FollowOnDecision({
  state,
  mySide,
  send,
}: {
  state: GameState;
  mySide: Side;
  send: (e: RoomEvent) => void;
}) {
  const teamASide = state.innings[1]!.battingSide;
  const teamA = teamForSide(state, teamASide)!;
  const teamB = teamForSide(state, teamASide === "host" ? "away" : "host")!;
  const t = totalsBySide(state);
  const deficit = (teamASide === "host" ? t.host : t.away) - (teamASide === "host" ? t.away : t.host);
  return (
    <div className="p-8 max-w-2xl mx-auto text-center">
      <h2 className="text-2xl font-bold mb-2">Follow-On Available</h2>
      <p className="text-white/70 mb-6">
        {teamA.name} leads by {deficit} runs. They may enforce the follow-on on {teamB.name}.
      </p>
      {mySide === teamASide ? (
        <div className="flex justify-center gap-3">
          <button
            onClick={() => send({ type: "follow_on", enforce: true })}
            className="px-6 py-3 rounded-xl bg-amber-500 text-amber-950 font-bold"
          >
            ENFORCE Follow-On
          </button>
          <button
            onClick={() => send({ type: "next_innings_choice", battingSide: teamASide })}
            className="px-6 py-3 rounded-xl bg-emerald-500 text-emerald-950 font-bold"
          >
            Bat Again
          </button>
        </div>
      ) : (
        <div className="text-white/60">Waiting for {teamA.name} to decide…</div>
      )}
    </div>
  );
}

// ============ Scorecard ============
function Scorecard({ state, code: _code, isHost: _isHost }: { state: GameState; code: string; isHost: boolean }) {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-700 to-indigo-800 p-6 mb-6 text-center">
        <div className="text-sm opacity-80">Result</div>
        <div className="text-3xl font-black">{state.result ?? finalizeResult(state)}</div>
      </div>

      {state.lastBall && (
        <div className="mb-6 mx-auto max-w-md rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-center">
          <div className="text-white/60 mb-1">Final ball of the match</div>
          <div className="font-semibold">
            {state.lastBall.striker} — bat <b>{state.lastBall.bat}</b> vs bowl{" "}
            <b>{state.lastBall.bowl}</b> ({state.lastBall.phase}) →{" "}
            {state.lastBall.isWicket ? (
              <span className="text-rose-400">WICKET</span>
            ) : (
              <span className="text-emerald-400">{state.lastBall.runs} runs</span>
            )}
          </div>
          {state.lastBall.isWicket && (
            <div className="text-xs text-white/60 mt-1">Bowler: {state.lastBall.bowler}</div>
          )}
        </div>
      )}


      {[1, 2, 3, 4].map((i) => {
        const inn = state.innings[i];
        if (!inn) return null;
        const team = teamForSide(state, inn.battingSide)!;
        return (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-6">
            <h3 className="font-bold mb-3">
              Innings {i} — {team.name} {inn.runs}/{inn.wickets}
              {inn.declared ? " (decl.)" : ""}
            </h3>
            <BattingTable inn={inn} />
            <h4 className="font-bold mt-4 mb-2">Bowling</h4>
            <BowlingTable inn={inn} />
          </div>
        );
      })}
      <TimersPanel state={state} />
    </div>
  );
}

function TimersPanel({ state }: { state: GameState }) {
  const hostName = teamForSide(state, "host")?.name ?? "Host";
  const awayName = teamForSide(state, "away")?.name ?? "Away";
  const hostMs = state.thinkMs?.host ?? 0;
  const awayMs = state.thinkMs?.away ?? 0;
  const players = Object.entries(state.playerThinkMs ?? {}).filter(([, ms]) => ms > 0);
  players.sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-6">
      <h3 className="font-bold mb-3">⏱ Match Time</h3>
      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-xs text-white/60">Total match stopwatch</div>
          <div className="font-mono text-xl">{formatClock(matchElapsedMs(state))}</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-xs text-white/60">{hostName} playing time</div>
          <div className="font-mono text-xl">{formatClock(hostMs)}</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-xs text-white/60">{awayName} playing time</div>
          <div className="font-mono text-xl">{formatClock(awayMs)}</div>
        </div>
      </div>
      {players.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-white/60">
            <tr>
              <th className="text-left py-1">Player</th>
              <th className="text-right py-1">Time on the move</th>
            </tr>
          </thead>
          <tbody>
            {players.map(([name, ms]) => (
              <tr key={name} className="border-t border-white/5">
                <td className="py-1">{name}</td>
                <td className="py-1 text-right font-mono">{formatClock(ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="text-xs text-white/50 mt-2">
        Individual timers count only the time a player took to play their moves — waiting and paused time is excluded.
      </div>
    </div>
  );
}

function BattingTable({ inn }: { inn: any }) {
  // separate normal vs crazy phase stats by replaying balls
  const perPlayer: Record<string, { normal: any; crazy: any }> = {};
  const ensure = (name: string) => {
    if (!perPlayer[name])
      perPlayer[name] = {
        normal: { r: 0, b: 0, d: 0, sq: {} as any },
        crazy: { r: 0, b: 0, d: 0, sq: {} as any },
      };
    return perPlayer[name];
  };
  for (const ball of inn.balls) {
    const p = ensure(ball.striker);
    const bucket = ball.phase === "NORMAL" ? p.normal : p.crazy;
    bucket.b += 1;
    if (!ball.isWicket) {
      bucket.r += ball.runs;
      if (ball.runs === 0) bucket.d += 1;
      if (ball.isSquare) bucket.sq[ball.runs] = (bucket.sq[ball.runs] ?? 0) + 1;
    }
  }
  const groups: { label: string; keys: number[] }[] = [
    { label: "Low (1²-4²)", keys: [1, 4, 9, 16] },
    { label: "Basic (5²-7²)", keys: [25, 36, 49] },
    { label: "High (8²-9²)", keys: [64, 81] },
    { label: "100", keys: [100] },
  ];
  const sumGroup = (sq: Record<number, number>, keys: number[]) =>
    keys.reduce((a, k) => a + (sq[k] ?? 0), 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-white/60">
          <tr>
            <th className="text-left p-1">Batter</th>
            <th className="text-left p-1">Phase</th>
            <th>R</th>
            <th>B</th>
            <th>Dots</th>
            {groups.map((g) => (
              <th key={g.label}>{g.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(perPlayer).map(([name, p]) => {
            const out = inn.batStats[name]?.out;
            return (
              <Fragment key={name}>
                <tr className="border-t border-white/10">
                  <td className="p-1 font-semibold" rowSpan={2}>
                    {name} {out ? "" : "*"}
                  </td>
                  <td className="text-emerald-300">NORMAL</td>
                  <td className="text-center">{p.normal.r}</td>
                  <td className="text-center">{p.normal.b}</td>
                  <td className="text-center">{p.normal.d}</td>
                  {groups.map((g) => (
                    <td key={g.label} className="text-center">
                      {sumGroup(p.normal.sq, g.keys)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-white/5">
                  <td className="text-purple-300">CRAZY</td>
                  <td className="text-center">{p.crazy.r}</td>
                  <td className="text-center">{p.crazy.b}</td>
                  <td className="text-center">{p.crazy.d}</td>
                  {groups.map((g) => (
                    <td key={g.label} className="text-center">
                      {sumGroup(p.crazy.sq, g.keys)}
                    </td>
                  ))}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BowlingTable({ inn }: { inn: any }) {
  // derive per-bowler split by phase from ball log
  const split: Record<string, { NORMAL: { b: number; r: number; w: number }; CRAZY: { b: number; r: number; w: number; maidens: number } }> = {};
  const ensure = (n: string) => {
    if (!split[n]) split[n] = { NORMAL: { b: 0, r: 0, w: 0 }, CRAZY: { b: 0, r: 0, w: 0, maidens: 0 } };
    return split[n];
  };
  for (const b of inn.balls as any[]) {
    const s = ensure(b.bowler);
    const grp = b.phase === "CRAZY" ? s.CRAZY : s.NORMAL;
    grp.b += 1;
    grp.r += b.runs;
    if (b.isWicket) grp.w += 1;
  }
  // maidens: a CRAZY over with 0 squares conceded by that bowler
  // group balls by over (6 balls) per bowler-of-record per over
  const byOver: Record<string, { phase: string; balls: any[] }> = {};
  for (const b of inn.balls as any[]) {
    const k = `${b.bowler}#${b.over}`;
    if (!byOver[k]) byOver[k] = { phase: b.phase, balls: [] };
    byOver[k].balls.push(b);
  }
  for (const k of Object.keys(byOver)) {
    const o = byOver[k];
    if (o.phase === "CRAZY" && o.balls.length === 6 && o.balls.every((b) => !b.isSquare)) {
      const name = k.split("#")[0];
      ensure(name).CRAZY.maidens += 1;
    }
  }
  const ov = (n: number) => `${Math.floor(n / 6)}.${n % 6}`;
  const econ = (r: number, b: number) => (b ? ((r / b) * 6).toFixed(2) : "—");
  const names = Object.keys(inn.bowlStats);
  return (
    <table className="w-full text-xs">
      <thead className="text-white/60">
        <tr>
          <th rowSpan={2} className="text-left p-1">Bowler</th>
          <th colSpan={4} className="border-b border-white/10 text-emerald-300">Normal</th>
          <th colSpan={5} className="border-b border-white/10 text-fuchsia-300">Crazy</th>
          <th rowSpan={2}>Total</th>
        </tr>
        <tr>
          <th>O</th><th>R</th><th>W</th><th>Econ</th>
          <th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th>
        </tr>
      </thead>
      <tbody>
        {names.map((name) => {
          const s = ensure(name);
          const total = s.NORMAL.b + s.CRAZY.b;
          const totalR = s.NORMAL.r + s.CRAZY.r;
          const totalW = s.NORMAL.w + s.CRAZY.w;
          return (
            <tr key={name} className="border-t border-white/10">
              <td className="p-1 font-semibold">{name}</td>
              <td className="text-center">{ov(s.NORMAL.b)}</td>
              <td className="text-center">{s.NORMAL.r}</td>
              <td className="text-center">{s.NORMAL.w}</td>
              <td className="text-center">{econ(s.NORMAL.r, s.NORMAL.b)}</td>
              <td className="text-center">{ov(s.CRAZY.b)}</td>
              <td className="text-center">{s.CRAZY.maidens}</td>
              <td className="text-center">{s.CRAZY.r}</td>
              <td className="text-center">{s.CRAZY.w}</td>
              <td className="text-center">{econ(s.CRAZY.r, s.CRAZY.b)}</td>
              <td className="text-center text-white/80">{ov(total)} · {totalR}/{totalW}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ============ Chat ============
function ChatBox({
  state,
  mySide,
  send,
}: {
  state: GameState;
  mySide: Side;
  send: (e: RoomEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [lastSeen, setLastSeen] = useState(state.chat.length);
  const recent = state.chat.slice(-30);
  // unread = messages from the OTHER side after lastSeen
  const unread = state.chat
    .slice(lastSeen)
    .filter((m) => m.side !== mySide).length;
  useEffect(() => {
    if (open) setLastSeen(state.chat.length);
  }, [open, state.chat.length]);
  return (
    <div className="fixed bottom-20 right-3 z-50">
      {open ? (
        <div className="w-72 h-80 rounded-xl border border-white/10 bg-slate-900/95 shadow-2xl flex flex-col">
          <div className="px-3 py-2 border-b border-white/10 flex justify-between text-sm">
            <span>Match Chat</span>
            <button onClick={() => { setOpen(false); setLastSeen(state.chat.length); }} className="text-white/60">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 text-xs space-y-1">
            {recent.map((m, i) => (
              <div key={i}>
                <b className={m.side === "host" ? "text-emerald-400" : "text-indigo-400"}>
                  {m.side === "host" ? "Host" : "Away"}:
                </b>{" "}
                {m.text}
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              send({ type: "chat", side: mySide, text: text.trim() });
              setText("");
            }}
            className="flex border-t border-white/10"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="say something…"
              className="flex-1 px-2 py-2 bg-transparent text-xs outline-none"
            />
            <button className="px-3 text-emerald-400 text-xs">Send</button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="relative rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold shadow-lg"
        >
          💬 {state.chat.length}
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-slate-950 animate-pulse" />
          )}
        </button>
      )}
    </div>
  );
}

// ============ Pause Overlay ============
function PauseOverlay({
  state,
  mySide,
  send,
}: {
  state: GameState;
  mySide: Side;
  send: (e: RoomEvent) => void;
}) {
  const [showCard, setShowCard] = useState(false);
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/90 backdrop-blur-sm flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {showCard ? (
          <div>
            <div className="p-4 sticky top-0 bg-slate-950/80 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-lg font-bold">⏸ Match Paused — Scorecard</h2>
              <button onClick={() => setShowCard(false)} className="px-3 py-1 rounded bg-white/10 text-sm">
                Back
              </button>
            </div>
            <Scorecard state={state} code="" isHost={false} />
          </div>
        ) : (
          (() => {
            const isDisc = state.pausedReason === "disconnect";
            const discSide = state.disconnectedSide;
            const discTeam = discSide ? teamForSide(state, discSide)?.name : "Opponent";
            const remainMs = isDisc && state.pausedAt ? Math.max(0, 5 * 60 * 1000 - (Date.now() - state.pausedAt)) : 0;
            const mm = Math.floor(remainMs / 60000);
            const ss = Math.floor((remainMs % 60000) / 1000);
            return (
              <div className="min-h-full flex flex-col items-center justify-center p-6">
                <div className="text-6xl mb-4">{isDisc ? "🔌" : "⏸"}</div>
                <div className="text-3xl font-black mb-2">
                  {isDisc ? `${discTeam} disconnected` : "Match Paused"}
                </div>
                <div className="text-white/60 mb-2 text-center">
                  {isDisc
                    ? `Waiting for ${discTeam} to return…`
                    : state.pausedReason === "idle"
                      ? "Paused due to inactivity. Either side can resume."
                      : "Timer is frozen. Either side can resume."}
                </div>
                {isDisc && (
                  <div className="font-mono text-2xl text-amber-300 mb-6">
                    {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                    <span className="text-sm text-white/50 ml-2">until forfeit</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                  <button
                    onClick={() => setShowCard(true)}
                    className="flex-1 py-3 rounded-xl bg-indigo-500 font-bold"
                  >
                    📊 View Scorecard
                  </button>
                  {!isDisc && (
                    <button
                      onClick={() => send({ type: "resume" })}
                      className="flex-1 py-3 rounded-xl bg-emerald-500 text-emerald-950 font-bold"
                    >
                      ▶ Resume Match
                    </button>
                  )}
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
