import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchLeaderboard, type AggregatedStats, type LeaderboardFilter } from "@/lib/api/stats";

export const Route = createFileRoute("/leaderboards")({
  component: LeaderboardsPage,
});

const FILTERS: LeaderboardFilter[] = ["Overall", "Normal", "Crazy"];

function fmt(n: number, digits = 2): string {
  if (!isFinite(n)) return "—";
  return n.toFixed(digits);
}

function LeaderboardsPage() {
  const [filter, setFilter] = useState<LeaderboardFilter>("Overall");
  const [rows, setRows] = useState<AggregatedStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLeaderboard(filter)
      .then((d) => {
        if (!cancelled) setRows(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const batting = useMemo(() => {
    return [...rows]
      .filter((r) => r.runs > 0 || r.outs > 0 || r.low_boundaries || r.high_boundaries || r.ten_squares)
      .map((r) => ({
        ...r,
        avg: r.outs > 0 ? r.runs / r.outs : r.runs,
        avgDisplay: r.outs > 0 ? fmt(r.runs / r.outs) : r.runs > 0 ? `${r.runs}*` : "—",
      }))
      .sort((a, b) => b.runs - a.runs);
  }, [rows]);

  const bowling = useMemo(() => {
    return [...rows]
      .filter((r) => r.balls_bowled > 0)
      .map((r) => {
        const oversFloat = r.balls_bowled / 6;
        const oversDisplay = `${Math.floor(r.balls_bowled / 6)}.${r.balls_bowled % 6}`;
        const avg = r.wickets > 0 ? r.runs_conceded / r.wickets : null;
        const sr = r.wickets > 0 ? r.balls_bowled / r.wickets : null;
        const econ = oversFloat > 0 ? r.runs_conceded / oversFloat : null;
        return {
          ...r,
          oversDisplay,
          avg,
          sr,
          econ,
        };
      })
      .sort((a, b) => b.wickets - a.wickets || a.runs_conceded - b.runs_conceded);
  }, [rows]);

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
              <h2 className="text-xl font-bold mb-3">Batting · {filter}</h2>
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
                          <td className="p-2 text-right font-mono">{r.runs}</td>
                          <td className="p-2 text-right font-mono">{r.outs}</td>
                          <td className="p-2 text-right font-mono">{r.avgDisplay}</td>
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
              <h2 className="text-xl font-bold mb-3">Bowling · {filter}</h2>
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
                      {bowling.map((r, i) => (
                        <tr key={`${r.player_name}-${r.team_name}`} className="border-t border-white/10">
                          <td className="p-2 text-white/50">{i + 1}</td>
                          <td className="p-2 font-semibold">{r.player_name}</td>
                          <td className="p-2 text-white/70">{r.team_name}</td>
                          <td className="p-2 text-right font-mono">{r.oversDisplay}</td>
                          <td className="p-2 text-right font-mono">{r.wickets}</td>
                          <td className="p-2 text-right font-mono">{r.runs_conceded}</td>
                          <td className="p-2 text-right font-mono">{r.maidens}</td>
                          <td className="p-2 text-right font-mono">{r.avg === null ? "—" : fmt(r.avg)}</td>
                          <td className="p-2 text-right font-mono">{r.sr === null ? "—" : fmt(r.sr)}</td>
                          <td className="p-2 text-right font-mono">{r.econ === null ? "—" : fmt(r.econ)}</td>
                        </tr>
                      ))}
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
