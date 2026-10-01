import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/players")({
  head: () => ({
    meta: [
      { title: "HCC Players & Ratings" },
      { name: "description", content: "HCC squads with player attributes: OVR, confidence, risk, fielding, captaincy and home venue." },
      { property: "og:title", content: "HCC Players & Ratings" },
      { property: "og:description", content: "HCC squads and player attributes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayersPage,
});

type P = Tables<"hcc_players">;
type T = Tables<"hcc_teams">;
const ATTRS: [keyof P, string][] = [
  ["base_ovr", "Base OVR"],
  ["current_ovr", "Cur OVR"],
  ["confidence", "Conf"],
  ["risk", "Risk"],
  ["fielding", "Field"],
  ["captaincy", "Capt"],
  ["home_venue", "Home Venue"],
];

function PlayersPage() {
  const [teams, setTeams] = useState<T[]>([]);
  const [players, setPlayers] = useState<P[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([
      supabase.from("hcc_teams").select("*").order("sort_order"),
      supabase.from("hcc_players").select("*").order("squad_order"),
    ]).then(([t, p]) => {
      if (t.error || p.error) setErr((t.error || p.error)!.message);
      setTeams(t.data ?? []);
      setPlayers(p.data ?? []);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-950 to-indigo-950 text-white">
      <header className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-2xl font-black">🏏 HCC <span className="text-emerald-400">Players</span></h1>
        <Link to="/" className="text-sm text-white/70 hover:text-white">← Home</Link>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <p className="text-xs text-amber-300/80">
          Ratings are not official yet. Empty values ("—") have not been set; values marked "placeholder" are temporary test values.
        </p>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        {teams.map((t) => (
          <section key={t.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-x-auto">
            <h2 className="px-4 py-2 font-bold" style={{ background: t.color ?? undefined, color: t.accent ?? undefined }}>
              {t.name} <span className="text-[10px] opacity-70">({t.season})</span>
            </h2>
            <table className="w-full text-sm">
              <thead className="text-white/50 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Player</th>
                  <th className="text-left px-3">Role</th>
                  {ATTRS.map(([, l]) => <th key={l} className="px-3 text-center">{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {players.filter((p) => p.team_id === t.id).map((p) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="px-3 py-1.5">
                      {p.name}{p.is_captain && " (C)"}{p.is_vice_captain && " (VC)"}
                      {p.ratings_are_placeholder && ATTRS.some(([k]) => p[k] != null) && (
                        <span className="ml-1 text-[10px] text-amber-300">placeholder</span>
                      )}
                    </td>
                    <td className="px-3 text-white/70">{p.role}</td>
                    {ATTRS.map(([k]) => (
                      <td key={k} className="px-3 text-center text-white/80">{(p[k] as string | number | null) ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </main>
    </div>
  );
}
