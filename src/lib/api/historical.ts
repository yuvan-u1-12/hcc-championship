import { supabase } from "@/integrations/supabase/client";

// Tiny CSV parser supporting quoted fields and commas inside quotes.
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        cur.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (field !== "" || cur.length) {
          cur.push(field);
          rows.push(cur);
          cur = [];
          field = "";
        }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else field += c;
    }
  }
  if (field !== "" || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((v) => v.trim() !== "")).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => (o[h] = (r[idx] ?? "").trim()));
    return o;
  });
}

const num = (s: string | undefined, fallback = 0): number => {
  if (s === undefined || s === "") return fallback;
  const n = Number(s);
  return isNaN(n) ? fallback : n;
};

export async function importMatchHistoryCsv(text: string) {
  const rows = parseCsv(text);
  const payload = rows.map((r) => ({
    match_id: r.match_id,
    home_team: r.home_team,
    away_team: r.away_team,
    winner: r.winner || null,
    loser: r.loser || null,
    potm: r.potm || null,
    won_by: r.won_by || null,
  }));
  if (!payload.length) return { ok: true, inserted: 0 };
  const { error } = await supabase.from("match_history").insert(payload);
  if (error) throw error;
  return { ok: true, inserted: payload.length };
}

export async function importInningsDataCsv(text: string) {
  const rows = parseCsv(text);
  const payload = rows.map((r) => ({
    match_id: r.match_id,
    batting_team: r.batting_team,
    bowling_team: r.bowling_team,
    inn1_score: r.inn1_score || null,
    inn2_score: r.inn2_score || null,
    inn3_score: r.inn3_score || null,
    inn4_score: r.inn4_score || null,
    match_aggregate: r.match_aggregate ? num(r.match_aggregate) : null,
  }));
  if (!payload.length) return { ok: true, inserted: 0 };
  const { error } = await supabase.from("innings_data").insert(payload);
  if (error) throw error;
  return { ok: true, inserted: payload.length };
}

export async function importPlayerLogsCsv(text: string) {
  const rows = parseCsv(text);
  const payload = rows.map((r) => ({
    match_id: r.match_id,
    player_name: r.player_name,
    team_name: r.team_name,
    phase: (r.phase === "Crazy" ? "Crazy" : "Normal") as "Normal" | "Crazy",
    runs_scored: num(r.runs_scored),
    outs: num(r.outs),
    low_boundaries: num(r.low_boundaries),
    high_boundaries: num(r.high_boundaries),
    ten_squares: num(r.ten_squares),
    balls_bowled: num(r.balls_bowled),
    runs_conceded: num(r.runs_conceded),
    wickets: num(r.wickets),
    maidens: num(r.maidens),
  }));
  if (!payload.length) return { ok: true, inserted: 0 };
  const { error } = await supabase.from("match_player_logs").insert(payload);
  if (error) throw error;
  return { ok: true, inserted: payload.length };
}

// --------- Match Center ---------

export interface MatchFeedItem {
  match_id: string;
  home_team: string;
  away_team: string;
  winner: string | null;
  loser: string | null;
  potm: string | null;
  won_by: string | null;
  innings: {
    batting_team: string;
    bowling_team: string;
    inn1_score: string | null;
    inn2_score: string | null;
    inn3_score: string | null;
    inn4_score: string | null;
    match_aggregate: number | null;
  } | null;
  created_at: string;
}

