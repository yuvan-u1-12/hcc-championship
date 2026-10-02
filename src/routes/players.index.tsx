import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/players/")({
  head: () => ({
    meta: [
      { title: "HCC Players Database" },
      { name: "description", content: "Browse HCC players by team with Current OVR, confidence, fielding, captaincy and home venue." },
      { property: "og:title", content: "HCC Players Database" },
      { property: "og:description", content: "Browse HCC players by team and view player profiles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayersPage,
});

type P = Tables<"hcc_players">;
type T = Tables<"hcc_teams">;
const COLS: [keyof P, string][] = [
  ["current_ovr", "Current OVR"],
  ["confidence", "Confidence"],
  ["fielding", "Fielding"],
  ["captaincy", "Captaincy"],
  ["home_venue", "Home Venue"],
];

function PlayersPage() {
  const [teams, setTeams] = useState<T[]>([]);
  const [players, setPlayers] = useState<P[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("hcc_teams").select("*").order("sort_order"),
      supabase.from("hcc_players").select("*").order("squad_order"),
    ]).then(([t, p]) => {
      if (t.error || p.error) setErr((t.error || p.error)!.message);
      setTeams(t.data ?? []);
      setPlayers(p.data ?? []);
      setLoading(false);
    });
  }, []);

  const q = search.trim().toLowerCase();
  const visible = players.filter((p) => !q || p.name.toLowerCase().includes(q));
  const teamIds = new Set(teams.map((t) => t.id));
  const groups: { id: string; team: T | null; list: P[] }[] = [
    ...teams.map((t) => ({ id: t.id, team: t, list: visible.filter((p) => p.team_id === t.id) })),
    { id: "__none", team: null, list: visible.filter((p) => !p.team_id || !teamIds.has(p.team_id)) },
  ].filter((g) => g.list.length > 0 && (filter === "ALL" || filter === g.id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-950 to-indigo-950 text-white">
      <header className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-2xl font-black">🏏 HCC <span className="text-emerald-400">Players</span></h1>
        <Link to="/" className="text-sm text-white/70 hover:text-white">← Home</Link>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-5">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player…"
            className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-sm"
          />
          {[{ id: "ALL", name: "All teams" }, ...teams].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs border ${filter === t.id ? "bg-emerald-500 text-emerald-950 border-emerald-500 font-semibold" : "border-white/15 hover:bg-white/10"}`}
            >
              {t.name}
            </button>
          ))}
          <span className="ml-auto text-xs text-white/50">{visible.length} players</span>
        </div>
        <p className="text-xs text-amber-300/80">
          Ratings are not official yet. "—" means the value has not been set. Tap a player to open their profile.
        </p>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        {loading && <p className="text-white/50 text-sm">Loading players…</p>}
        {groups.map((g) => (
          <section key={g.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-x-auto">
            <h2
              className="px-4 py-2 font-bold flex items-center justify-between"
              style={g.team ? { background: g.team.color ?? undefined, color: g.team.accent ?? undefined } : undefined}
            >
              <span>{g.team ? g.team.name : "No team"}</span>
              <span className="text-[10px] opacity-80">{g.list.length} players{g.team ? ` · ${g.team.season}` : ""}</span>
            </h2>
            <table className="w-full text-sm">
              <thead className="text-white/50 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Player</th>
                  <th className="text-left px-3">Role</th>
                  {COLS.map(([, l]) => <th key={l} className="px-3 text-center whitespace-nowrap">{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {g.list.map((p) => {
                  const isCap = !!g.team && g.team.captain_player_id === p.id;
                  return (
                  <tr key={p.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-3 py-1.5">
                      <Link to="/players/$playerId" params={{ playerId: p.id }} className="hover:text-emerald-300 font-medium">
                        {p.name}
                      </Link>
                      {isCap && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-400 text-amber-950 text-[10px] font-bold">CAPTAIN</span>}
                      {p.is_vice_captain && <span className="ml-1 text-[10px] text-amber-300">VC</span>}
                    </td>
                    <td className="px-3 text-white/70 whitespace-nowrap">{p.role}</td>
                    {COLS.map(([k]) => (
                      <td key={k} className="px-3 text-center text-white/80">
                        {k === "captaincy" && !isCap ? "—" : ((p[k] as string | number | null) ?? "—")}
                      </td>
                    ))}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </main>
    </div>
  );
}
