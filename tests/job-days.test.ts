import { describe, expect, it } from "vitest";
import { groupCleanerJobs, jobsOfJakartaToday } from "@/components/jobs/job-days";

// How the job pages sort jobs by their day in Jakarta (WIB, UTC+7), whatever the server's time zone
// (T17, T18): the cleaner's list in today, upcoming and just finished, and admin's "Pekerjaan hari ini".

// Wednesday 4 November 2026, 22.30 WIB: late enough that UTC is still on the same date and
// a job at 23.30 WIB is tomorrow in UTC terms but today in Jakarta.
const now = new Date("2026-11-04T15:30:00.000Z");

type Job = { id: string; startsAt: string; completedAt: string | null };
const job = (id: string, startsAt: string, completedAt: string | null = null): Job => ({ id, startsAt, completedAt });
const ids = (jobs: readonly Job[]) => jobs.map((entry) => entry.id);

describe("groupCleanerJobs", () => {
  it("puts open jobs of today in Jakarta first, earliest first, and later days after them", () => {
    const groups = groupCleanerJobs(
      [
        job("tomorrow-morning", "2026-11-05T01:00:00.000Z"), // Thu 08.00 WIB
        job("tonight", "2026-11-04T16:30:00.000Z"), // Wed 23.30 WIB, already 5 Nov in UTC
        job("this-afternoon", "2026-11-04T08:00:00.000Z"), // Wed 15.00 WIB
        job("next-week", "2026-11-11T01:00:00.000Z"),
      ],
      now,
    );
    expect(ids(groups.today)).toEqual(["this-afternoon", "tonight"]);
    expect(ids(groups.upcoming)).toEqual(["tomorrow-morning", "next-week"]);
    expect(groups.finished).toEqual([]);
  });

  it("keeps an unfinished job from yesterday with today's, since it still needs the cleaner", () => {
    const groups = groupCleanerJobs([job("yesterday-evening", "2026-11-03T12:00:00.000Z")], now);
    expect(ids(groups.today)).toEqual(["yesterday-evening"]);
  });

  it("lists finished jobs apart, the most recently finished first, whatever their day", () => {
    const groups = groupCleanerJobs(
      [
        job("done-early", "2026-11-04T01:00:00.000Z", "2026-11-04T03:00:00.000Z"),
        job("open", "2026-11-04T09:00:00.000Z"),
        job("done-late", "2026-11-04T06:00:00.000Z", "2026-11-04T08:00:00.000Z"),
      ],
      now,
    );
    expect(ids(groups.today)).toEqual(["open"]);
    expect(ids(groups.finished)).toEqual(["done-late", "done-early"]);
  });

  it("returns three empty groups for no jobs", () => {
    expect(groupCleanerJobs([], now)).toEqual({ today: [], upcoming: [], finished: [] });
  });
});

describe("jobsOfJakartaToday", () => {
  it("keeps the jobs that start today in Jakarta, earliest first", () => {
    const jobs = [
      job("tonight", "2026-11-04T16:30:00.000Z"), // Wed 23.30 WIB
      job("done", "2026-11-04T01:00:00.000Z", "2026-11-04T03:00:00.000Z"), // Wed 08.00 WIB
      job("yesterday", "2026-11-03T08:00:00.000Z"),
      job("tomorrow", "2026-11-04T17:00:00.000Z"), // Thu 00.00 WIB
    ];
    expect(ids(jobsOfJakartaToday(jobs, now))).toEqual(["done", "tonight"]);
  });

  it("does not change the list it was given", () => {
    const jobs = [job("b", "2026-11-04T09:00:00.000Z"), job("a", "2026-11-04T02:00:00.000Z")];
    jobsOfJakartaToday(jobs, now);
    expect(ids(jobs)).toEqual(["b", "a"]);
  });
});
