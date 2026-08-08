import {
  BallLog,
  GameState,
  InningsState,
  PHASE_OF_OVER,
  SQUARE_KEY,
  Side,
  newBatStats,
  newBowlStats,
} from "./gameTypes";
import { TEAMS, getTeam, getEligibleBatters } from "./teams";

export const OVERS_PER_INNINGS = 15;
export const MAX_ZEROS_PER_OVER = 3;

export function zerosUsedThisOver(inn: InningsState): number {
  const currentOver = inn.overNumber + 1;
  return inn.balls.reduce((total, ball) => total + (ball.over === currentOver && ball.bat === 0 ? 1 : 0), 0);
}

export function createInitialState(roomCode: string): GameState {
  return {
    version: 0,
    roomCode,
    hostTeamId: null,
    awayTeamId: null,
    hostConnected: true,
    awayConnected: false,
    phase: "lobby",
    currentInnings: 0,
    innings: [null, null, null, null, null],
    hostInput: null,
    awayInput: null,
    hostLocked: false,
    awayLocked: false,
    matchStartedAt: null,
    matchEndsAt: null,
    lastActionAt: Date.now(),
    chat: [],
  };
}

export function teamForSide(s: GameState, side: Side) {
  return side === "host" ? getTeam(s.hostTeamId!) : getTeam(s.awayTeamId!);
}

export function battingSideOfInnings(inn: InningsState): Side {
  return inn.battingSide;
}

export function bowlingSideForCurrent(s: GameState): Side | null {
  const inn = s.innings[s.currentInnings];
  if (!inn) return null;
  return inn.battingSide === "host" ? "away" : "host";
}

export function startInnings(s: GameState, inningsNo: 1 | 2 | 3 | 4, battingSide: Side): GameState {
  const team = teamForSide(s, battingSide)!;
  const eligible = getEligibleBatters(team).map((p) => p.name);
  const inn: InningsState = {
    battingSide,
    runs: 0,
    wickets: 0,
    ballsBowled: 0,
    overNumber: 0,
    ballInOver: 0,
    isLMS: false,
    declared: false,
    allOut: false,
    closed: false,
    striker: null,
    nonStriker: null,
    bowler: null,
    prevBowler: null,
    batStats: {},
    bowlStats: {},
    zeroCount: {},
    balls: [],
    outBatters: [],
    yetToBat: eligible.slice(),
  };
  const innings = [...s.innings];
  innings[inningsNo] = inn;
  return {
    ...s,
    innings,
    currentInnings: inningsNo,
    phase: "innings_setup",
    pendingSelect: { type: "openers", forSide: battingSide },
    hostInput: null,
    awayInput: null,
    hostLocked: false,
    awayLocked: false,
    lastActionAt: Date.now(),
  };
}

export function setOpeners(s: GameState, striker: string, nonStriker: string): GameState {
  const inn = { ...s.innings[s.currentInnings]! };
  inn.striker = striker;
  inn.nonStriker = nonStriker;
  inn.batStats[striker] = newBatStats();
  inn.batStats[nonStriker] = newBatStats();
  inn.yetToBat = inn.yetToBat.filter((n) => n !== striker && n !== nonStriker);
  const innings = [...s.innings];
  innings[s.currentInnings] = inn;
  // now select bowler
  return {
    ...s,
    innings,
    phase: "select_bowler",
    pendingSelect: { type: "bowler", forSide: bowlingSideForCurrent({ ...s, innings })! },
    lastActionAt: Date.now(),
  };
}

export function setBowler(s: GameState, bowler: string): GameState {
  const inn = { ...s.innings[s.currentInnings]! };
  inn.bowler = bowler;
  if (!inn.bowlStats[bowler]) inn.bowlStats[bowler] = newBowlStats();
  inn.bowlStats[bowler].squaresConcededThisOver = 0;
  const innings = [...s.innings];
  innings[s.currentInnings] = inn;
  return {
    ...s,
    innings,
    phase: "playing",
    pendingSelect: undefined,
    hostInput: null,
    awayInput: null,
    hostLocked: false,
    awayLocked: false,
    matchStartedAt: s.matchStartedAt ?? Date.now(),
    matchEndsAt: null,
    lastActionAt: Date.now(),
    ballStartedAt: Date.now(),
    offenceWarning: null,
  };
}

