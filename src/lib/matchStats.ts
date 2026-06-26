// Aggregate per-player, per-phase stats from a finished GameState for DB persistence.
import type { GameState, Phase } from "./gameTypes";
import { teamForSide } from "./gameEngine";

export interface PlayerLogRow {
  match_id: string;
  player_name: string;
  team_name: string;
  phase: "Normal" | "Crazy";
  runs_scored: number;
  outs: number;
  low_boundaries: number; // squares 25, 36, 49 (i.e. 5², 6², 7²)
  high_boundaries: number; // squares 64, 81 (8², 9²)
  ten_squares: number; // 100 (10²)
  balls_bowled: number;
  runs_conceded: number;
  wickets: number;
  maidens: number;
}

type Key = string; // `${player}__${team}__${phase}`

const LOW = new Set([25, 36, 49]);
const HIGH = new Set([64, 81]);

function emptyRow(matchId: string, player: string, team: string, phase: "Normal" | "Crazy"): PlayerLogRow {
  return {
    match_id: matchId,
    player_name: player,
    team_name: team,
    phase,
    runs_scored: 0,
    outs: 0,
    low_boundaries: 0,
    high_boundaries: 0,
    ten_squares: 0,
    balls_bowled: 0,
    runs_conceded: 0,
    wickets: 0,
    maidens: 0,
  };
}

export function buildPlayerLogRows(state: GameState, matchId: string): PlayerLogRow[] {
  const rows = new Map<Key, PlayerLogRow>();
  const get = (player: string, team: string, phase: Phase): PlayerLogRow => {
    const ph: "Normal" | "Crazy" = phase === "NORMAL" ? "Normal" : "Crazy";
    const k = `${player}__${team}__${ph}`;
    let r = rows.get(k);
    if (!r) {
      r = emptyRow(matchId, player, team, ph);
      rows.set(k, r);
    }
    return r;
  };

  for (let i = 1; i <= 4; i++) {
    const inn = state.innings[i];
    if (!inn) continue;
    const batTeam = teamForSide(state, inn.battingSide);
    const bowlTeam = teamForSide(state, inn.battingSide === "host" ? "away" : "host");
    if (!batTeam || !bowlTeam) continue;

    // accumulate balls
    for (const b of inn.balls) {
      // batting
      const batRow = get(b.striker, batTeam.name, b.phase);
      if (!b.isWicket) {
        batRow.runs_scored += b.runs;
        if (b.isSquare) {
          if (LOW.has(b.runs)) batRow.low_boundaries += 1;
          else if (HIGH.has(b.runs)) batRow.high_boundaries += 1;
          else if (b.runs === 100) batRow.ten_squares += 1;
        }
      } else {
        batRow.outs += 1;
      }
      // bowling
      const bowlRow = get(b.bowler, bowlTeam.name, b.phase);
      bowlRow.balls_bowled += 1;
      if (b.isWicket) bowlRow.wickets += 1;
      else bowlRow.runs_conceded += b.runs;
    }

    // maidens by over (phase from the over the balls live in)
    const overs = new Map<string, { runs: number; balls: number; bowler: string; phase: Phase }>();
    for (const b of inn.balls) {
      const k = `${b.over}__${b.bowler}`;
      const cur = overs.get(k) ?? { runs: 0, balls: 0, bowler: b.bowler, phase: b.phase };
      cur.balls += 1;
      cur.runs += b.isWicket ? 0 : b.runs;
      overs.set(k, cur);
    }
    for (const o of overs.values()) {
      if (o.balls === 6 && o.runs === 0) {
        const row = get(o.bowler, bowlTeam.name, o.phase);
        row.maidens += 1;
      }
    }
  }

  return Array.from(rows.values()).filter(
    (r) =>
      r.runs_scored ||
      r.outs ||
      r.low_boundaries ||
      r.high_boundaries ||
      r.ten_squares ||
      r.balls_bowled ||
      r.wickets ||
      r.maidens,
  );
}
