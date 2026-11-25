import { describe, expect, it } from "vitest";
import {
  availabilityGrid,
  chartScale,
  cleanerWeekJobs,
  dailySeries,
  formatAgencyDate,
  formatRupiahCompact,
  incomingCounts,
  incomingJobs,
  jakartaWeek,
  matchesSearch,
  parseDays,
  parseIncomingStatus,
  parsePastRecording,
  parseSearch,
  pastJobs,
} from "@/components/agency/agency-views";
import type { AgencySlot } from "@/lib/agency/agency";
import type { AgencyJob } from "@/lib/jobs/jobs";

// The redesigned agency back office's pure pieces (D2): the summary's range and daily bars, the incoming
// and completed lists with their filters and search, the Jakarta week, and the week overview of the
// agency's arrival windows on the cleaners page.

// Wednesday 4 November 2026, 22.30 WIB (15.30 UTC).
const now = new Date("2026-11-04T15:30:00.000Z");

function job(overrides: Partial<AgencyJob>): AgencyJob {
  return {
    id: "job",
    serviceId: "regular",
    areaId: "jakarta-timur",
    startsAt: "2026-11-05T02:00:00.000Z",
    endsAt: "2026-11-05T04:00:00.000Z",
    cleanerId: null,
    cleanerName: null,
    checkedInAt: null,
    completedAt: null,
    recordingId: null,
    recordingExpiresAt: null,
    recordingDeleted: false,
    address: "Jl. Contoh No. 1",
    contactPhone: null,
    orderCode: "HK-1001",
    assignedAt: null,
    agencyFeeIdr: 59_500,
    agencyFeeFinal: false,
    customerNote: "",
    ...overrides,
  };
}

describe("parseDays", () => {
  it("takes 7, 30 or 90 from the address and 30 for anything else", () => {
    expect(parseDays("7")).toBe(7);
    expect(parseDays("90")).toBe(90);
    expect(parseDays(["7", "90"])).toBe(7);
    expect(parseDays(undefined)).toBe(30);
    expect(parseDays("14")).toBe(30);
    expect(parseDays("7abc")).toBe(30);
  });
});

describe("dailySeries", () => {
  it("gives one bar per day ending today, with 0 for a day without fees", () => {
    const series = dailySeries(
      [
        { day: "2026-11-02", feeIdr: 120_000 },
        { day: "2026-11-04", feeIdr: 59_500 },
        { day: "2026-10-01", feeIdr: 99_000 },
      ],
      "2026-11-04",
      3,
    );
    expect(series).toEqual([
      { date: "2026-11-02", feeIdr: 120_000 },
      { date: "2026-11-03", feeIdr: 0 },
      { date: "2026-11-04", feeIdr: 59_500 },
    ]);
  });

  it("crosses a month end", () => {
    expect(dailySeries([], "2026-11-01", 2).map((day) => day.date)).toEqual(["2026-10-31", "2026-11-01"]);
  });
});

describe("chartScale", () => {
  it("rounds the top up to a round number, with a middle line at half", () => {
    expect(chartScale(680_000)).toEqual({ top: 800_000, ticks: [0, 400_000, 800_000] });
    expect(chartScale(120_000)).toEqual({ top: 200_000, ticks: [0, 100_000, 200_000] });
    expect(chartScale(250_000)).toEqual({ top: 250_000, ticks: [0, 125_000, 250_000] });
  });

  it("has a single 0 line when there is nothing to show", () => {
    expect(chartScale(0)).toEqual({ top: 0, ticks: [0] });
  });
});

