import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const side = z.enum(["host", "away"]);
const name = z.string().min(1).max(80);

const Input = z.object({
  matchId: z.string().regex(/^[A-Za-z0-9]{1,16}-\d{10,16}$/),
  roomCode: z.string().max(16),
  hostTeamId: z.string().max(32),
  awayTeamId: z.string().max(32),
  tossWinner: side.optional(),
  tossChoice: z.enum(["bat", "bowl"]).optional(),
  innings: z
    .array(
      z.object({
        innings_no: z.number().int().min(1).max(4),
        batting_side: side,
        runs: z.number().int().min(0).max(100000),
        wickets: z.number().int().min(0).max(10),
        legal_balls: z.number().int().min(0).max(1000),
        declared: z.boolean(),
        all_out: z.boolean(),
      }),
    )
    .max(4),
  events: z
    .array(
      z.object({
        id: z.string().max(80),
        innings_no: z.number().int().min(1).max(4),
        over_no: z.number().int().min(1).max(100),
        ball_no: z.number().int().min(1).max(6),
        batting_side: side,
        striker: name,
        non_striker: name.nullable(),
        bowler: name,
        phase: z.enum(["NORMAL", "CRAZY"]),
        bat_number: z.number().int().min(0).max(10),
        bowl_number: z.number().int().min(0).max(10),
        runs: z.number().int().min(0).max(100),
        is_square: z.boolean(),
        is_wicket: z.boolean(),
      }),
    )
    .max(400),
  final: z
    .object({
      winner: z.enum(["host", "away", "draw", "tie"]).optional(),
      result: z.string().max(200).optional(),
    })
    .optional(),
});

// Persists engine output (match header, innings totals, ball events).
// Idempotent: ball events use a stable id + unique (match, innings, over, ball).
export const recordMatchProgress = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    // Practice squads are not tournament identities — never persisted to tournament tables.
    if (data.hostTeamId.startsWith("PRACTICE-") || data.awayTeamId.startsWith("PRACTICE-")) return { ok: true, skipped: true };
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const teamOf = (s: "host" | "away") => (s === "host" ? data.hostTeamId : data.awayTeamId);
    const other = (s: "host" | "away") => (s === "host" ? data.awayTeamId : data.hostTeamId);

    const { data: players, error: pErr } = await db
      .from("hcc_players")
      .select("id,name,team_id")
      .in("team_id", [data.hostTeamId, data.awayTeamId]);
    if (pErr) throw new Error(pErr.message);
    if (!players?.length) throw new Error("Unknown teams");
    const idOf = (teamId: string, n: string | null) =>
      n ? players.find((p) => p.team_id === teamId && p.name === n)?.id ?? null : null;

    const { data: existing } = await db.from("hcc_matches").select("status").eq("id", data.matchId).maybeSingle();
    if (existing?.status === "completed") return { ok: true, skipped: true };

    const header = {
      id: data.matchId,
      source: "live",
      room_code: data.roomCode,
      home_team_id: data.hostTeamId,
      away_team_id: data.awayTeamId,
      toss_winner_team_id: data.tossWinner ? teamOf(data.tossWinner) : null,
      toss_choice: data.tossChoice ?? null,
      ...(data.final
        ? {
            status: "completed",
            completed_at: new Date().toISOString(),
            result_text: data.final.result ?? null,
            result_type:
              data.final.winner === "draw" || data.final.winner === "tie" ? data.final.winner : "win",
            winner_team_id:
              data.final.winner === "host" || data.final.winner === "away" ? teamOf(data.final.winner) : null,
          }
        : {}),
    };
    const m = await db.from("hcc_matches").upsert(header, { onConflict: "id" });
    if (m.error) throw new Error(m.error.message);

    if (data.innings.length) {
      const r = await db.from("hcc_innings").upsert(
        data.innings.map((i) => ({
          match_id: data.matchId,
          innings_no: i.innings_no,
          batting_team_id: teamOf(i.batting_side),
          bowling_team_id: other(i.batting_side),
          runs: i.runs,
          wickets: i.wickets,
          legal_balls: i.legal_balls,
          declared: i.declared,
          all_out: i.all_out,
        })),
        { onConflict: "match_id,innings_no" },
      );
      if (r.error) throw new Error(r.error.message);
    }

    const rows = [];
    for (const e of data.events) {
      if (e.id !== `${data.matchId}:${e.innings_no}:${e.over_no}:${e.ball_no}`) continue;
      const bat = teamOf(e.batting_side);
      const bowl = other(e.batting_side);
      const striker = idOf(bat, e.striker);
      const bowler = idOf(bowl, e.bowler);
      if (!striker || !bowler) continue;
      rows.push({
        id: e.id,
        match_id: data.matchId,
        innings_no: e.innings_no,
        over_no: e.over_no,
        ball_no: e.ball_no,
        batting_team_id: bat,
        bowling_team_id: bowl,
        striker_id: striker,
        non_striker_id: idOf(bat, e.non_striker),
        bowler_id: bowler,
        phase: e.phase,
        bat_number: e.bat_number,
        bowl_number: e.bowl_number,
        runs: e.runs,
        is_square: e.is_square,
        is_wicket: e.is_wicket,
      });
    }
    if (rows.length) {
      const r = await db.from("hcc_ball_events").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (r.error) throw new Error(r.error.message);
    }
    return { ok: true, saved: rows.length };
  });
