import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/players/$playerId")({
  head: () => ({
    meta: [
      { title: "HCC Player Profile" },
      { name: "description", content: "HCC player profile: team, role, Base OVR, Current OVR and separate attributes." },
      { property: "og:title", content: "HCC Player Profile" },
      { property: "og:description", content: "HCC player profile and attributes." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

type P = Tables<"hcc_players">;
type T = Tables<"hcc_teams">;
const show = (v: string | number | null) => (v ?? "—");

function ProfilePage() {
  const { playerId } = Route.useParams();
  const [player, setPlayer] = useState<P | null>(null);
  const [team, setTeam] = useState<T | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");

  useEffect(() => {
    setState("loading");
    supabase.from("hcc_players").select("*").eq("id", playerId).maybeSingle().then(async ({ data, error }) => {
      if (error) return setState("error");
      if (!data) return setState("missing");
      setPlayer(data);
      if (data.team_id) {
        const t = await supabase.from("hcc_teams").select("*").eq("id", data.team_id).maybeSingle();
        setTeam(t.data ?? null);
      } else setTeam(null);
      setState("ok");
    });
  }, [playerId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-950 to-indigo-950 text-white">
      <header className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-2xl font-black">🏏 HCC <span className="text-emerald-400">Player Profile</span></h1>
        <Link to="/players" className="text-sm text-white/70 hover:text-white">← All players</Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        {state === "loading" && <p className="text-white/50 text-sm">Loading…</p>}
        {state === "missing" && <p className="text-white/70">Player not found.</p>}
        {state === "error" && <p className="text-red-400">Couldn't load this player. Please try again.</p>}
        {state === "ok" && player && (
          <>
            <section className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-5 py-4" style={team ? { background: team.color ?? undefined, color: team.accent ?? undefined } : undefined}>
                <div className="text-xs opacity-80">{team ? team.name : "No team"}</div>
                <div className="text-3xl font-black">
                  {player.name}
                  {player.is_captain && <span className="ml-2 text-sm">(C)</span>}
                  {player.is_vice_captain && <span className="ml-2 text-sm">(VC)</span>}
                </div>
                <div className="text-sm opacity-90">{player.role}</div>
              </div>
              <div className="bg-white/5 px-5 py-3 text-xs text-white/60 flex flex-wrap gap-x-6 gap-y-1">
                <span>Current team: <b className="text-white/90">{team ? team.name : "—"}</b></span>
                <span>Home Venue: <b className="text-white/90">{show(player.home_venue)}</b></span>
                <span>Player ID: <span className="font-mono">{player.id}</span></span>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="font-bold mb-1">Overall rating</h2>
              <p className="text-xs text-white/50 mb-4">Base OVR is long-term ability. Current OVR is the player's present level. They are tracked separately.</p>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Base OVR" sub="Long-term ability" value={show(player.base_ovr)} />
                <Stat label="Current OVR" sub="Present level" value={show(player.current_ovr)} highlight />
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="font-bold mb-1">Separate attributes</h2>
              <p className="text-xs text-white/50 mb-4">These are independent attributes. They are not part of OVR.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Confidence" sub="Execution reliability" value={show(player.confidence)} />
                <Stat label="Risk" sub="Aggressiveness" value={show(player.risk)} />
                <Stat label="Fielding" sub="Defensive actions" value={show(player.fielding)} />
                <Stat label="Captaincy" sub="Tactical decisions" value={show(player.captaincy)} />
              </div>
            </section>

            <p className="text-xs text-amber-300/80">
              {player.ratings_are_placeholder
                ? "Ratings shown are not official HCC ratings yet. \"—\" means not set."
                : "Official HCC ratings."}
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, sub, value, highlight }: { label: string; sub: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-black/20"}`}>
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-[10px] text-white/40">{sub}</div>
    </div>
  );
}
