import { supabase } from "@/integrations/supabase/client";
import { buildPlayerLogRows } from "./matchStats";
import type { GameState } from "./gameTypes";

const SAVED_PREFIX = "match_saved_";

export async function saveMatchStats(roomCode: string, state: GameState): Promise<{ ok: boolean; error?: string; matchId?: string }> {
  try {
    const flagKey = SAVED_PREFIX + roomCode;
    if (typeof window !== "undefined" && window.localStorage.getItem(flagKey)) {
      return { ok: true, matchId: window.localStorage.getItem(flagKey)! };
    }
    const matchId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const rows = buildPlayerLogRows(state, matchId);
    if (rows.length === 0) return { ok: true, matchId };
    const { error } = await supabase.from("match_player_logs").insert(rows);
    if (error) return { ok: false, error: error.message };
    if (typeof window !== "undefined") window.localStorage.setItem(flagKey, matchId);
    return { ok: true, matchId };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

export interface AggregatedStats {
  player_name: string;
  team_name: string;
  // batting
  runs: number;
  outs: number;
  low_boundaries: number;
  high_boundaries: number;
  ten_squares: number;
  // bowling
  balls_bowled: number;
  runs_conceded: number;
  wickets: number;
  maidens: number;
}

export type LeaderboardFilter = "Overall" | "Normal" | "Crazy";

export async function fetchLeaderboard(filter: LeaderboardFilter): Promise<AggregatedStats[]> {
  let q = supabase.from("match_player_logs").select("*");
  if (filter !== "Overall") q = q.eq("phase", filter);
  const { data, error } = await q;
  if (error) throw error;
  const map = new Map<string, AggregatedStats>();
  for (const r of data ?? []) {
    const key = `${r.player_name}__${r.team_name}`;
    let row = map.get(key);
    if (!row) {
      row = {
        player_name: r.player_name,
        team_name: r.team_name,
        runs: 0,
        outs: 0,
        low_boundaries: 0,
        high_boundaries: 0,
        ten_squares: 0,
        balls_bowled: 0,
        runs_conceded: 0,
        wickets: 0,
        maidens: 0,
      };
      map.set(key, row);
    }
    row.runs += r.runs_scored ?? 0;
    row.outs += r.outs ?? 0;
    row.low_boundaries += r.low_boundaries ?? 0;
    row.high_boundaries += r.high_boundaries ?? 0;
    row.ten_squares += r.ten_squares ?? 0;
    row.balls_bowled += r.balls_bowled ?? 0;
    row.runs_conceded += r.runs_conceded ?? 0;
    row.wickets += r.wickets ?? 0;
    row.maidens += r.maidens ?? 0;
  }
  return Array.from(map.values());
}
