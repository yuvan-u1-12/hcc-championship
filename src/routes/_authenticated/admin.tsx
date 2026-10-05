import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { checkIsAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { isAdmin } = await checkIsAdmin();
    if (!isAdmin) throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "Admin Dashboard — HCC" },
      { name: "description", content: "HCC administrator dashboard." },
      { property: "og:title", content: "Admin Dashboard — HCC" },
      { property: "og:description", content: "HCC administrator dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const SECTIONS = [
  { id: "tournament", label: "Tournament", icon: "🏆", desc: "Tournament setup and management will live here." },
  { id: "fixtures", label: "Fixtures", icon: "📅", desc: "Create and approve official tournament fixtures here." },
  { id: "matches", label: "Matches", icon: "🏏", desc: "Review official and practice match records here." },
  { id: "teams", label: "Teams & Players", icon: "👥", desc: "Manage teams, players, and captain designations here." },
  { id: "stats", label: "Stats", icon: "📊", desc: "Player and team statistics tools will live here." },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function AdminPage() {
  const navigate = useNavigate();
  const [section, setSection] = useState<SectionId>("tournament");
  const active = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-black text-zinc-950">HCC ADMIN</span>
          <h1 className="text-lg font-bold">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
            View site
          </Link>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col sm:flex-row">
        <nav className="flex gap-1 overflow-x-auto border-b border-zinc-800 p-2 sm:w-56 sm:flex-col sm:border-b-0 sm:border-r">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm ${
                section === s.id
                  ? "bg-amber-500/15 font-semibold text-amber-400"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>

        <main className="flex-1 p-6">
          <h2 className="text-xl font-bold">
            {active.icon} {active.label}
          </h2>
          <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
            <p className="text-2xl font-black text-zinc-500">Coming soon</p>
            <p className="mt-2 text-sm text-zinc-500">{active.desc}</p>
          </div>
        </main>
      </div>
    </div>
  );
}
