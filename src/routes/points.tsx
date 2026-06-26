import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchPointsTable, type TeamStanding } from "@/lib/api/historical";

export const Route = createFileRoute("/points")({
  component: PointsPage,
});

const fmt = (n: number) => (isFinite(n) ? n.toFixed(3) : "—");

function PointsPage() {
  const [rows, setRows] = useState<TeamStanding[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPointsTable()
      .then(setRows)
      .catch((e) => setErr(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h1 className="text-3xl font-black">📊 Points Table</h1>
          <a href="/" className="ml-auto text-sm px-3 py-1.5 rounded bg-white/10 hover:bg-white/20">
            ← Home
          </a>
        </div>

        <div className="text-xs text-white/50 mb-3">
          Points: Win 12 · Innings/5W win bonus +6 · Draw with 1st-innings lead 4 · Draw 2 · Loss 0
        </div>

        {loading && <div className="text-white/60">Loading…</div>}
        {err && <div className="text-red-400">Error: {err}</div>}

        {!loading && !err && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-white/60 text-left">
                <tr>
                  <th className="p-2">#</th>
                  <th className="p-2">Team</th>
                  <th className="p-2 text-right">M</th>
                  <th className="p-2 text-right">W</th>
                  <th className="p-2 text-right">L</th>
                  <th className="p-2 text-right">D</th>
                  <th className="p-2 text-right">Inn/5W</th>
                  <th className="p-2 text-right">1st Inn Lead (D)</th>
                  <th className="p-2 text-right">Quotient</th>
                  <th className="p-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-3 text-white/50 text-center">
                      No matches recorded yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={r.team} className="border-t border-white/10">
                      <td className="p-2 text-white/50">{i + 1}</td>
                      <td className="p-2 font-semibold">{r.team}</td>
                      <td className="p-2 text-right font-mono">{r.matches}</td>
                      <td className="p-2 text-right font-mono">{r.wins}</td>
                      <td className="p-2 text-right font-mono">{r.losses}</td>
                      <td className="p-2 text-right font-mono">{r.draws}</td>
                      <td className="p-2 text-right font-mono">{r.inningsOr5wWins}</td>
                      <td className="p-2 text-right font-mono">{r.firstInningsLeadDraws}</td>
                      <td className="p-2 text-right font-mono">{fmt(r.quotient)}</td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-300">
                        {r.points}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
