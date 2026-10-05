import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "admin@hcc.local";

function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// Password-only admin login. The admin password never leaves the server:
// the client sends it here, we verify it, then sign in a server-managed
// admin account and return its session for the browser to store.
export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const secret = process.env["HCC_ADMIN_PASSWORD"];
    if (!secret) throw new Error("Admin login is not configured");
    if (!safeEqual(data.code, secret)) {
      await new Promise((r) => setTimeout(r, 800));
      return { ok: false as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ensure the server-managed admin auth user exists (email is auto-confirmed).
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: secret,
      email_confirm: true,
    });
    if (createErr && !/already|exists|registered/i.test(createErr.message)) {
      throw new Error("Could not prepare admin account");
    }
    const adminUserId = created?.user?.id;
    if (adminUserId) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: adminUserId, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    }

    // Sign in as the admin account and hand the session to the browser.
    const { data: sessionData, error: signInErr } = await supabaseAdmin.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: secret,
    });
    if (signInErr || !sessionData.session) throw new Error("Admin sign-in failed");
    return {
      ok: true as const,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      },
    };
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: data === true };
  });
