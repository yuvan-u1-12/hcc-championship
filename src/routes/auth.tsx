import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminLogin, checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin Login — Hand Cricket Championship" },
      { name: "description", content: "Sign in to the HCC admin area." },
      { property: "og:title", content: "Admin Login — Hand Cricket Championship" },
      { property: "og:description", content: "Sign in to the HCC admin area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";
const btn = "w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50";

function AuthPage() {
  const navigate = useNavigate();
  const login = useServerFn(adminLogin);
  const check = useServerFn(checkIsAdmin);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in as admin? Go straight to the admin area.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      check().then((r) => { if (r.isAdmin) navigate({ to: "/admin" }); }).catch(() => {});
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const r = await login({ data: { code } });
      if (!r.ok) { setMsg("Incorrect admin password."); setBusy(false); return; }
      const { error } = await supabase.auth.setSession({
        access_token: r.session.access_token,
        refresh_token: r.session.refresh_token,
      });
      if (error) { setMsg("Something went wrong. Try again."); setBusy(false); return; }
      navigate({ to: "/admin" });
    } catch { setMsg("Something went wrong. Try again."); }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold text-foreground">Admin Login</h1>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">Enter the admin password to continue.</p>
          <input className={input} type="password" placeholder="Admin password" required value={code} onChange={(e) => setCode(e.target.value)} />
          <button className={btn} disabled={busy}>Log in</button>
        </form>
        {msg && <p className="mt-3 text-sm text-destructive">{msg}</p>}
        <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground underline">Back to game</Link>
      </div>
    </div>
  );
}