describe("the incoming list", () => {
  const jobs = [
    job({ id: "open" }),
    job({ id: "assigned", cleanerId: "c1", cleanerName: "Wulan" }),
    job({ id: "live", cleanerId: "c1", cleanerName: "Wulan", checkedInAt: "2026-11-04T14:00:00.000Z" }),
    // Finished on Monday 2 November (this Jakarta week) and on Sunday 1 November (last week).
    job({ id: "done", cleanerId: "c1", cleanerName: "Wulan", checkedInAt: "2026-11-02T02:00:00.000Z", completedAt: "2026-11-02T04:00:00.000Z" }),
    job({ id: "old", cleanerId: "c1", cleanerName: "Wulan", checkedInAt: "2026-11-01T02:00:00.000Z", completedAt: "2026-11-01T04:00:00.000Z" }),
  ];

  it("leaves finished jobs out, and can show one status at a time", () => {
    expect(incomingJobs(jobs, null, now).map((item) => item.id)).toEqual(["open", "assigned", "live"]);
    expect(incomingJobs(jobs, "unassigned", now).map((item) => item.id)).toEqual(["open"]);
    expect(incomingJobs(jobs, "inProgress", now).map((item) => item.id)).toEqual(["live"]);
  });

  // 2026-11-20: a job checked in to but never checked out, days past its window, is not under way.
  it("lists a job overdue for check-out under Semua only, and does not count it as under way", () => {
    const stale = job({ id: "stale", cleanerId: "c1", cleanerName: "Wulan", startsAt: "2026-10-30T02:00:00.000Z", endsAt: "2026-10-30T04:00:00.000Z", checkedInAt: "2026-10-30T02:05:00.000Z" });
    const all = [...jobs, stale];
    expect(incomingJobs(all, null, now).map((item) => item.id)).toContain("stale");
    expect(incomingJobs(all, "inProgress", now).map((item) => item.id)).toEqual(["live"]);
    expect(incomingCounts(all, now)).toEqual({ unassigned: 1, assigned: 1, inProgress: 1, completedThisWeek: 1 });
  });

  it("counts each status, and the jobs finished in this Jakarta week (Monday to Sunday)", () => {
    expect(incomingCounts(jobs, now)).toEqual({ unassigned: 1, assigned: 1, inProgress: 1, completedThisWeek: 1 });
  });

  it("reads the status filter from the address", () => {
    expect(parseIncomingStatus("assigned")).toBe("assigned");
    expect(parseIncomingStatus("completed")).toBeNull();
    expect(parseIncomingStatus(undefined)).toBeNull();
  });
});

describe("the completed list", () => {
  const later = Date.parse("2026-11-11T00:00:00.000Z");
  const jobs = [
    job({ id: "kept", completedAt: "2026-11-03T04:00:00.000Z", recordingId: "r1", recordingExpiresAt: "2026-11-10T04:00:00.000Z" }),
    job({ id: "gone", completedAt: "2026-11-04T04:00:00.000Z", recordingId: "r2", recordingExpiresAt: "2026-11-09T04:00:00.000Z", recordingDeleted: true }),
    job({ id: "none", completedAt: "2026-11-02T04:00:00.000Z" }),
    job({ id: "open" }),
  ];

  it("lists finished jobs, latest finish first, filtered by where the recording stands", () => {
    expect(pastJobs(jobs, null, now.getTime()).map((item) => item.id)).toEqual(["gone", "kept", "none"]);
    expect(pastJobs(jobs, "available", now.getTime()).map((item) => item.id)).toEqual(["kept"]);
    expect(pastJobs(jobs, "deleted", now.getTime()).map((item) => item.id)).toEqual(["gone"]);
    // After its 7 days a kept recording counts as deleted too.
    expect(pastJobs(jobs, "deleted", later).map((item) => item.id)).toEqual(["gone", "kept"]);
  });

  it("reads the recording filter from the address", () => {
    expect(parsePastRecording("available")).toBe("available");
    expect(parsePastRecording("deleted")).toBe("deleted");
    expect(parsePastRecording("none")).toBeNull();
  });
});

describe("search", () => {
  it("keeps a trimmed, short query from the address", () => {
    expect(parseSearch("  Rutin ")).toBe("Rutin");
    expect(parseSearch(undefined)).toBe("");
    expect(parseSearch("x".repeat(200))).toHaveLength(80);
  });

  it("matches every word, in any field, ignoring case", () => {
    const fields = ["Pembersihan Rutin", "Jakarta Selatan", null, "Wulan Anggraeni"];
    expect(matchesSearch(fields, "")).toBe(true);
    expect(matchesSearch(fields, "rutin")).toBe(true);
    expect(matchesSearch(fields, "rutin wulan")).toBe(true);
    expect(matchesSearch(fields, "rutin dedi")).toBe(false);
  });
});

