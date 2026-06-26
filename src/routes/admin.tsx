import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  importInningsDataCsv,
  importMatchHistoryCsv,
  importPlayerLogsCsv,
} from "@/lib/api/historical";

export const Route = createFileRoute("/admin")({
  component: AdminImporter,
});

type Target = "match_history" | "innings_data" | "match_player_logs";

const SCHEMAS: Record<Target, { headers: string[]; example: string }> = {
  match_history: {
    headers: ["match_id", "home_team", "away_team", "winner", "loser", "potm", "won_by"],
    example:
      "match_id,home_team,away_team,winner,loser,potm,won_by\n11111111-1111-1111-1111-111111111111,CJ,TUXI,CJ,TUXI,Ruturaj Gaikwad,innings and 35 runs",
  },
  innings_data: {
    headers: [
      "match_id",
      "batting_team",
      "bowling_team",
      "inn1_score",
      "inn2_score",
      "inn3_score",
      "inn4_score",
      "match_aggregate",
    ],
    example:
      "match_id,batting_team,bowling_team,inn1_score,inn2_score,inn3_score,inn4_score,match_aggregate\n11111111-1111-1111-1111-111111111111,CJ,TUXI,335/0,,104/5,,917",
  },
  match_player_logs: {
    headers: [
      "match_id",
      "player_name",
      "team_name",
      "phase",
      "runs_scored",
      "outs",
      "low_boundaries",
      "high_boundaries",
      "ten_squares",
      "balls_bowled",
      "runs_conceded",
      "wickets",
      "maidens",
    ],
    example:
      "match_id,player_name,team_name,phase,runs_scored,outs,low_boundaries,high_boundaries,ten_squares,balls_bowled,runs_conceded,wickets,maidens\n11111111-1111-1111-1111-111111111111,Ruturaj Gaikwad,CJ,Normal,128,0,4,2,1,0,0,0,0",
  },
};

function AdminImporter() {
  const [target, setTarget] = useState<Target>("match_history");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (f: File) => {
    setText(await f.text());
  };

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const fn =
        target === "match_history"
          ? importMatchHistoryCsv
          : target === "innings_data"
          ? importInningsDataCsv
          : importPlayerLogsCsv;
      const res = await fn(text);
      setMsg(`Inserted ${res.inserted} rows into ${target}.`);
      setText("");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const schema = SCHEMAS[target];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h1 className="text-3xl font-black">📥 Historical Data Importer</h1>
          <a href="/" className="ml-auto text-sm px-3 py-1.5 rounded bg-white/10 hover:bg-white/20">
            ← Home
          </a>
        </div>

        <div className="inline-flex rounded-lg bg-white/5 p-1 mb-4 flex-wrap">
          {(Object.keys(SCHEMAS) as Target[]).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition ${
                target === t ? "bg-emerald-500 text-black" : "text-white/70 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
          <div className="text-sm text-white/70">
            <div className="font-semibold text-white mb-1">Expected headers:</div>
            <code className="block bg-black/40 rounded p-2 text-xs overflow-x-auto">
              {schema.headers.join(",")}
            </code>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              className="text-sm"
            />
            <button
              type="button"
              onClick={() => setText(schema.example)}
              className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
            >
              Load example
            </button>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste CSV here or upload a file..."
            className="w-full h-64 bg-black/40 rounded p-3 font-mono text-xs"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={submit}
              disabled={!text.trim() || busy}
              className="px-4 py-2 rounded bg-emerald-500 text-black font-bold disabled:opacity-40"
            >
              {busy ? "Inserting…" : `Insert into ${target}`}
            </button>
            {msg && <span className="text-emerald-300 text-sm">{msg}</span>}
            {err && <span className="text-red-400 text-sm">{err}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
