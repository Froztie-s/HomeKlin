import { z } from "zod";
import { jobsOfJakartaToday } from "@/components/jobs/job-days";
import { jobProgress, type AdminJob } from "@/lib/jobs/jobs";
import type { InboxTicket } from "@/lib/support/support";

// The admin console's rules (T24-T26): what the dashboard's tiles count, which open tickets it lists,
// which past jobs the recordings page shows and what it says about each recording. Pure, tested in
// tests/admin-console.test.ts; the pages render what these return.

const day = 24 * 3_600_000;

/** How many past days of finished jobs the recordings page lists (recordings are kept for 7). */
export const pastJobDays = 30;

export type JobsSummary = {
  /** Jobs that start today in Jakarta, whatever their state. */
  today: number;
  /** Jobs checked in and not finished yet, of any day. */
  inProgress: number;
  /** Today's jobs that have no cleaner yet. */
  waiting: number;
};

export function jobsSummary(jobs: readonly AdminJob[], now: Date): JobsSummary {
  const today = jobsOfJakartaToday(jobs, now);
  return {
    today: today.length,
    inProgress: jobs.filter((job) => jobProgress(job) === "inProgress").length,
    waiting: today.filter((job) => jobProgress(job) === "unassigned").length,
  };
}

export type TicketsSummary = { open: number; urgent: number };

export function ticketsSummary(tickets: readonly InboxTicket[]): TicketsSummary {
  const open = tickets.filter((ticket) => ticket.status === "open");
  return { open: open.length, urgent: open.filter((ticket) => ticket.urgency === "urgent").length };
}

/** Open tickets for the dashboard: urgent first, then the latest activity first. */
export function latestOpenTickets(tickets: readonly InboxTicket[], limit: number): InboxTicket[] {
  return tickets
    .filter((ticket) => ticket.status === "open")
    .sort(
      (a, b) =>
        Number(b.urgency === "urgent") - Number(a.urgency === "urgent") || Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt),
    )
    .slice(0, limit);
}

/** Jobs finished in the last 30 days, the most recently finished first. */
export function pastJobs(jobs: readonly AdminJob[], now: Date): AdminJob[] {
  const since = now.getTime() - pastJobDays * day;
  return jobs
    .filter((job) => job.completedAt !== null && Date.parse(job.completedAt) >= since)
    .sort((a, b) => Date.parse(b.completedAt ?? "") - Date.parse(a.completedAt ?? ""));
}

/** available: it can be played; expired: deleted after its 7 days; none: the job has no recording. */
export type AdminRecordingState = "available" | "expired" | "none";

export function adminRecordingState(
  job: Pick<AdminJob, "recordingId" | "recordingExpiresAt" | "recordingDeleted">,
  now: Date,
): AdminRecordingState {
  if (!job.recordingId) return "none";
  if (job.recordingDeleted || !job.recordingExpiresAt || Date.parse(job.recordingExpiresAt) <= now.getTime()) return "expired";
  return "available";
}

const recordingParam = z.uuid();

/** The recording to play from ?recording=, or null for none or anything that is not an id. */
export function parseRecordingParam(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  const parsed = recordingParam.safeParse(first);
  return parsed.success ? parsed.data : null;
}
