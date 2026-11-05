import { describe, expect, it } from "vitest";
import { summarizeAgencyJobs } from "@/components/agency/dashboard-summary";
import { backOfficeRecordingState } from "@/components/agency/recording-state";
import {
  groupScheduleDays,
  jakartaIso,
  jakartaToday,
  lastScheduleWeek,
  parseScheduleArea,
  parseScheduleWeek,
  scheduleWeek,
  slotWindowInput,
  weekOfSlot,
} from "@/components/agency/schedule-time";

// The agency back office's pure pieces (T27-T29): the windows it types in Jakarta time (WIB, UTC+7, no
// daylight saving) as the ISO times the server actions take, the schedule's weeks and its grouping by
// day and area, the dashboard's counts, and where a job's recording stands.

// Wednesday 4 November 2026, 22.30 WIB: UTC is still on 4 November, Jakarta too.
const now = new Date("2026-11-04T15:30:00.000Z");

describe("jakartaIso", () => {
  it("writes a Jakarta date and time with its +07:00 offset", () => {
    expect(jakartaIso("2026-12-03", "20:35")).toBe("2026-12-03T20:35:00+07:00");
    expect(Date.parse(jakartaIso("2026-12-03", "08:00") ?? "")).toBe(Date.parse("2026-12-03T01:00:00.000Z"));
  });

  it("refuses anything that is not a real date and a 24-hour time", () => {
    expect(jakartaIso("", "08:00")).toBeNull();
    expect(jakartaIso("2026-12-03", "")).toBeNull();
    expect(jakartaIso("2026-02-30", "08:00")).toBeNull();
    expect(jakartaIso("2026-12-03", "24:00")).toBeNull();
    expect(jakartaIso("3/12/2026", "08:00")).toBeNull();
  });
});

describe("slotWindowInput", () => {
  it("gives the start and end as ISO times on that day", () => {
    expect(slotWindowInput("2026-12-03", "08:00", "10:30")).toEqual({
      ok: true,
      startsAt: "2026-12-03T08:00:00+07:00",
      endsAt: "2026-12-03T10:30:00+07:00",
    });
  });

  it("says the window is invalid when it ends at or before its start, or a field is empty", () => {
    expect(slotWindowInput("2026-12-03", "10:00", "10:00")).toEqual({ ok: false });
    expect(slotWindowInput("2026-12-03", "10:00", "09:00")).toEqual({ ok: false });
    expect(slotWindowInput("", "10:00", "12:00")).toEqual({ ok: false });
  });
});

describe("the schedule's weeks", () => {
  it("knows today's date in Jakarta, even when UTC is already on the next day", () => {
    expect(jakartaToday(now)).toBe("2026-11-04");
    expect(jakartaToday(new Date("2026-11-04T17:30:00.000Z"))).toBe("2026-11-05"); // 00.30 WIB
  });

  it("counts weeks of seven days from today, up to the 60 days the database lists", () => {
    expect(scheduleWeek(0, now)).toEqual({ from: "2026-11-04", to: "2026-11-10" });
    expect(scheduleWeek(1, now)).toEqual({ from: "2026-11-11", to: "2026-11-17" });
    expect(lastScheduleWeek).toBe(8);
  });

  it("finds the week a window falls in by its Jakarta day", () => {
    expect(weekOfSlot("2026-11-10T16:00:00.000Z", now)).toBe(0); // Tue 10 Nov, 23.00 WIB
    expect(weekOfSlot("2026-11-10T17:00:00.000Z", now)).toBe(1); // Wed 11 Nov, 00.00 WIB
    expect(weekOfSlot("2026-12-04T13:35:00.000Z", now)).toBe(4);
  });

  it("reads the week and area from the address, falling back to this week and every area", () => {
    expect(parseScheduleWeek(undefined)).toBe(0);
    expect(parseScheduleWeek("3")).toBe(3);
    expect(parseScheduleWeek(["2", "5"])).toBe(2);
    expect(parseScheduleWeek("9")).toBe(0);
    expect(parseScheduleWeek("-1")).toBe(0);
    expect(parseScheduleWeek("1.5")).toBe(0);
    expect(parseScheduleArea("jakarta-timur", ["jakarta-pusat", "jakarta-timur"])).toBe("jakarta-timur");
    expect(parseScheduleArea("jakarta-utara", ["jakarta-pusat", "jakarta-timur"])).toBeNull();
    expect(parseScheduleArea(undefined, ["jakarta-timur"])).toBeNull();
  });
});

