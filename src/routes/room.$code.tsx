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
  checkTimeUp,
  totalsBySide,
  leadTrailLabel,
  finalizeResult,
  teamForSide,
  computeTarget,
} from "@/lib/gameEngine";
import type { GameState, Side, BatStats, BowlStats } from "@/lib/gameTypes";
import { PHASE_OF_OVER } from "@/lib/gameTypes";
import { joinRoom, leaveRoom, type RoomEvent } from "@/lib/realtime";
import { loadSide, loadState, saveState } from "@/lib/storage";

export const Route = createFileRoute("/room/$code")({
  component: Room,
});

function Room() {
  const { code } = useParams({ from: "/room/$code" });
  const [side, setSide] = useState<Side | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const sendRef = useRef<((e: RoomEvent) => void) | null>(null);
  const sideRef = useRef<Side | null>(null);
  const [, force] = useState(0);

  // hydrate identity + cached state
  useEffect(() => {
    const ident = loadSide(code);
    if (!ident.side) {
      // joined via link without going through lobby — default to away, must pick team
      setSide("away");
      sideRef.current = "away";
    } else {
      setSide(ident.side);
      sideRef.current = ident.side;
      setTeamId(ident.teamId);
    }
    const cached = loadState(code);
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
      setState(cached.state);
      stateRef.current = cached.state;
    } else if (ident.side === "host") {
      const init = createInitialState(code);
      init.hostTeamId = ident.teamId;
      setState(init);
      stateRef.current = init;
    }
  }, [code]);

  // realtime
  useEffect(() => {
    if (!side) return;
    const { channel, send } = joinRoom(code, handleEvent);
    sendRef.current = send;
    // announce
    setTimeout(() => {
      send({ type: "hello", side: sideRef.current!, clientId: Math.random().toString(36), teamId });
    }, 300);
    return () => leaveRoom(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, code]);

  // persist on every change
  useEffect(() => {
    if (state) saveState(code, state);
    stateRef.current = state;
  }, [state, code]);

  // periodic time check (host only)
  useEffect(() => {
    if (side !== "host") return;
    const id = setInterval(() => {
      const s = stateRef.current;
      if (!s || s.phase === "match_over" || s.phase === "lobby") return;
      // auto-pause when idle > 60s during active play
      if (
        !s.paused &&
        (s.phase === "playing" || s.phase === "select_bowler" || s.phase === "select_new_batter") &&
        Date.now() - s.lastActionAt > 60_000
      ) {
        applyAndBroadcast({ ...s, paused: true, pausedAt: Date.now() });
        return;
      }
      const ns = checkTimeUp(s);
      if (ns !== s) {
        applyAndBroadcast(ns);
      } else {
        force((n) => n + 1); // refresh timer display
      }
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
    if (e.type === "state") {
      const incoming = e.state as GameState;
      // only accept if newer (or away has no state)
      if (!cur || incoming.version >= cur.version) {
        setState(incoming);
        stateRef.current = incoming;
      }
      return;
    }
    if (e.type === "hello") {
      if (mySide === "host" && e.side === "away") {
        let s = cur ?? createInitialState(code);
        s = { ...s, awayTeamId: e.teamId ?? s.awayTeamId, awayConnected: true, hostConnected: true };
        // auto-progress to toss when both teams chosen
        if (s.hostTeamId && s.awayTeamId && s.phase === "lobby") {
          s = { ...s, phase: "toss" };
        }
        applyAndBroadcast(s);
      } else if (mySide === "away" && e.side === "host") {
        // away saying hi to host already; reply by sending current cached if newer
      }
      return;
    }
    // only host applies engine transitions
    if (mySide !== "host" || !cur) return;
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
        // applied by winning side
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
        let s = lockInput(cur, e.side, e.value);
        if (s.hostLocked && s.awayLocked) {
          s = resolveBall(s);
        }
        applyAndBroadcast(s);
        return;
      }
      case "follow_on": {
        // Team A enforces; team B (2nd innings batting side) bats again
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
        applyAndBroadcast({
          ...cur,
          chat: [...cur.chat, { side: e.side, text: e.text, t: Date.now() }],
        });
        return;
      }
      case "pause": {
        if (cur.paused) return;
        applyAndBroadcast({ ...cur, paused: true, pausedAt: Date.now() });
        return;
      }
      case "resume": {
        if (!cur.paused) return;
        const elapsed = cur.pausedAt ? Date.now() - cur.pausedAt : 0;
        applyAndBroadcast({
          ...cur,
          paused: false,
          pausedAt: null,
          matchEndsAt: cur.matchEndsAt ? cur.matchEndsAt + elapsed : cur.matchEndsAt,
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
          handleEvent(e);
          return;
        }
        sendRef.current?.(e);
      }}
      onTeamPick={(id) => {
        setTeamId(id);
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
          <Scorecard state={state} />
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
  const nowRef = state.paused && state.pausedAt ? state.pausedAt : Date.now();
  const timeLeft = state.matchEndsAt ? Math.max(0, state.matchEndsAt - nowRef) : 30 * 60 * 1000;
  const mm = Math.floor(timeLeft / 60000);
  const ss = Math.floor((timeLeft % 60000) / 1000);
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
          <span>
            Over {inn.overNumber + (state.phase === "playing" ? 1 : 0)}.{inn.ballInOver}
          </span>
        )}
        <span className={`font-mono ${timeLeft < 60000 ? "text-red-400" : ""} ${state.paused ? "text-amber-300" : ""}`}>
          ⏱ {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}{state.paused ? " ⏸" : ""}
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
          onPick={(n) => send({ type: "input", side: mySide, value: n })}
          batterMode={iAmBatting}
          batterZerosUsed={iAmBatting && inn.striker ? inn.zeroCount[inn.striker] ?? 0 : 0}
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
      <div className="text-white/70 mb-6">
        Totals: {getTeam(state.hostTeamId!)?.name} {totalsBySide(state).host} ·{" "}
        {getTeam(state.awayTeamId!)?.name} {totalsBySide(state).away}
      </div>
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
function Scorecard({ state }: { state: GameState }) {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-700 to-indigo-800 p-6 mb-6 text-center">
        <div className="text-sm opacity-80">Result</div>
        <div className="text-3xl font-black">{state.result ?? finalizeResult(state)}</div>
      </div>
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
  return (
    <table className="w-full text-xs">
      <thead className="text-white/60">
        <tr>
          <th className="text-left p-1">Bowler</th>
          <th>O</th>
          <th>M</th>
          <th>R</th>
          <th>W</th>
          <th>Econ</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(inn.bowlStats).map(([name, s]: [string, any]) => {
          const ov = `${Math.floor(s.ballsBowled / 6)}.${s.ballsBowled % 6}`;
          const econ = s.ballsBowled ? ((s.runsConceded / s.ballsBowled) * 6).toFixed(2) : "—";
          return (
            <tr key={name} className="border-t border-white/10">
              <td className="p-1 font-semibold">{name}</td>
              <td className="text-center">{ov}</td>
              <td className="text-center">{s.maidens}</td>
              <td className="text-center">{s.runsConceded}</td>
              <td className="text-center">{s.wickets}</td>
              <td className="text-center">{econ}</td>
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
  const recent = state.chat.slice(-30);
  return (
    <div className="fixed bottom-3 right-3 z-50">
      {open ? (
        <div className="w-72 h-80 rounded-xl border border-white/10 bg-slate-900/95 shadow-2xl flex flex-col">
          <div className="px-3 py-2 border-b border-white/10 flex justify-between text-sm">
            <span>Match Chat</span>
            <button onClick={() => setOpen(false)} className="text-white/60">✕</button>
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
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold shadow-lg"
        >
          💬 {state.chat.length}
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
            <Scorecard state={state} />
          </div>
        ) : (
          <div className="min-h-full flex flex-col items-center justify-center p-6">
            <div className="text-6xl mb-4">⏸</div>
            <div className="text-3xl font-black mb-2">Match Paused</div>
            <div className="text-white/60 mb-8 text-center">
              Timer is frozen. Either side can resume.
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
              <button
                onClick={() => setShowCard(true)}
                className="flex-1 py-3 rounded-xl bg-indigo-500 font-bold"
              >
                📊 View Scorecard
              </button>
              <button
                onClick={() => send({ type: "resume" })}
                className="flex-1 py-3 rounded-xl bg-emerald-500 text-emerald-950 font-bold"
              >
                ▶ Resume Match
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
