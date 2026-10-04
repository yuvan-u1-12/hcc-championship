import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Returns admin-approved, not-yet-played fixtures involving the given team.
export const getApprovedFixtures = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ teamId: z.string().min(1).max(32) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await db
      .from("hcc_fixtures")
      .select("id,home_team_id,away_team_id,scheduled_at,venue")
      .eq("approved", true)
      .is("match_id", null)
      .or(`home_team_id.eq.${data.teamId},away_team_id.eq.${data.teamId}`)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
