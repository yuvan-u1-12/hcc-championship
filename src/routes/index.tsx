import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PRACTICE_HOME_ID, PRACTICE_AWAY_ID } from "@/lib/teams";
import { saveSide } from "@/lib/storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HCC — Hand Cricket Championship" },
      { name: "description", content: "Real-time multiplayer 4-innings hand cricket." },
      { property: "og:title", content: "HCC — Hand Cricket Championship" },
      { property: "og:description", content: "Real-time multiplayer 4-innings hand cricket." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Lobby,
});


function genRoom() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

function Lobby() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"practice" | "tournament">("practice");

  // Practice always uses the fixed Practice Home / Away squads.
  const create = () => {
    const code = genRoom();
    saveSide(code, "host", PRACTICE_HOME_ID);
    navigate({ to: "/room/$code", params: { code } });
  };
  const join = () => {
    if (!joinCode.trim()) return;
    const code = joinCode.trim().toUpperCase();
    saveSide(code, "away", PRACTICE_AWAY_ID);
    navigate({ to: "/room/$code", params: { code } });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-950 via-slate-950 to-indigo-950 text-white">
      <header className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">
          🏏 HCC <span className="text-emerald-400">Pure Match Engine</span>
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/players" className="text-sm px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10">Players</Link>
          <Link to="/auth" className="text-sm px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10">Admin</Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8 max-w-6xl mx-auto w-full">
        <h2 className="text-lg font-semibold mb-3">Choose match mode</h2>
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setMode("practice")}
            className={`rounded-xl p-4 text-left border-2 ${mode === "practice" ? "border-emerald-400 bg-emerald-500/10" : "border-white/10 hover:border-white/30"}`}
          >
            <div className="font-bold">Practice</div>
            <div className="text-xs text-white/60">Fixed Practice Home vs Practice Away squads. Not part of the tournament.</div>
          </button>
          <button
            onClick={() => setMode("tournament")}
            className={`rounded-xl p-4 text-left border-2 ${mode === "tournament" ? "border-amber-400 bg-amber-500/10" : "border-white/10 hover:border-white/30"}`}
          >
            <div className="font-bold">Tournament</div>
            <div className="text-xs text-white/60">Play as your admin-assigned tournament player and team.</div>
          </button>
        </div>

        {mode === "tournament" ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <h3 className="font-bold">Tournament player sign-in</h3>
            <ol className="text-sm text-white/70 list-decimal pl-5 space-y-1">
              <li>Claim your assigned player once, using the code given by the admin.</li>
              <li>Set a PIN — use it to return to your player next time.</li>
              <li>Enter the match code to join your scheduled match.</li>
            </ol>
            <p className="text-xs text-white/50">Your team is assigned by the admin and can't be changed here.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <button disabled className="py-3 rounded-lg bg-amber-500/80 font-semibold text-amber-950 disabled:opacity-40">I have a claim code</button>
              <button disabled className="py-3 rounded-lg border border-white/20 font-semibold disabled:opacity-40">Sign in with PIN</button>
            </div>
            <p className="text-sm font-semibold text-amber-300">Tournament sign-in is coming soon.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="font-bold mb-2">Create Practice Room</h3>
              <p className="text-sm text-white/60 mb-4">You'll play as <b>Practice Home</b> and host the toss.</p>
              <button onClick={create} className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 font-semibold text-emerald-950">
                Create Room
              </button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="font-bold mb-2">Join Practice Room</h3>
              <p className="text-sm text-white/60 mb-4">You'll play as <b>Practice Away</b> and call the toss.</p>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="ROOM CODE"
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 mb-3 uppercase tracking-widest"
              />
              <button
                disabled={!joinCode.trim()}
                onClick={join}
                className="w-full py-3 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30 font-semibold"
              >
                Join Room
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
