import { timingSafeEqual } from "node:crypto";
import { deleteExpiredRecordings } from "@/lib/recordings/retention";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// The daily 7-day cleanup (T16), called by Vercel Cron (vercel.json). Vercel sends the project's
// CRON_SECRET as "Authorization: Bearer <secret>", so only Vercel can start it: 503 when the secret is
// not set, 401 for anything else, 200 with the number of recordings deleted.
// Source: https://vercel.com/docs/cron-jobs/manage-cron-jobs ("Securing cron jobs")

function reply(status: number, body: Record<string, string | number>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isAuthorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[recordings] CRON_SECRET is not set: the cleanup did not run");
    return reply(503, { error: "not_configured" });
  }
  if (!isAuthorized(request.headers.get("authorization"), secret)) return reply(401, { error: "unauthorized" });

  try {
    const result = await deleteExpiredRecordings(createSupabaseServiceClient());
    console.info("[recordings] cleanup deleted %d expired recordings", result.deleted);
    return reply(200, result);
  } catch (cause) {
    console.error("[recordings] cleanup failed:", cause);
    return reply(503, { error: "unavailable" });
  }
}
