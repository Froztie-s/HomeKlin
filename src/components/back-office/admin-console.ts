import { z } from "zod";
import type { AdminJob } from "@/lib/jobs/jobs";
import { checkOutOverdue } from "@/lib/jobs/overdue";
import type { StreamStatus } from "@/lib/stream/streams";

// The admin console's rules (T26, M1): which past jobs the recordings page shows and what it says
// about each recording, which recording ?recording= asks for, and which of today's jobs the live
// monitor shows as not checked in yet, with the counts of its summary line. Pure, tested in
// tests/admin-console.test.ts; the pages render what these return.

const day = 24 * 3_600_000;

/** How many past days of finished jobs the recordings page lists (recordings are kept for 7). */
export const pastJobDays = 30;

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

const jakartaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * The live monitor's "Belum check-in" cards (M1, H1): today's jobs (the Jakarta date) that have a
 * cleaner but no check-in and are not finished, the earliest start first.
 */
export function waitingForCheckIn(jobs: readonly AdminJob[], now: Date): AdminJob[] {
  const today = jakartaDate.format(now);
  return jobs
    .filter(
      (job) =>
        job.cleanerName !== null &&
        job.checkedInAt === null &&
        job.completedAt === null &&
        jakartaDate.format(new Date(job.startsAt)) === today,
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export type MonitorCounts = { live: number; troubled: number; waiting: number };

/**
 * The live monitor's summary line: the streams in progress, those of them with trouble (a weak
 * signal or disconnected), and the jobs not checked in yet. A stream that has ended counts as neither.
 */
export function monitorCounts(streams: readonly { status: StreamStatus }[], waiting: number): MonitorCounts {
  const live = streams.filter((stream) => stream.status !== "ended");
  return {
    live: live.length,
    troubled: live.filter((stream) => stream.status === "weak" || stream.status === "disconnected").length,
    waiting,
  };
}

/** The live monitor's filters (M2): every card or only the troubled streams, and one area or all. */
export type MonitorView = "all" | "troubled";
export type MonitorFilters = { view: MonitorView; area: string | null };

const firstOf = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The filters from the address (?view=troubled&area=jakarta-timur). The first value of a field counts:
 * the pressed toggle button comes before the hidden field that carries the current view. An unknown
 * view or area is ignored, so an old or edited link still shows the monitor.
 */
export function parseMonitorFilters(
  params: { view?: string | string[]; area?: string | string[] },
  areaIds: readonly string[],
): MonitorFilters {
  const view = firstOf(params.view) === "troubled" ? "troubled" : "all";
  const area = firstOf(params.area);
  return { view, area: area && areaIds.includes(area) ? area : null };
}

/**
 * What the monitor shows under its filters. "Terkendala" keeps the streams with a weak signal or a
 * lost connection, and none of the jobs waiting for check-in (they have no stream to be troubled); an
 * area keeps that area's cards. The summary line counts what this returns.
 */
export function filterMonitor<S extends { status: StreamStatus; areaId: string }, W extends { areaId: string }>(
  cards: { streams: readonly S[]; waiting: readonly W[] },
  filters: MonitorFilters,
): { streams: S[]; waiting: W[] } {
  const inArea = (card: { areaId: string }) => filters.area === null || card.areaId === filters.area;
  const troubled = filters.view === "troubled";
  return {
    streams: cards.streams.filter((stream) => inArea(stream) && (!troubled || stream.status === "weak" || stream.status === "disconnected")),
    waiting: troubled ? [] : cards.waiting.filter(inArea),
  };
}

/**
 * The jobs checked in to but never checked out, hours past their window (src/lib/jobs/overdue.ts,
 * 2026-11-20): they leave the live grid, whose streams were still marked live days later, and are
 * listed under it as "Belum check-out", the latest first, for admin to follow up.
 */
export function overdueJobs<J extends AdminJob>(jobs: readonly J[], now: Date): J[] {
  return jobs.filter((job) => checkOutOverdue(job, now)).sort((a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt));
}

/** The live streams without those of overdue jobs (matched by order id). */
export function liveStreamsOnly<S extends { orderId: string }>(streams: readonly S[], overdue: readonly { id: string }[]): S[] {
  const stale = new Set(overdue.map((job) => job.id));
  return streams.filter((stream) => !stale.has(stream.orderId));
}
