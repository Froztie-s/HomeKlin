import { z } from "zod";
import { recordingLink, RecordingLinkError } from "@/lib/recordings/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// A recording's short-lived link (T14): GET /api/recordings/<recording id>/link, for the signed-in
// viewer's own session cookies. The proxy skips /api (src/proxy.ts), so this checks access itself:
// 401 without a session; 404 for an id that is not a recording, or one this viewer may not see
// (the same answer, so nobody learns which recordings exist); 410 once it has expired; 503 when the
// database or storage fails. The answer is never cached: it is personal and stops working within
// 10 minutes. The replay page (T15) uses the same recordingLink on the server.
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md

const recordingId = z.uuid();

function reply(status: number, body: Record<string, string>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = recordingId.safeParse((await params).id);

  try {
    const viewer = await createSupabaseServerClient({ writeCookies: false });
    const { data } = await viewer.auth.getClaims();
    if (!data?.claims) return reply(401, { error: "sign_in_required" });
    if (!id.success) return reply(404, { error: "recording_not_found" });

    const link = await recordingLink(viewer, createSupabaseServiceClient(), id.data);
    return reply(200, link);
  } catch (cause) {
    if (cause instanceof RecordingLinkError && cause.reason) {
      return reply(cause.reason === "recording_expired" ? 410 : 404, { error: cause.reason });
    }
    console.error("[recordings] could not make a link for %s:", id.data ?? "an invalid id", cause);
    return reply(503, { error: "unavailable" });
  }
}