describe("groupScheduleDays", () => {
  const slot = (id: string, areaId: string, startsAt: string) => ({ id, areaId, startsAt, endsAt: startsAt, capacity: 2, booked: 0 });

  it("groups the week's windows by Jakarta day, then by area in the agency's order, earliest first", () => {
    const days = groupScheduleDays(
      [
        slot("c", "jakarta-timur", "2026-11-05T03:00:00.000Z"),
        slot("a", "jakarta-pusat", "2026-11-05T01:00:00.000Z"),
        slot("b", "jakarta-timur", "2026-11-05T01:00:00.000Z"),
        slot("d", "jakarta-pusat", "2026-11-04T16:30:00.000Z"), // 23.30 WIB on the 4th
        slot("late", "jakarta-pusat", "2026-11-11T01:00:00.000Z"), // next week
      ],
      ["jakarta-pusat", "jakarta-timur"],
      scheduleWeek(0, now),
    );
    expect(days.map((day) => day.date)).toEqual(["2026-11-04", "2026-11-05"]);
    expect(days[1].areas.map((area) => [area.areaId, area.slots.map((entry) => entry.id)])).toEqual([
      ["jakarta-pusat", ["a"]],
      ["jakarta-timur", ["b", "c"]],
    ]);
  });
});

type Job = Parameters<typeof summarizeAgencyJobs>[0][number];
const job = (id: string, startsAt: string, more: Partial<Job> = {}): Job => ({
  id,
  startsAt,
  endsAt: new Date(Date.parse(startsAt) + 2 * 3_600_000).toISOString(),
  cleanerName: null,
  checkedInAt: null,
  completedAt: null,
  ...more,
});

describe("summarizeAgencyJobs", () => {
  it("counts the jobs still waiting for a cleaner and today's jobs in Jakarta, earliest waiting first", () => {
    const summary = summarizeAgencyJobs(
      [
        job("tomorrow", "2026-11-05T01:00:00.000Z"),
        job("tonight", "2026-11-04T16:00:00.000Z"),
        job("today-assigned", "2026-11-04T08:00:00.000Z", { cleanerName: "Uji" }),
        job("ended-unassigned", "2026-11-03T01:00:00.000Z"),
        job("started", "2026-11-04T14:00:00.000Z", { checkedInAt: "2026-11-04T14:05:00.000Z", cleanerName: "Uji" }),
      ],
      now,
    );
    expect(summary.waiting.map((entry) => entry.id)).toEqual(["tonight", "tomorrow"]);
    expect(summary.today.map((entry) => entry.id)).toEqual(["today-assigned", "started", "tonight"]);
  });
});

describe("backOfficeRecordingState", () => {
  const base = { completedAt: "2026-11-04T10:00:00.000Z", recordingId: "r", recordingExpiresAt: "2026-11-11T10:00:00.000Z", recordingDeleted: false };

  it("is available while the 7 days run and the file is kept", () => {
    expect(backOfficeRecordingState(base, now.getTime())).toBe("available");
  });

  it("is expired once deleted or past its expiry, and none without a recording", () => {
    expect(backOfficeRecordingState({ ...base, recordingDeleted: true }, now.getTime())).toBe("expired");
    expect(backOfficeRecordingState({ ...base, recordingExpiresAt: "2026-11-04T15:00:00.000Z" }, now.getTime())).toBe("expired");
    expect(backOfficeRecordingState({ ...base, recordingId: null, recordingExpiresAt: null }, now.getTime())).toBe("none");
  });
});
