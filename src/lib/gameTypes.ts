export type Phase = "NORMAL" | "CRAZY";
export type Side = "host" | "away";
export type GamePhase =
  | "lobby"
  | "toss"
  | "innings_setup"
  | "select_bowler"
  | "select_new_batter"
  | "playing"
  | "innings_break"
  | "follow_on_decision"
  | "match_over";

export interface BatStats {
  runs: number;
  balls: number;
  dots: number;
  // Basic squares: 1, 4, 9, 16
  sq1: number;
  sq4: number;
  sq9: number;
  sq16: number;
  // Low squares: 25, 36, 49
  sq25: number;
  sq36: number;
  sq49: number;
  // High squares: 64, 81
  sq64: number;
  sq81: number;
  // 10 squares: 100
  sq100: number;
  out: boolean;
  outBy?: string;
}

export interface BowlStats {
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  squaresConcededThisOver: number; // tracker; only counts in CRAZY overs
}

export interface BallLog {
  innings: number;
  over: number;
  ball: number;
  phase: Phase;
  bat: number;
  bowl: number;
  runs: number;
  isSquare: boolean;
  isWicket: boolean;
  striker: string;
  bowler: string;
}

export interface InningsState {
  battingSide: Side;
  runs: number;
  wickets: number;
  ballsBowled: number; // total legal balls
  overNumber: number; // current over index, 0-based at start
  ballInOver: number; // 0..5
  isLMS: boolean;
  declared: boolean;
  allOut: boolean;
  closed: boolean;
  striker: string | null;
  nonStriker: string | null;
  bowler: string | null;
  prevBowler: string | null;
  batStats: Record<string, BatStats>;
  bowlStats: Record<string, BowlStats>;
  zeroCount: Record<string, number>; // batsman zeros this over
  balls: BallLog[];
  outBatters: string[];
  yetToBat: string[];
}

export interface GameState {
  version: number;
  roomCode: string;
  hostTeamId: string | null;
  awayTeamId: string | null;
  hostConnected: boolean;
  awayConnected: boolean;
  phase: GamePhase;
  // toss
  tossCall?: "heads" | "tails";
  tossResult?: "heads" | "tails";
  tossWinner?: Side;
  tossChoice?: "bat" | "bowl";
  // innings
  currentInnings: 0 | 1 | 2 | 3 | 4;
  innings: (InningsState | null)[]; // index 1..4
  firstInningsBattingSide?: Side; // host or away who batted first
  // ball lock state
  hostInput: number | null;
  awayInput: number | null;
  hostLocked: boolean;
  awayLocked: boolean;
  // selection pending
  pendingSelect?: {
    type: "bowler" | "batter" | "openers";
    forSide: Side;
    toNonStriker?: boolean;
  };
  // timer
  matchStartedAt: number | null;
  matchEndsAt: number | null; // matchStartedAt + 30min
  lastActionAt: number;
  paused?: boolean;
  pausedAt?: number | null;
  pausedReason?: "manual" | "idle" | "disconnect";
  disconnectedSide?: Side | null;
  // chat
  chat: { side: Side; text: string; t: number }[];
  // last result for UI display
  lastBall?: BallLog;
  // follow-on
  followOnOffered?: boolean;
  // result
  result?: string;
  winner?: Side | "draw" | "tie";
  // per-ball 20s timer
  ballStartedAt?: number | null;
  timeOffences?: Record<string, number>; // player name → # of offences
  offenceWarning?: {
    side: Side;
    teamName: string;
    player: string;
    seconds: number;
    until: number;
  } | null;
}

export const PHASE_OF_OVER = (overIndex: number): Phase =>
  (overIndex + 1) % 2 === 1 ? "NORMAL" : "CRAZY"; // over 1 (index 0) = NORMAL, over 2 = CRAZY

export const SQUARE_KEY = (n: number): keyof BatStats | null => {
  switch (n) {
    case 1:
      return "sq1";
    case 4:
      return "sq4";
    case 9:
      return "sq9";
    case 16:
      return "sq16";
    case 25:
      return "sq25";
    case 36:
      return "sq36";
    case 49:
      return "sq49";
    case 64:
      return "sq64";
    case 81:
      return "sq81";
    case 100:
      return "sq100";
    default:
      return null;
  }
};

export const newBatStats = (): BatStats => ({
  runs: 0,
  balls: 0,
  dots: 0,
  sq1: 0,
  sq4: 0,
  sq9: 0,
  sq16: 0,
  sq25: 0,
  sq36: 0,
  sq49: 0,
  sq64: 0,
  sq81: 0,
  sq100: 0,
  out: false,
});

export const newBowlStats = (): BowlStats => ({
  ballsBowled: 0,
  runsConceded: 0,
  wickets: 0,
  maidens: 0,
  squaresConcededThisOver: 0,
});
