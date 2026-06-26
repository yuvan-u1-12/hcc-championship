import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchMatchFeed, type MatchFeedItem } from "@/lib/api/historical";

export const Route = createFileRoute("/matches")({
  component: MatchesPage,
});

function MatchCard({ m }: { m: MatchFeedItem }) {
  const inn = m.innings;
  // Team A = home (1st & 3rd innings), Team B = away (2nd & 4th innings)
  // innings_data rows are per batting team, so we present home vs away lines.
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-xs text-white/50">
            {new Date(m.created_at).toLocaleDateString()}
          </div>
          <div className="text-lg font-bold">
            {m.home_team} <span className="text-white/40">vs</span> {m.away_team}
          </div>
        </div>
        <div className="text-right">
          {m.winner ? (
            <div className="text-emerald-300 font-bold">{m.winner} won</div>
          ) : (
            <div className="text-amber-300 font-bold">Draw</div>
          )}
          {m.won_by && <div className="text-xs text-white/60">by {m.won_by}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div className="bg-black/30 rounded p-2">
          <div className="text-xs text-white/50 mb-1">{m.home_team} (1st & 3rd)</div>
          <div className="font-mono">
            {inn ? `${inn.inn1_score ?? "—"} & ${inn.inn3_score ?? "—"}` : "—"}
          </div>
        </div>
        <div className="bg-black/30 rounded p-2">
          <div className="text-xs text-white/50 mb-1">{m.away_team} (2nd & 4th)</div>
          <div className="font-mono">
            {inn ? `${inn.inn2_score ?? "—"} & ${inn.inn4_score ?? "—"}` : "—"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-white/60">
        <div>
          <span className="text-white/40">POTM:</span>{" "}
          <span className="text-white font-semibold">{m.potm ?? "—"}</span>
        </div>
        <div>
          <span className="text-white/40">Aggregate:</span>{" "}
          <span className="font-mono">{inn?.match_aggregate ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}

function MatchesPage() {
  const [rows, setRows] = useState<MatchFeedItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatchFeed()
      .then(setRows)
      .catch((e) => setErr(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h1 className="text-3xl font-black">🎬 Match Center</h1>
          <a href="/" className="ml-auto text-sm px-3 py-1.5 rounded bg-white/10 hover:bg-white/20">
            ← Home
          </a>
        </div>

        {loading && <div className="text-white/60">Loading…</div>}
        {err && <div className="text-red-400">Error: {err}</div>}
        {!loading && !err && rows.length === 0 && (
          <div className="text-white/50">No matches yet. Import some via /admin.</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((m) => (
            <MatchCard key={m.match_id} m={m} />
          ))}
        </div>
      </div>
    </div>
  );
}
