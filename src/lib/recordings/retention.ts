import type { SupabaseClient } from "@supabase/supabase-js";
import { recordingRetentionDays, recordingsBucket } from "./attach";

// The 7-day retention (T16, SPEC "7-day retention is real"). Once a recording's expiry has passed, its
// file is deleted from storage and the entry is marked deleted, so it can never be opened again
// (recording_for_viewer() refuses it on the date alone, before the cleanup even runs). Vercel Cron calls
// GET /api/cron/recordings once a day (vercel.json). The retention is RECORDING_RETENTION_DAYS, 7 unless
// set, so it can be shortened to test the whole cycle; the tests pass a later "now" instead of waiting.

/** The retention for new recordings: RECORDING_RETENTION_DAYS when it is a positive number, else 7. */
export function retentionDaysFromEnv(value = process.env.RECORDING_RETENTION_DAYS): number {
  const days = Number(value);
  return value && Number.isFinite(days) && days > 0 ? days : recordingRetentionDays;
}

export type CleanupResult = { deleted: number };

/** Deletes the files of every expired recording not deleted yet, and marks them deleted. */
export async function deleteExpiredRecordings(server: SupabaseClient, now = new Date()): Promise<CleanupResult> {
  const { data, error } = await server
    .from("recordings")
    .select("id, file_path")
    .lte("expires_at", now.toISOString())
    .is("deleted_at", null)
    .limit(500);
  if (error) throw new Error(`Could not read the expired recordings: ${error.message}`);
  const due = data as { id: string; file_path: string }[];
  if (due.length === 0) return { deleted: 0 };

  // Storage first: a file that is gone but still unmarked is deleted again next time, which is harmless.
  const removed = await server.storage.from(recordingsBucket).remove(due.map((row) => row.file_path));
  if (removed.error) throw new Error(`Could not delete the expired files: ${removed.error.message}`);

  const marked = await server
    .from("recordings")
    .update({ deleted_at: now.toISOString() })
    .in("id", due.map((row) => row.id));
  if (marked.error) throw new Error(`Could not mark the recordings deleted: ${marked.error.message}`);
  return { deleted: due.length };
}
