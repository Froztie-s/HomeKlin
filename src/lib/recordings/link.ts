import type { SupabaseClient } from "@supabase/supabase-js";
import { recordingsBucket } from "./attach";

// A short-lived link to replay a recording (T14). Two clients, two jobs: the viewer's own session asks
// the database whether this person may see the recording (recording_for_viewer(), supabase/migrations/
// 20261103090000_recording_access.sql: the booking's customer, the owning agency, admin; never once it
// has expired). Only then does the server's client (secret key) sign a link to the private file. The
// link works for 10 minutes at most and never past the recording's expiry, so a copied link soon stops.
// Source: https://supabase.com/docs/reference/javascript/storage-from-createsignedurl

export const linkLifetimeSeconds = 600;

export type RecordingLink = {
  url: string;
  /** When the recording itself expires and is deleted (T16). */
  availableUntil: string;
};

export type RecordingLinkRefusal = "recording_not_found" | "recording_expired";

export class RecordingLinkError extends Error {
  /** Why there is no link, or null when the database or storage failed. */
  readonly reason: RecordingLinkRefusal | null;

  constructor(reason: RecordingLinkRefusal | null, message: string) {
    super(`Could not make the recording link: ${message}`);
    this.name = "RecordingLinkError";
    this.reason = reason;
  }
}

const refusals: readonly RecordingLinkRefusal[] = ["recording_not_found", "recording_expired"];

/** The seconds a link may live: 10 minutes, cut short by the recording's own expiry. */
export function linkSeconds(expiresAt: string, now: number): number {
  return Math.min(linkLifetimeSeconds, Math.floor((Date.parse(expiresAt) - now) / 1000));
}

export async function recordingLink(
  viewer: SupabaseClient,
  server: SupabaseClient,
  recordingId: string,
  now = Date.now(),
): Promise<RecordingLink> {
  const { data, error } = await viewer.rpc("recording_for_viewer", { p_recording: recordingId });
  if (error) {
    throw new RecordingLinkError(refusals.find((reason) => reason === error.message) ?? null, error.message);
  }
  const row = (data as { file_path: string; expires_at: string }[] | null)?.[0];
  if (!row) throw new RecordingLinkError(null, "the database returned no recording");

  const seconds = linkSeconds(row.expires_at, now);
  if (seconds < 1) throw new RecordingLinkError("recording_expired", "the recording expires now");

  const signed = await server.storage.from(recordingsBucket).createSignedUrl(row.file_path, seconds);
  if (signed.error || !signed.data) throw new RecordingLinkError(null, signed.error?.message ?? "no link");
  return { url: signed.data.signedUrl, availableUntil: new Date(row.expires_at).toISOString() };
}
