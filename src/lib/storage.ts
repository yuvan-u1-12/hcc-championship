import type { GameState } from "./gameTypes";

const KEY = (room: string) => `hcc:room:${room}`;
const SIDE_KEY = (room: string) => `hcc:side:${room}`;
const TEAM_KEY = (room: string) => `hcc:team:${room}`;

export function saveState(room: string, state: GameState, side?: "host" | "away" | null) {
  try {
    localStorage.setItem(KEY(room), JSON.stringify({ state, at: Date.now(), side: side ?? null }));
  } catch {}
}
export function loadState(
  room: string,
): { state: GameState; at: number; side: "host" | "away" | null } | null {
  try {
    const raw = localStorage.getItem(KEY(room));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { state: parsed.state, at: parsed.at, side: parsed.side ?? null };
  } catch {
    return null;
  }
}
export function clearState(room: string) {
  try {
    localStorage.removeItem(KEY(room));
    localStorage.removeItem(SIDE_KEY(room));
    localStorage.removeItem(TEAM_KEY(room));
  } catch {}
}
export function saveSide(room: string, side: "host" | "away", teamId: string | null) {
  try {
    localStorage.setItem(SIDE_KEY(room), side);
    if (teamId) localStorage.setItem(TEAM_KEY(room), teamId);
  } catch {}
}
export function loadSide(room: string): { side: "host" | "away" | null; teamId: string | null } {
  try {
    return {
      side: (localStorage.getItem(SIDE_KEY(room)) as any) ?? null,
      teamId: localStorage.getItem(TEAM_KEY(room)),
    };
  } catch {
    return { side: null, teamId: null };
  }
}