export async function fetchMatchFeed(): Promise<MatchFeedItem[]> {
  const [{ data: matches, error: e1 }, { data: innings, error: e2 }] = await Promise.all([
    supabase.from("match_history").select("*").order("created_at", { ascending: false }),
    supabase.from("innings_data").select("*"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const innMap = new Map<string, NonNullable<MatchFeedItem["innings"]>>();
  for (const i of innings ?? []) {
    innMap.set(i.match_id, {
      batting_team: i.batting_team,
      bowling_team: i.bowling_team,
      inn1_score: i.inn1_score,
      inn2_score: i.inn2_score,
      inn3_score: i.inn3_score,
      inn4_score: i.inn4_score,
      match_aggregate: i.match_aggregate,
    });
  }
  return (matches ?? []).map((m) => ({
    match_id: m.match_id,
    home_team: m.home_team,
    away_team: m.away_team,
    winner: m.winner,
    loser: m.loser,
    potm: m.potm,
    won_by: m.won_by,
    innings: innMap.get(m.match_id) ?? null,
    created_at: m.created_at,
  }));
}

// --------- Points Table ---------

export interface TeamStanding {
  team: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  inningsOr5wWins: number;
  firstInningsLeadDraws: number;
  points: number;
  runsScored: number;
  outs: number;
  runsConceded: number;
  wicketsTaken: number;
  quotient: number;
}

const POINTS = { win: 12, inningsBonus: 6, drawLead: 4, draw: 2 };

function parseScoreRuns(score: string | null): number {
  if (!score) return 0;
  const m = score.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseScoreWkts(score: string | null): number {
  if (!score) return 0;
  const m = score.match(/\/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export async function fetchPointsTable(): Promise<TeamStanding[]> {
  const [{ data: matches, error: e1 }, { data: innings, error: e2 }, { data: logs, error: e3 }] = await Promise.all([
    supabase.from("match_history").select("*"),
    supabase.from("innings_data").select("*"),
    supabase.from("match_player_logs").select("team_name,runs_scored,outs,runs_conceded,wickets"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;

  const standings = new Map<string, TeamStanding>();
  const ensure = (t: string): TeamStanding => {
    let s = standings.get(t);
    if (!s) {
      s = {
        team: t,
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        inningsOr5wWins: 0,
        firstInningsLeadDraws: 0,
        points: 0,
        runsScored: 0,
        outs: 0,
        runsConceded: 0,
        wicketsTaken: 0,
        quotient: 0,
      };
      standings.set(t, s);
    }
    return s;
  };

  const innByMatch = new Map<string, typeof innings>();
  for (const i of innings ?? []) {
    const arr = innByMatch.get(i.match_id) ?? [];
    arr.push(i);
    innByMatch.set(i.match_id, arr);
  }

  for (const m of matches ?? []) {
    const home = ensure(m.home_team);
    const away = ensure(m.away_team);
    home.matches += 1;
    away.matches += 1;
    const won = (m.won_by ?? "").toLowerCase();
    const isInningsWin = /innings/.test(won);
    const is5wWin = /\b5w\b|5\s*wickets?/.test(won);

    if (m.winner && m.loser) {
      const w = ensure(m.winner);
      const l = ensure(m.loser);
      w.wins += 1;
      l.losses += 1;
      w.points += POINTS.win;
      if (isInningsWin || is5wWin) {
        w.inningsOr5wWins += 1;
        w.points += POINTS.inningsBonus;
      }
    } else {
      // Draw - compute 1st innings lead from innings_data
      home.draws += 1;
      away.draws += 1;
      const matchInn = innByMatch.get(m.match_id) ?? [];
      // First innings is identified by inn1_score on a team's row
      const homeFirst = matchInn.find((x) => x.batting_team === m.home_team)?.inn1_score;
      const awayFirst = matchInn.find((x) => x.batting_team === m.away_team)?.inn1_score;
      const hr = parseScoreRuns(homeFirst ?? null);
      const ar = parseScoreRuns(awayFirst ?? null);
      if (hr > ar) {
        home.firstInningsLeadDraws += 1;
        home.points += POINTS.drawLead;
        away.points += POINTS.draw;
      } else if (ar > hr) {
        away.firstInningsLeadDraws += 1;
        away.points += POINTS.drawLead;
        home.points += POINTS.draw;
      } else {
        home.points += POINTS.draw;
        away.points += POINTS.draw;
      }
    }
  }

  for (const l of logs ?? []) {
    const s = ensure(l.team_name);
    s.runsScored += l.runs_scored ?? 0;
    s.outs += l.outs ?? 0;
    s.runsConceded += l.runs_conceded ?? 0;
    s.wicketsTaken += l.wickets ?? 0;
  }

  for (const s of standings.values()) {
    const bat = s.outs > 0 ? s.runsScored / s.outs : s.runsScored > 0 ? Infinity : 0;
    const bowl = s.wicketsTaken > 0 ? s.runsConceded / s.wicketsTaken : 0;
    s.quotient = bowl > 0 && isFinite(bat) ? bat / bowl : 0;
  }

  const arr = Array.from(standings.values());
  arr.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.inningsOr5wWins !== a.inningsOr5wWins) return b.inningsOr5wWins - a.inningsOr5wWins;
    if (b.firstInningsLeadDraws !== a.firstInningsLeadDraws) return b.firstInningsLeadDraws - a.firstInningsLeadDraws;
    if (b.quotient !== a.quotient) return b.quotient - a.quotient;
    return b.draws - a.draws;
  });
  return arr;
}

// Phase-split leaderboard with per-phase runs for tie-breakers.
export interface BattingLeader {
  player_name: string;
  team_name: string;
  overall_runs: number;
  normal_runs: number;
  crazy_runs: number;
  outs: number;
  low_boundaries: number;
  high_boundaries: number;
  ten_squares: number;
  avg: number;
}
export interface BowlingLeader {
  player_name: string;
  team_name: string;
  wickets: number;
  runs_conceded: number;
  balls_bowled: number;
  maidens: number;
  econ: number;
  avg: number;
  sr: number;
}

export async function fetchPhaseSplitLeaders(filter: "Overall" | "Normal" | "Crazy") {
  const { data, error } = await supabase.from("match_player_logs").select("*");
  if (error) throw error;
  const batMap = new Map<string, BattingLeader>();
  const bowlMap = new Map<string, BowlingLeader>();
  for (const r of data ?? []) {
    if (filter !== "Overall" && r.phase !== filter) continue;
    const key = `${r.player_name}__${r.team_name}`;
    let b = batMap.get(key);
    if (!b) {
      b = {
        player_name: r.player_name,
        team_name: r.team_name,
        overall_runs: 0,
        normal_runs: 0,
        crazy_runs: 0,
        outs: 0,
        low_boundaries: 0,
        high_boundaries: 0,
        ten_squares: 0,
        avg: 0,
      };
      batMap.set(key, b);
    }
    b.overall_runs += r.runs_scored ?? 0;
    if (r.phase === "Normal") b.normal_runs += r.runs_scored ?? 0;
    if (r.phase === "Crazy") b.crazy_runs += r.runs_scored ?? 0;
    b.outs += r.outs ?? 0;
    b.low_boundaries += r.low_boundaries ?? 0;
    b.high_boundaries += r.high_boundaries ?? 0;
    b.ten_squares += r.ten_squares ?? 0;

    let bw = bowlMap.get(key);
    if (!bw) {
      bw = {
        player_name: r.player_name,
        team_name: r.team_name,
        wickets: 0,
        runs_conceded: 0,
        balls_bowled: 0,
        maidens: 0,
        econ: 0,
        avg: 0,
        sr: 0,
      };
      bowlMap.set(key, bw);
    }
    bw.wickets += r.wickets ?? 0;
    bw.runs_conceded += r.runs_conceded ?? 0;
    bw.balls_bowled += r.balls_bowled ?? 0;
    bw.maidens += r.maidens ?? 0;
  }
  const batters = Array.from(batMap.values())
    .filter((b) => b.overall_runs > 0 || b.outs > 0)
    .map((b) => ({ ...b, avg: b.outs > 0 ? b.overall_runs / b.outs : b.overall_runs }));
  batters.sort(
    (a, b) =>
      b.overall_runs - a.overall_runs ||
      b.crazy_runs - a.crazy_runs ||
      b.normal_runs - a.normal_runs ||
      b.avg - a.avg ||
      a.outs - b.outs,
  );
  const bowlers = Array.from(bowlMap.values())
    .filter((b) => b.balls_bowled > 0)
    .map((b) => {
      const overs = b.balls_bowled / 6;
      return {
        ...b,
        econ: overs > 0 ? b.runs_conceded / overs : Infinity,
        avg: b.wickets > 0 ? b.runs_conceded / b.wickets : Infinity,
        sr: b.wickets > 0 ? b.balls_bowled / b.wickets : Infinity,
      };
    });
  bowlers.sort(
    (a, b) =>
      b.wickets - a.wickets || a.econ - b.econ || a.avg - b.avg || a.sr - b.sr,
  );
  return { batters, bowlers };
}
