import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { checkIsAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { isAdmin } = await checkIsAdmin();
    if (!isAdmin) throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "Admin Area — HCC" },
      { name: "description", content: "HCC administrator area." },
      { property: "og:title", content: "Admin Area — HCC" },
      { property: "og:description", content: "HCC administrator area." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold text-foreground">Admin Area</h1>
        <p className="mt-2 text-sm text-muted-foreground">You are signed in as an admin. Admin tools will appear here.</p>
        <div className="mt-6 flex gap-2">
          <Link to="/" className="rounded-md border border-input px-4 py-2 text-sm text-foreground">Home</Link>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >Sign out</button>
        </div>
      </div>
    </div>
  );
}
