import type { GameState } from "./gameTypes";

const KEY = (room: string) => `hcc:room:${room}`;
const SIDE_KEY = (room: string) => `hcc:side:${room}`;
const TEAM_KEY = (room: string) => `hcc:team:${room}`;

export function saveState(room: string, state: GameState) {
  try {
    localStorage.setItem(KEY(room), JSON.stringify({ state, at: Date.now() }));
  } catch {}
}
export function loadState(room: string): { state: GameState; at: number } | null {
  try {
    const raw = localStorage.getItem(KEY(room));
    if (!raw) return null;
    return JSON.parse(raw);
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
  localStorage.setItem(SIDE_KEY(room), side);
  if (teamId) localStorage.setItem(TEAM_KEY(room), teamId);
}
export function loadSide(room: string): { side: "host" | "away" | null; teamId: string | null } {
  return {
    side: (localStorage.getItem(SIDE_KEY(room)) as any) ?? null,
    teamId: localStorage.getItem(TEAM_KEY(room)),
  };
}
