import { z } from "zod";
import { streamStatus, watchStream, StreamError } from "@/lib/stream/streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// A job's live stream for the signed-in viewer (T23, T25, T29): GET /api/streams/<order id> answers what
// to play (a fresh 10-minute link from the stream source) and the status; with ?status=1 only the
// status, for the viewer page's polling. The proxy skips /api, so this checks access itself: 401
// without a session, 404 for a job this viewer may not watch or that has no live stream (the same
// answer, so nobody can probe for streams), 503 when the database or the source fails. Never cached.

const orderId = z.uuid();

function reply(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const id = orderId.safeParse((await params).orderId);
  try {
    const viewer = await createSupabaseServerClient({ writeCookies: false });
    const { data } = await viewer.auth.getClaims();
    if (!data?.claims) return reply(401, { error: "sign_in_required" });
    if (!id.success) return reply(404, { error: "stream_not_found" });

    if (new URL(request.url).searchParams.get("status") === "1") {
      const status = await streamStatus(viewer, id.data);
      return status ? reply(200, { status }) : reply(404, { error: "stream_not_found" });
    }
    const stream = await watchStream(viewer, createSupabaseServiceClient(), id.data);
    return reply(200, { status: stream.status, cleanerName: stream.cleanerName, startedAt: stream.startedAt, view: stream.view });
  } catch (cause) {
    if (cause instanceof StreamError && cause.reason) return reply(404, { error: cause.reason });
    console.error("[streams] could not open the stream of %s:", id.data ?? "an invalid id", cause);
    return reply(503, { error: "unavailable" });
  }
}