export function setNewBatter(s: GameState, name: string): GameState {
  const inn = { ...s.innings[s.currentInnings]! };
  const toNonStriker = s.pendingSelect?.toNonStriker === true;
  if (toNonStriker) {
    inn.nonStriker = name;
  } else {
    // incoming batter goes to striker end (replaces dismissed)
    inn.striker = name;
  }
  inn.batStats[name] = newBatStats();
  inn.yetToBat = inn.yetToBat.filter((n) => n !== name);
  const innings = [...s.innings];
  innings[s.currentInnings] = inn;
  // If we still need a bowler (e.g. wicket fell on last ball of over), chain into bowler selection
  if (!inn.bowler) {
    return {
      ...s,
      innings,
      phase: "select_bowler",
      pendingSelect: { type: "bowler", forSide: bowlingSideForCurrent({ ...s, innings })! },
      hostInput: null,
      awayInput: null,
      hostLocked: false,
      awayLocked: false,
      lastActionAt: Date.now(),
    };
  }
  return {
    ...s,
    innings,
    phase: "playing",
    pendingSelect: undefined,
    hostInput: null,
    awayInput: null,
    hostLocked: false,
    awayLocked: false,
    lastActionAt: Date.now(),
    ballStartedAt: Date.now(),
    offenceWarning: null,
  };
}

export function lockInput(s: GameState, side: Side, value: number): GameState {
  if (s.phase !== "playing") return s;
  const inn = s.innings[s.currentInnings];
  if (!inn) return s;
  if (side === inn.battingSide && value === 0 && zerosUsedThisOver(inn) >= MAX_ZEROS_PER_OVER) return s;
  if (side === "host") {
    if (s.hostLocked) return s;
    return { ...s, hostInput: value, hostLocked: true, lastActionAt: Date.now() };
  } else {
    if (s.awayLocked) return s;
    return { ...s, awayInput: value, awayLocked: true, lastActionAt: Date.now() };
  }
}

// Compute ball outcome from bat/bowl values and phase.
export function computeOutcome(
  bat: number,
  bowl: number,
  phase: "NORMAL" | "CRAZY",
  batterZeroProtect: boolean,
): { runs: number; out: boolean; isSquare: boolean } {
  if (phase === "NORMAL") {
    if (bat === bowl) return { runs: 0, out: true, isSquare: false };
    return { runs: bat, out: false, isSquare: false };
  }
  // CRAZY
  if (bat === bowl) {
    return { runs: bat * bat, out: false, isSquare: bat > 0 };
  }
  if (!batterZeroProtect && Math.abs(bat - bowl) === 1) {
    return { runs: 0, out: true, isSquare: false };
  }
  return { runs: bat, out: false, isSquare: false };
}

