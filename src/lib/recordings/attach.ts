import type { SupabaseClient } from "@supabase/supabase-js";

// Attaches a recording to a finished job (T13). This is the one seam SPEC asks for: the demo gives the
// job a copy of a pre-recorded clip, and a real capture could replace this function later. T18 calls it
// at check-out, with the server's own client (createSupabaseServiceClient): the bucket and the database
// function are closed to everyone else (supabase/migrations/20261101090000_recordings.sql).
// Each job gets its own copy, so T16 can delete it after 7 days without touching the clip library.

export const recordingsBucket = "recordings";
/** The folder of the bucket that holds the demo clips (npm run db:seed copies them there). */
export const clipFolder = "library";
export const recordingRetentionDays = 7;

export type Recording = { id: string; filePath: string; expiresAt: string };

export type RecordingRefusal = "no_clips" | "order_not_found" | "order_not_paid" | "retention_invalid";

const refusals: readonly RecordingRefusal[] = ["order_not_found", "order_not_paid", "retention_invalid"];

export class RecordingError extends Error {
  /** Why the job got no recording, or null when storage or the database failed. */
  readonly reason: RecordingRefusal | null;

  constructor(reason: RecordingRefusal | null, message: string) {
    super(`Could not attach the recording: ${message}`);
    this.name = "RecordingError";
    this.reason = reason;
  }
}

/** The library's clip for this order; the same one every time, so a repeat copies the same file. */
export function pickClip(clips: readonly string[], orderId: string): string | null {
  if (clips.length === 0) return null;
  const sorted = [...clips].sort();
  return sorted[Number.parseInt(orderId.slice(0, 8), 16) % sorted.length] ?? null;
}

/** Where a job's copy of a clip lives in the bucket. */
export function recordingPath(orderId: string, clip: string): string {
  return `jobs/${orderId}.${clip.slice(clip.lastIndexOf(".") + 1)}`;
}

async function listClips(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.storage.from(recordingsBucket).list(clipFolder, { limit: 100 });
  if (error) throw new RecordingError(null, error.message);
  // Storage lists a placeholder in an emptied folder; only real clips end in a video type.
  return data.map((file) => file.name).filter((name) => /\.(mp4|webm)$/.test(name));
}

/**
 * Gives a paid job its recording, or returns the one it has. The row comes first, so an order that may
 * not have one leaves no file behind, and a copy that failed is simply repeated by the next call.
 */
export async function attachRecording(
  client: SupabaseClient,
  orderId: string,
  { retentionDays = recordingRetentionDays }: { retentionDays?: number } = {},
): Promise<Recording> {
  const clip = pickClip(await listClips(client), orderId);
  if (!clip) throw new RecordingError("no_clips", "the clip library is empty");

  const { data, error } = await client.rpc("attach_recording", {
    p_order: orderId,
    p_path: recordingPath(orderId, clip),
    p_retention: `${retentionDays} days`,
  });
  if (error) {
    throw new RecordingError(refusals.find((reason) => reason === error.message) ?? null, error.message);
  }
  const row = (data as { recording_id: string; file_path: string; expires_at: string }[])[0];
  if (!row) throw new RecordingError(null, "the database returned no recording");

  let copied = await client.storage.from(recordingsBucket).copy(`${clipFolder}/${clip}`, row.file_path);
  if (copied.error && /not found/i.test(copied.error.message)) {
    // The clip left the library after it was listed: copy another one into the same place, once.
    const other = pickClip((await listClips(client)).filter((name) => name !== clip), orderId);
    if (other) copied = await client.storage.from(recordingsBucket).copy(`${clipFolder}/${other}`, row.file_path);
  }
  if (copied.error && !isAlreadyThere(copied.error)) throw new RecordingError(null, copied.error.message);

  return { id: row.recording_id, filePath: row.file_path, expiresAt: new Date(row.expires_at).toISOString() };
}

function isAlreadyThere(error: { message: string }): boolean {
  return /already exists/i.test(error.message);
}
