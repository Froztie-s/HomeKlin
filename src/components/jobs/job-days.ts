// How the job pages sort jobs by their day in Jakarta (WIB, UTC+7, no daylight saving), whatever time
// zone the server runs in (T17, T18): the cleaner's list in today, upcoming and just finished, and
// admin's "Pekerjaan hari ini". Pure functions, tested in tests/job-days.test.ts.

type DatedJob = { startsAt: string; completedAt: string | null };

// en-CA writes a date as YYYY-MM-DD, which compares in time order as plain text.
const dateKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const jakartaDate = (moment: Date | string) => dateKeyFormat.format(typeof moment === "string" ? new Date(moment) : moment);
const byStart = (a: DatedJob, b: DatedJob) => Date.parse(a.startsAt) - Date.parse(b.startsAt);

export type CleanerJobGroups<T> = {
  /** Unfinished jobs of today, and any unfinished one from before (it still needs the cleaner), earliest first. */
  today: T[];
  /** Unfinished jobs of later days, earliest first. */
  upcoming: T[];
  /** Finished jobs, the most recently finished first. */
  finished: T[];
};

export function groupCleanerJobs<T extends DatedJob>(jobs: readonly T[], now: Date): CleanerJobGroups<T> {
  const today = jakartaDate(now);
  const open = jobs.filter((job) => !job.completedAt).sort(byStart);
  return {
    today: open.filter((job) => jakartaDate(job.startsAt) <= today),
    upcoming: open.filter((job) => jakartaDate(job.startsAt) > today),
    finished: jobs
      .filter((job) => job.completedAt)
      .sort((a, b) => Date.parse(b.completedAt ?? "") - Date.parse(a.completedAt ?? "")),
  };
}

/** The jobs that start today in Jakarta, earliest first (a new list). */
export function jobsOfJakartaToday<T extends DatedJob>(jobs: readonly T[], now: Date): T[] {
  const today = jakartaDate(now);
  return jobs.filter((job) => jakartaDate(job.startsAt) === today).sort(byStart);
}