export function resolveBall(s: GameState): GameState {
  if (!(s.hostLocked && s.awayLocked)) return s;
  const innIdx = s.currentInnings;
  const inn = { ...s.innings[innIdx]! };
  const battingSide = inn.battingSide;
  const batInput = battingSide === "host" ? s.hostInput! : s.awayInput!;
  const bowlInput = battingSide === "host" ? s.awayInput! : s.hostInput!;
  const phase = PHASE_OF_OVER(inn.overNumber);
  const overZerosUsed = zerosUsedThisOver(inn);

  if (batInput === 0 && overZerosUsed >= MAX_ZEROS_PER_OVER) {
    return {
      ...s,
      hostInput: battingSide === "host" ? null : s.hostInput,
      awayInput: battingSide === "away" ? null : s.awayInput,
      hostLocked: battingSide === "host" ? false : s.hostLocked,
      awayLocked: battingSide === "away" ? false : s.awayLocked,
      lastActionAt: Date.now(),
    };
  }

  const striker = inn.striker!;
  const bowler = inn.bowler!;
  const batterZerosUsed = inn.zeroCount[striker] ?? 0;
  const batterZeroProtect = batInput === 0 && overZerosUsed < MAX_ZEROS_PER_OVER;
  let outcome = computeOutcome(batInput, bowlInput, phase, batterZeroProtect);


  // Stats
  const bs = { ...(inn.batStats[striker] ?? newBatStats()) };
  bs.balls += 1;
  if (outcome.out) {
    bs.out = true;
    bs.outBy = bowler;
  } else {
    bs.runs += outcome.runs;
    if (outcome.runs === 0) bs.dots += 1;
    if (outcome.isSquare) {
      const k = SQUARE_KEY(outcome.runs);
      if (k) (bs as any)[k] = ((bs as any)[k] ?? 0) + 1;
    }
  }
  inn.batStats[striker] = bs;

  const bws = { ...(inn.bowlStats[bowler] ?? newBowlStats()) };
  bws.ballsBowled += 1;
  bws.runsConceded += outcome.runs;
  if (outcome.out) bws.wickets += 1;
  if (outcome.isSquare) bws.squaresConcededThisOver += 1;
  inn.bowlStats[bowler] = bws;

  // batter zero tally
  if (batInput === 0 && !outcome.out) {
    inn.zeroCount[striker] = batterZerosUsed + 1;
  }

  // ball log
  const ballNo = inn.ballInOver + 1;
  const log: BallLog = {
    innings: innIdx,
    over: inn.overNumber + 1,
    ball: ballNo,
    phase,
    bat: batInput,
    bowl: bowlInput,
    runs: outcome.runs,
    isSquare: outcome.isSquare,
    isWicket: outcome.out,
    striker,
    bowler,
  };
  inn.balls.push(log);

  // update score
  inn.runs += outcome.runs;
  inn.ballsBowled += 1;

  let nextPhaseGame: GameState["phase"] = "playing";
  let pendingSelect: GameState["pendingSelect"];

  // wicket handling
  if (outcome.out) {
    inn.wickets += 1;
    inn.outBatters.push(striker);
    // 5 wickets max
    if (inn.wickets >= 5) {
      inn.allOut = true;
      inn.closed = true;
    } else if (inn.wickets === 4) {
      // LMS: the not-out batter (current non-striker) continues alone, no selection.
      inn.isLMS = true;
      inn.striker = inn.nonStriker;
      inn.nonStriker = null;
      // stay in playing phase; end-of-over check below still applies
    } else {
      inn.striker = null;
      pendingSelect = { type: "batter", forSide: battingSide };
      nextPhaseGame = "select_new_batter";
    }
  } else {
    // strike rotation: not in LMS, odd runs swap
    if (!inn.isLMS && outcome.runs % 2 === 1) {
      const tmp = inn.striker;
      inn.striker = inn.nonStriker;
      inn.nonStriker = tmp;
    }
  }

  // end of over?
  let endOfOver = false;
  if (inn.ballInOver + 1 >= 6) {
    endOfOver = true;
    // maiden: CRAZY over with 0 squares conceded
    if (phase === "CRAZY" && bws.squaresConcededThisOver === 0) {
      inn.bowlStats[bowler].maidens += 1;
    }
    inn.overNumber += 1;
    inn.ballInOver = 0;
    inn.zeroCount = {};
    inn.prevBowler = bowler;
    inn.bowler = null;
    // swap strike at end of over (unless LMS)
    if (!inn.isLMS && inn.striker && inn.nonStriker) {
      const tmp = inn.striker;
      inn.striker = inn.nonStriker;
      inn.nonStriker = tmp;
    }
    // overs limit reached — innings closes
    if (inn.overNumber >= OVERS_PER_INNINGS) {
      inn.closed = true;
    }
    if (!inn.closed) {
      // If wicket fell on this last ball, striker is null and non-striker is the survivor.
      // Promote the survivor to striker and request the new batter for the non-striker end first,
      // then bowler selection will be chained inside setNewBatter.
      if (!inn.isLMS && inn.striker === null && inn.nonStriker) {
        inn.striker = inn.nonStriker;
        inn.nonStriker = null;
        pendingSelect = { type: "batter", forSide: battingSide, toNonStriker: true };
        nextPhaseGame = "select_new_batter";
      } else {
        pendingSelect = { type: "bowler", forSide: bowlingSideForCurrent({ ...s, innings: replaceInn(s, innIdx, inn) })! };
        nextPhaseGame = "select_bowler";
      }
    }
  } else {
    inn.ballInOver += 1;
  }

  // chase target check for 2nd/4th innings
  let result: string | undefined;
  let winner: GameState["winner"];
  const innings = replaceInn(s, innIdx, inn);

  // For 4th innings — chase win
  if (innIdx === 4) {
    const target = computeTarget(s);
    if (target !== null && inn.runs >= target) {
      inn.closed = true;
      const battingTeam = teamForSide(s, inn.battingSide)!;
      result = `${battingTeam.name} wins by ${5 - inn.wickets} wickets`;
      winner = inn.battingSide;
    }
  }

  // innings end?
  if (inn.closed) {
    return endOfInnings({ ...s, innings: replaceInn(s, innIdx, inn), lastBall: log }, result, winner);
  }


  return {
    ...s,
    innings: replaceInn(s, innIdx, inn),
    hostInput: null,
    awayInput: null,
    hostLocked: false,
    awayLocked: false,
    phase: nextPhaseGame,
    pendingSelect,
    lastBall: log,
    lastActionAt: Date.now(),
    ballStartedAt: nextPhaseGame === "playing" ? Date.now() : null,
    offenceWarning: null,
  };
}

