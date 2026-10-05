import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { claimAdmin, checkIsAdmin } from "@/lib/admin.functions";

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
  const claim = useServerFn(claimAdmin);
  const check = useServerFn(checkIsAdmin);
  const [signedIn, setSignedIn] = useState<string | null>(null);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(s?.user?.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    check().then((r) => { if (r.isAdmin) navigate({ to: "/admin" }); }).catch(() => {});
  }, [signedIn]);

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const res = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth` } });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (mode === "up" && !res.data.session) setMsg("Check your email to confirm your account, then sign in.");
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const r = await claim({ data: { code } });
      if (r.ok) navigate({ to: "/admin" });
      else setMsg("Incorrect admin password.");
    } catch { setMsg("Something went wrong. Try again."); }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold text-foreground">Admin Login</h1>
        {!signedIn ? (
          <form onSubmit={submitAccount} className="mt-4 space-y-3">
            <input className={input} type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className={input} type="password" placeholder="Password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className={btn} disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</button>
            <button type="button" className="w-full text-xs text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">Signed in as {signedIn}. Enter the admin password to continue.</p>
            <input className={input} type="password" placeholder="Admin password" required value={code} onChange={(e) => setCode(e.target.value)} />
            <button className={btn} disabled={busy}>Unlock admin</button>
            <button type="button" className="w-full text-xs text-muted-foreground underline" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </form>
        )}
        {msg && <p className="mt-3 text-sm text-destructive">{msg}</p>}
        <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground underline">Back to game</Link>
      </div>
    </div>
  );
}
