import { jakartaDateOf } from "./schedule-time";

// The agency dashboard's counts (T28): the jobs that still need one of its cleaners, and today's jobs
// in Jakarta. Pure, tested in tests/agency-ui.test.ts.

type SummaryJob = { id: string; startsAt: string; endsAt: string; cleanerName: string | null; checkedInAt: string | null; completedAt: string | null };

export type AgencyJobSummary<T> = {
  /** Jobs without a cleaner that have not started or ended yet, earliest first. */
  waiting: T[];
  /** Jobs that start today in Jakarta, earliest first. */
  today: T[];
};

const byStart = (a: SummaryJob, b: SummaryJob) => Date.parse(a.startsAt) - Date.parse(b.startsAt);

export function summarizeAgencyJobs<T extends SummaryJob>(jobs: readonly T[], now: Date): AgencyJobSummary<T> {
  const today = jakartaDateOf(now);
  return {
    waiting: jobs
      .filter((job) => !job.cleanerName && !job.checkedInAt && !job.completedAt && Date.parse(job.endsAt) > now.getTime())
      .sort(byStart),
    today: jobs.filter((job) => jakartaDateOf(job.startsAt) === today).sort(byStart),
  };
}
