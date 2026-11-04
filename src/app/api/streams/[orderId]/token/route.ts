import { z } from "zod";
import { jobRoom, livekitConfig, livekitToken } from "@/lib/stream/livekit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// A LiveKit token for one job's room (T31): GET /api/streams/<order id>/token for the signed-in user.
// The job's cleaner, while the job is in progress, gets a token that may publish (can_publish_stream());
// a viewer the stream rules let in (stream_for_viewer(): the job's customer during the job, its agency,
// admin) gets one that may only watch. Everyone else gets 404, the same as for a job without a stream,
// so nobody can probe for rooms. 401 without a session, 503 while LiveKit is not set up (the demo clip
// source is used then). Never cached; the token lasts 10 minutes.

const orderId = z.uuid();

function reply(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const id = orderId.safeParse((await params).orderId);
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    const { data } = await client.auth.getClaims();
    const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    if (!userId) return reply(401, { error: "sign_in_required" });
    if (!id.success) return reply(404, { error: "stream_not_found" });

    const config = livekitConfig();
    if (!config) return reply(503, { error: "not_configured" });

    const publish = await client.rpc("can_publish_stream", { p_order: id.data });
    if (publish.error) throw new Error(publish.error.message);
    const canPublish = publish.data === true;
    if (!canPublish) {
      const view = await client.rpc("stream_for_viewer", { p_order: id.data });
      if (view.error) {
        if (view.error.message === "stream_not_found") return reply(404, { error: "stream_not_found" });
        throw new Error(view.error.message);
      }
    }

    const token = livekitToken(config, { identity: userId, room: jobRoom(id.data), canPublish });
    return reply(200, { serverUrl: config.serverUrl, token, canPublish });
  } catch (cause) {
    console.error("[streams] could not make a LiveKit token for %s:", id.data ?? "an invalid id", cause);
    return reply(503, { error: "unavailable" });
  }
}
