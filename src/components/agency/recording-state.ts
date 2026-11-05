import type { BackOfficeJob } from "@/lib/jobs/jobs";

// Where a finished job's recording stands in the agency's list (T29): kept and playable, deleted after
// its 7 days, or never made. Pure, tested in tests/agency-ui.test.ts. The link itself is only ever made
// on the server, after the database has checked the viewer again (src/lib/recordings/link.ts).

export type BackOfficeRecordingState = "available" | "expired" | "none";

export function backOfficeRecordingState(
  job: Pick<BackOfficeJob, "recordingId" | "recordingExpiresAt" | "recordingDeleted">,
  now: number,
): BackOfficeRecordingState {
  if (!job.recordingId) return "none";
  if (job.recordingDeleted || !job.recordingExpiresAt || Date.parse(job.recordingExpiresAt) <= now) return "expired";
  return "available";
}