describe("jakartaWeek", () => {
  it("runs Monday to Sunday in Jakarta", () => {
    expect(jakartaWeek(now)).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    // Sunday 8 November, 23.30 WIB, is still that week; Monday 00.30 WIB is the next.
    expect(jakartaWeek(new Date("2026-11-08T16:30:00.000Z"))).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(jakartaWeek(new Date("2026-11-08T17:30:00.000Z"))).toEqual({ from: "2026-11-09", to: "2026-11-15" });
  });
});

describe("cleanerWeekJobs", () => {
  it("counts a cleaner's jobs that start in the week", () => {
    const jobs = [
      job({ id: "a", cleanerId: "c1", startsAt: "2026-11-02T01:00:00.000Z" }),
      job({ id: "b", cleanerId: "c1", startsAt: "2026-11-08T10:00:00.000Z" }),
      job({ id: "c", cleanerId: "c1", startsAt: "2026-11-09T01:00:00.000Z" }),
      job({ id: "d", cleanerId: "c2", startsAt: "2026-11-03T01:00:00.000Z" }),
    ];
    expect(cleanerWeekJobs(jobs, "c1", jakartaWeek(now))).toBe(2);
    expect(cleanerWeekJobs(jobs, "c3", jakartaWeek(now))).toBe(0);
  });
});

describe("availabilityGrid", () => {
  const slot = (id: string, startsAt: string, capacity: number, booked: number, areaId = "jakarta-timur"): AgencySlot => ({
    id,
    areaId,
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + 7_200_000).toISOString(),
    capacity,
    booked,
  });

  it("puts the week's windows in rows by start time and columns by day, adding up areas", () => {
    const grid = availabilityGrid(
      [
        slot("a", "2026-11-02T01:00:00.000Z", 2, 1), // Monday 08.00
        slot("b", "2026-11-02T01:00:00.000Z", 1, 0, "jakarta-pusat"), // Monday 08.00, another area
        slot("c", "2026-11-04T06:00:00.000Z", 3, 3), // Wednesday 13.00
        slot("d", "2026-11-10T01:00:00.000Z", 2, 0), // next week
      ],
      { from: "2026-11-02", to: "2026-11-08" },
    );
    expect(grid.days).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(grid.rows.map((row) => row.time)).toEqual(["08:00", "13:00"]);
    expect(grid.rows[0].cells[0]).toEqual({ capacity: 3, booked: 1, startsAt: "2026-11-02T01:00:00.000Z", endsAt: "2026-11-02T03:00:00.000Z" });
    expect(grid.rows[0].cells[1]).toBeNull();
    expect(grid.rows[1].cells[2]).toMatchObject({ capacity: 3, booked: 3 });
  });

  it("has no rows for a week without windows", () => {
    expect(availabilityGrid([], { from: "2026-11-02", to: "2026-11-08" }).rows).toEqual([]);
  });
});

describe("formatAgencyDate and formatRupiahCompact", () => {
  it("writes a Jakarta day short, with its weekday, or in full", () => {
    expect(formatAgencyDate("2026-11-10", "id", "short")).toBe("10 Nov");
    expect(formatAgencyDate("2026-11-10", "id", "long")).toBe("Selasa, 10 Nov 2026");
    expect(formatAgencyDate("2026-11-10", "en", "long")).toBe("Tuesday, 10 Nov 2026");
    expect(formatAgencyDate("2026-11-05", "id", "weekday")).toBe("Kam 5 Nov");
  });

  it("writes an axis amount in short rupiah", () => {
    expect(formatRupiahCompact(600_000, "id")).toBe("Rp 600 rb");
    expect(formatRupiahCompact(1_500_000, "id")).toBe("Rp 1,5 jt");
    expect(formatRupiahCompact(0, "id")).toBe("Rp 0");
    expect(formatRupiahCompact(600_000, "en")).toBe("Rp 600K");
  });
});