function replaceInn(s: GameState, idx: number, inn: InningsState) {
  const innings = [...s.innings];
  innings[idx] = inn;
  return innings;
}

export function declareInnings(s: GameState): GameState {
  const inn = { ...s.innings[s.currentInnings]! };
  inn.declared = true;
  inn.closed = true;
  return endOfInnings({ ...s, innings: replaceInn(s, s.currentInnings, inn) });
}

export function totalsBySide(s: GameState): { host: number; away: number } {
  let host = 0;
  let away = 0;
  for (let i = 1; i <= 4; i++) {
    const inn = s.innings[i];
    if (!inn) continue;
    if (inn.battingSide === "host") host += inn.runs;
    else away += inn.runs;
  }
  return { host, away };
}

export function computeTarget(s: GameState): number | null {
  // applies to 4th innings chasing
  const inn4 = s.innings[4];
  if (!inn4) return null;
  const chasingSide = inn4.battingSide;
  // target = (defending side's combined runs in innings 1-3) - (chasing side's runs in innings 1-3) + 1
  let chasingPrev = 0;
  let defendingTotal = 0;
  for (let i = 1; i <= 3; i++) {
    const inn = s.innings[i];
    if (!inn) continue;
    if (inn.battingSide === chasingSide) chasingPrev += inn.runs;
    else defendingTotal += inn.runs;
  }
  return defendingTotal - chasingPrev + 1;
}

export function endOfInnings(s: GameState, result?: string, winner?: GameState["winner"]): GameState {
  const innIdx = s.currentInnings;
  if (innIdx === 4 || result) {
    return {
      ...s,
      phase: "match_over",
      result: result ?? finalizeResult(s),
      winner: winner ?? finalWinner(s),
      hostInput: null,
      awayInput: null,
      hostLocked: false,
      awayLocked: false,
      pendingSelect: undefined,
      lastActionAt: Date.now(),
    };
  }
  if (innIdx === 1) {
    return {
      ...s,
      phase: "innings_break",
      firstInningsBattingSide: s.innings[1]!.battingSide,
      hostInput: null,
      awayInput: null,
      hostLocked: false,
      awayLocked: false,
      pendingSelect: undefined,
      lastActionAt: Date.now(),
    };
  }
  if (innIdx === 2) {
    // check follow-on eligibility
    const inn1 = s.innings[1]!;
    const inn2 = s.innings[2]!;
    const teamAFirstScore = inn1.runs;
    const teamBSecondScore = inn2.runs;
    const deficit = teamAFirstScore - teamBSecondScore;
    const followOnPossible = teamBSecondScore < teamAFirstScore * 0.5 && deficit >= 100;
    if (followOnPossible) {
      return {
        ...s,
        phase: "follow_on_decision",
        hostInput: null,
        awayInput: null,
        hostLocked: false,
        awayLocked: false,
        pendingSelect: undefined,
        lastActionAt: Date.now(),
      };
    }
    return {
      ...s,
      phase: "innings_break",
      hostInput: null,
      awayInput: null,
      hostLocked: false,
      awayLocked: false,
      pendingSelect: undefined,
      lastActionAt: Date.now(),
    };
  }
  // innings 3 — check for innings victory before starting 4th
  // The side that has batted only once: if their total > other side's two-innings cumulative, they win by an innings.
  const t = totalsBySide(s);
  const inn3 = s.innings[3]!;
  const sideBattedTwice: Side = inn3.battingSide; // batted in 2 of 3 innings (either 1+3 or 2+3)
  const sideBattedOnce: Side = sideBattedTwice === "host" ? "away" : "host";
  const onceTotal = sideBattedOnce === "host" ? t.host : t.away;
  const twiceTotal = sideBattedTwice === "host" ? t.host : t.away;
  if (onceTotal > twiceTotal) {
    const winnerName = teamForSide(s, sideBattedOnce)!.name;
    const margin = onceTotal - twiceTotal;
    return {
      ...s,
      phase: "match_over",
      result: `${winnerName} wins by an innings and ${margin} run${margin === 1 ? "" : "s"}`,
      winner: sideBattedOnce,
      hostInput: null,
      awayInput: null,
      hostLocked: false,
      awayLocked: false,
      pendingSelect: undefined,
      lastActionAt: Date.now(),
    };
  }
  return {
    ...s,
    phase: "innings_break",
    hostInput: null,
    awayInput: null,
    hostLocked: false,
    awayLocked: false,
    pendingSelect: undefined,
    lastActionAt: Date.now(),
  };
}

