import type { GameState, Side } from "./gameTypes";

// Pure helpers that convert the engine's existing GameState into persistable
// records. They only READ engine output — they never change outcomes.

export interface BallEventPayload {
  id: string;
  innings_no: number;
  over_no: number;
  ball_no: number;
  batting_side: Side;
  striker: string;
  non_striker: string | null;
  bowler: string;
  phase: "NORMAL" | "CRAZY";
  bat_number: number;
  bowl_number: number;
  runs: number;
  is_square: boolean;
  is_wicket: boolean;
}

export interface InningsPayload {
  innings_no: number;
  batting_side: Side;
  runs: number;
  wickets: number;
  legal_balls: number;
  declared: boolean;
  all_out: boolean;
}

export function matchIdFor(s: Pick<GameState, "roomCode" | "matchStartedAt">): string | null {
  if (!s.matchStartedAt) return null;
  return `${s.roomCode}-${s.matchStartedAt}`;
}

export function ballEventId(matchId: string, inn: number, over: number, ball: number) {
  return `${matchId}:${inn}:${over}:${ball}`;
}

export function extractBallEvents(s: GameState): BallEventPayload[] {
  const matchId = matchIdFor(s);
  if (!matchId) return [];
  const out: BallEventPayload[] = [];
  for (let i = 1; i <= 4; i++) {
    const inn = s.innings[i];
    if (!inn) continue;
    for (const b of inn.balls) {
      out.push({
        id: ballEventId(matchId, b.innings, b.over, b.ball),
        innings_no: b.innings,
        over_no: b.over,
        ball_no: b.ball,
        batting_side: inn.battingSide,
        striker: b.striker,
        non_striker: b.nonStriker ?? null,
        bowler: b.bowler,
        phase: b.phase,
        bat_number: b.bat,
        bowl_number: b.bowl,
        runs: b.runs,
        is_square: b.isSquare,
        is_wicket: b.isWicket,
      });
    }
  }
  return out;
}

export function extractInnings(s: GameState): InningsPayload[] {
  const out: InningsPayload[] = [];
  for (let i = 1; i <= 4; i++) {
    const inn = s.innings[i];
    if (!inn) continue;
    out.push({
      innings_no: i,
      batting_side: inn.battingSide,
      runs: inn.runs,
      wickets: inn.wickets,
      legal_balls: inn.ballsBowled,
      declared: inn.declared,
      all_out: inn.allOut,
    });
  }
  return out;
}
