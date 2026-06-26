import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  fetchPhaseSplitLeaders,
  type BattingLeader,
  type BowlingLeader,
} from "@/lib/api/historical";

type Filter = "Overall" | "Normal" | "Crazy";

export const Route = createFileRoute("/leaderboards")({
  component: LeaderboardsPage,
});

const FILTERS: Filter[] = ["Overall", "Normal", "Crazy"];

function fmt(n: number, digits = 2): string {
  if (!isFinite(n)) return "—";
  return n.toFixed(digits);
}

function LeaderboardsPage() {
  const [filter, setFilter] = useState<Filter>("Overall");
  const [batting, setBatting] = useState<BattingLeader[]>([]);
  const [bowling, setBowling] = useState<BowlingLeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPhaseSplitLeaders(filter)
      .then((d) => {
        if (!cancelled) {
          setBatting(d.batters);
          setBowling(d.bowlers);
        }
      })
      .catch((e) => !cancelled && setError(e?.message ?? String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filter]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h1 className="text-3xl font-black">🏆 Leaderboards</h1>
          <a href="/" className="ml-auto text-sm px-3 py-1.5 rounded bg-white/10 hover:bg-white/20">
            ← Home
          </a>
        </div>

        <div className="inline-flex rounded-lg bg-white/5 p-1 mb-6">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded text-sm font-semibold transition ${
                filter === f ? "bg-emerald-500 text-black" : "text-white/70 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading && <div className="text-white/60">Loading…</div>}
        {error && <div className="text-red-400">Error: {error}</div>}

        {!loading && !error && (
          <>
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-6">
              <h2 className="text-xl font-bold mb-1">
                🧢 Orange Cap — Batting · {filter}
              </h2>
              <div className="text-[11px] text-white/50 mb-3">
                Sort: Overall Runs ↓ → Crazy Runs ↓ → Normal Runs ↓ → Avg ↓ → Outs ↑
              </div>
              {batting.length === 0 ? (
                <div className="text-white/50 text-sm">No batting data yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-white/60 text-left">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">Player</th>
                        <th className="p-2">Team</th>
                        <th className="p-2 text-right">Runs</th>
                        <th className="p-2 text-right">Normal</th>
                        <th className="p-2 text-right">Crazy</th>
                        <th className="p-2 text-right">Outs</th>
                        <th className="p-2 text-right">Avg</th>
                        <th className="p-2 text-right">Low Bdry</th>
                        <th className="p-2 text-right">High Bdry</th>
                        <th className="p-2 text-right">10s</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batting.map((r, i) => (
                        <tr key={`${r.player_name}-${r.team_name}`} className="border-t border-white/10">
                          <td className="p-2 text-white/50">{i + 1}</td>
                          <td className="p-2 font-semibold">{r.player_name}</td>
                          <td className="p-2 text-white/70">{r.team_name}</td>
                          <td className="p-2 text-right font-mono font-bold">{r.overall_runs}</td>
                          <td className="p-2 text-right font-mono">{r.normal_runs}</td>
                          <td className="p-2 text-right font-mono">{r.crazy_runs}</td>
                          <td className="p-2 text-right font-mono">{r.outs}</td>
                          <td className="p-2 text-right font-mono">
                            {r.outs > 0 ? fmt(r.avg) : r.overall_runs > 0 ? `${r.overall_runs}*` : "—"}
                          </td>
                          <td className="p-2 text-right font-mono">{r.low_boundaries}</td>
                          <td className="p-2 text-right font-mono">{r.high_boundaries}</td>
                          <td className="p-2 text-right font-mono">{r.ten_squares}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-xl font-bold mb-1">
                🎯 Purple Cap — Bowling · {filter}
              </h2>
              <div className="text-[11px] text-white/50 mb-3">
                Sort: Wickets ↓ → Econ ↑ → Avg ↑ → SR ↑
              </div>
              {bowling.length === 0 ? (
                <div className="text-white/50 text-sm">No bowling data yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-white/60 text-left">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">Player</th>
                        <th className="p-2">Team</th>
                        <th className="p-2 text-right">Overs</th>
                        <th className="p-2 text-right">Wkts</th>
                        <th className="p-2 text-right">Runs</th>
                        <th className="p-2 text-right">Maidens</th>
                        <th className="p-2 text-right">Avg</th>
                        <th className="p-2 text-right">SR</th>
                        <th className="p-2 text-right">Econ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bowling.map((r, i) => {
                        const overs = `${Math.floor(r.balls_bowled / 6)}.${r.balls_bowled % 6}`;
                        return (
                          <tr key={`${r.player_name}-${r.team_name}`} className="border-t border-white/10">
                            <td className="p-2 text-white/50">{i + 1}</td>
                            <td className="p-2 font-semibold">{r.player_name}</td>
                            <td className="p-2 text-white/70">{r.team_name}</td>
                            <td className="p-2 text-right font-mono">{overs}</td>
                            <td className="p-2 text-right font-mono font-bold">{r.wickets}</td>
                            <td className="p-2 text-right font-mono">{r.runs_conceded}</td>
                            <td className="p-2 text-right font-mono">{r.maidens}</td>
                            <td className="p-2 text-right font-mono">{r.wickets > 0 ? fmt(r.avg) : "—"}</td>
                            <td className="p-2 text-right font-mono">{r.wickets > 0 ? fmt(r.sr) : "—"}</td>
                            <td className="p-2 text-right font-mono">{isFinite(r.econ) ? fmt(r.econ) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