export function finalWinner(s: GameState): GameState["winner"] {
  const t = totalsBySide(s);
  if (t.host > t.away) return "host";
  if (t.away > t.host) return "away";
  return "draw";
}

export function finalizeResult(s: GameState): string {
  const t = totalsBySide(s);
  const hostName = getTeam(s.hostTeamId!)?.name ?? "Host";
  const awayName = getTeam(s.awayTeamId!)?.name ?? "Away";
  if (t.host === t.away) return "Match Drawn";
  const winnerName = t.host > t.away ? hostName : awayName;
  const diff = Math.abs(t.host - t.away);
  return `${winnerName} wins by ${diff} runs`;
}

export function startNextInnings(
  s: GameState,
  nextBattingSide: Side,
): GameState {
  const next = (s.currentInnings + 1) as 2 | 3 | 4;
  return startInnings(s, next, nextBattingSide);
}

// ===== Stopwatches =====
// Total match elapsed time, excluding time spent paused.
export function matchElapsedMs(s: GameState): number {
  if (!s.matchStartedAt) return 0;
  const end = s.paused && s.pausedAt ? s.pausedAt : Date.now();
  return Math.max(0, end - s.matchStartedAt - (s.pausedTotalMs ?? 0));
}

export function formatClock(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Add a player's/side's active thinking time for one ball.
export function addThinkTime(s: GameState, side: Side, player: string | null, ms: number): GameState {
  const add = Math.max(0, Math.min(10 * 60_000, ms));
  if (!add) return s;
  const thinkMs = { host: 0, away: 0, ...(s.thinkMs ?? {}) };
  thinkMs[side] += add;
  const playerThinkMs = { ...(s.playerThinkMs ?? {}) };
  if (player) playerThinkMs[player] = (playerThinkMs[player] ?? 0) + add;
  return { ...s, thinkMs, playerThinkMs };
}

// Lead/trail label for innings 2-4
export function leadTrailLabel(s: GameState): string | null {
  const idx = s.currentInnings;
  if (idx < 2) return null;
  const inn = s.innings[idx];
  if (!inn) return null;
  const t = totalsBySide(s);
  const battingSide = inn.battingSide;
  const oppSide: Side = battingSide === "host" ? "away" : "host";
  const battingTotal = battingSide === "host" ? t.host : t.away;
  const oppTotal = oppSide === "host" ? t.host : t.away;
  const teamName = teamForSide(s, battingSide)!.name;
  const diff = battingTotal - oppTotal;
  if (diff === 0) return `${teamName} level with opponent`;
  if (diff < 0) return `${teamName} trails by ${-diff} runs`;
  return `${teamName} leads by ${diff} runs`;
}

export { TEAMS };
