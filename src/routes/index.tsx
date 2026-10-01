import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { TEAMS } from "@/lib/teams";
import { saveSide } from "@/lib/storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HCC — Hand Cricket Championship" },
      { name: "description", content: "Real-time multiplayer 4-innings hand cricket." },
    ],
  }),
  component: Lobby,
});

function genRoom() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

function Lobby() {
  const navigate = useNavigate();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");

  const create = () => {
    if (!teamId) return;
    const code = genRoom();
    saveSide(code, "host", teamId);
    navigate({ to: "/room/$code", params: { code } });
  };
  const join = () => {
    if (!teamId || !joinCode.trim()) return;
    const code = joinCode.trim().toUpperCase();
    saveSide(code, "away", teamId);
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
        </div>

      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8 max-w-6xl mx-auto w-full">
        <h2 className="text-lg font-semibold mb-3">1. Pick your team</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          {TEAMS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTeamId(t.id)}
              className={`rounded-xl p-4 text-left border-2 transition-all ${
                teamId === t.id
                  ? "border-emerald-400 scale-105 shadow-lg shadow-emerald-500/30"
                  : "border-white/10 hover:border-white/30"
              }`}
              style={{ background: `linear-gradient(135deg, ${t.color}, ${t.accent})` }}
            >
              <div className="text-2xl font-black drop-shadow">{t.id}</div>
              <div className="text-[10px] mt-1 opacity-80">{t.players[0].name}</div>
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-bold mb-2">Create Room</h3>
            <p className="text-sm text-white/60 mb-4">
              You'll be the <b>Home Team</b> and host the toss coin.
            </p>
            <button
              disabled={!teamId}
              onClick={create}
              className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 font-semibold text-emerald-950"
            >
              Create Room
            </button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-bold mb-2">Join Room</h3>
            <p className="text-sm text-white/60 mb-4">
              You'll be the <b>Away Team</b> and call the toss.
            </p>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="ROOM CODE"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 mb-3 uppercase tracking-widest"
            />
            <button
              disabled={!teamId || !joinCode.trim()}
              onClick={join}
              className="w-full py-3 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30 font-semibold"
            >
              Join Room
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
