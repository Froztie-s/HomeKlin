import type { SupabaseClient } from "@supabase/supabase-js";
import { clipFolder, pickClip, recordingsBucket } from "@/lib/recordings/attach";

// The stream source seam (T22, SPEC "Stream source seam"). The live viewer asks a source for what to
// play; the pages never know which source it is. The demo source plays a pre-recorded clip from the
// library as the "live" feed, the same clip for the same job, through a signed link that works for 10
// minutes. A LiveKit source (T31-T32) answers with a room token instead, and the database already has
// a session per job with its source, so swapping needs no page or rule change.

export type StreamView = { kind: "video"; url: string; expiresInSeconds: number } | { kind: "livekit"; serverUrl: string; token: string };

export interface StreamSource {
  readonly id: "demo" | "livekit";
  /** What a viewer allowed to see this job's stream plays. Call only after stream_for_viewer(). */
  view(orderId: string): Promise<StreamView>;
}

export class StreamSourceError extends Error {
  constructor(message: string) {
    super(`The stream is not available: ${message}`);
    this.name = "StreamSourceError";
  }
}

export const demoLinkSeconds = 600;

/** The demo source: a library clip, chosen by job, signed with the server's key. */
export function demoStreamSource(server: SupabaseClient): StreamSource {
  return {
    id: "demo",
    async view(orderId) {
      const files = server.storage.from(recordingsBucket);
      const { data, error } = await files.list(clipFolder, { limit: 100 });
      if (error) throw new StreamSourceError(error.message);
      const clip = pickClip(
        data.map((file) => file.name).filter((name) => /\.(mp4|webm)$/.test(name)),
        orderId,
      );
      if (!clip) throw new StreamSourceError("the clip library is empty");
      const signed = await files.createSignedUrl(`${clipFolder}/${clip}`, demoLinkSeconds);
      if (signed.error || !signed.data) throw new StreamSourceError(signed.error?.message ?? "no link");
      return { kind: "video", url: signed.data.signedUrl, expiresInSeconds: demoLinkSeconds };
    },
  };
}

/** The source a session names. Only the demo source exists until T31; a LiveKit session falls back to it. */
export function streamSourceFor(sourceId: string, server: SupabaseClient): StreamSource {
  void sourceId;
  return demoStreamSource(server);
}
