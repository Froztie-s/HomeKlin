import { describe, expect, it } from "vitest";
import {
  adminRecordingState,
  jobsSummary,
  latestOpenTickets,
  parseRecordingParam,
  pastJobs,
  ticketsSummary,
} from "@/components/back-office/admin-console";
import type { AdminJob } from "@/lib/jobs/jobs";
import type { InboxTicket } from "@/lib/support/support";

// The admin console (T24-T26): what the dashboard's tiles count, which open tickets it lists, which
// past jobs the recordings page shows and what it says about each recording. Pure rules; the pages
// render what these return.

// Wednesday 4 November 2026, 10.00 WIB.
const now = new Date("2026-11-04T03:00:00.000Z");
const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;
const at = (offset: number) => new Date(now.getTime() + offset).toISOString();

function job(id: string, overrides: Partial<AdminJob> = {}): AdminJob {
  return {
    id,
    serviceId: "regular",
    areaId: "jakarta-timur",
    startsAt: at(hour),
    endsAt: at(3 * hour),
    cleanerId: null,
    cleanerName: "Uji Petugas",
    checkedInAt: null,
    completedAt: null,
    recordingId: null,
    recordingExpiresAt: null,
    recordingDeleted: false,
    agencyName: "Uji Agensi",
    ...overrides,
  };
}

function ticket(id: string, overrides: Partial<InboxTicket> = {}): InboxTicket {
  return {
    id,
    orderId: null,
    question: "Petugas belum datang, apakah jadwalnya tetap?",
    urgency: "normal",
    status: "open",
    createdAt: at(-2 * hour),
    lastMessageAt: at(-hour),
    customerName: "Uji Pelanggan",
    messageCount: 1,
    ...overrides,
  };
}

describe("jobsSummary", () => {
  it("counts today's jobs in Jakarta, the jobs in progress and today's jobs still without a cleaner", () => {
    const summary = jobsSummary(
      [
        job("today-waiting", { cleanerName: null }),
        job("today-assigned"),
        job("today-started", { startsAt: at(-hour), checkedInAt: at(-50 * minute) }),
        job("today-finished", { startsAt: at(-3 * hour), checkedInAt: at(-3 * hour), completedAt: at(-hour) }),
        // 23.30 WIB tonight: still today in Jakarta.
        job("tonight-waiting", { startsAt: "2026-11-04T16:30:00.000Z", cleanerName: null }),
        job("tomorrow-waiting", { startsAt: at(day), cleanerName: null }),
        // Checked in yesterday and never checked out: still in progress, so it is counted there.
        job("yesterday-started", { startsAt: at(-day), checkedInAt: at(-day) }),
      ],
      now,
    );
    expect(summary).toEqual({ today: 5, inProgress: 2, waiting: 2 });
  });

  it("is all zeros without jobs", () => {
    expect(jobsSummary([], now)).toEqual({ today: 0, inProgress: 0, waiting: 0 });
  });
});

describe("ticketsSummary", () => {
  it("counts the open tickets and how many of them are urgent", () => {
    const summary = ticketsSummary([
      ticket("open-normal"),
      ticket("open-urgent", { urgency: "urgent" }),
      ticket("answered-urgent", { urgency: "urgent", status: "answered" }),
      ticket("closed", { status: "closed" }),
    ]);
    expect(summary).toEqual({ open: 2, urgent: 1 });
  });
});

describe("latestOpenTickets", () => {
  it("lists open tickets only, urgent first, then the latest activity first, up to the limit", () => {
    const tickets = [
      ticket("old-normal", { lastMessageAt: at(-5 * hour) }),
      ticket("new-normal", { lastMessageAt: at(-minute) }),
      ticket("old-urgent", { urgency: "urgent", lastMessageAt: at(-4 * hour) }),
      ticket("new-urgent", { urgency: "urgent", lastMessageAt: at(-2 * minute) }),
      ticket("answered", { status: "answered", lastMessageAt: at(0) }),
      ticket("mid-normal", { lastMessageAt: at(-2 * hour) }),
    ];
    expect(latestOpenTickets(tickets, 4).map((entry) => entry.id)).toEqual(["new-urgent", "old-urgent", "new-normal", "mid-normal"]);
  });
});

describe("pastJobs", () => {
  it("keeps the jobs finished in the last 30 days, the most recently finished first", () => {
    const jobs = [
      job("open", { checkedInAt: at(-hour) }),
      job("finished-yesterday", { completedAt: at(-day) }),
      job("finished-today", { completedAt: at(-hour) }),
      job("finished-29-days-ago", { completedAt: at(-29 * day) }),
      job("finished-31-days-ago", { completedAt: at(-31 * day) }),
    ];
    expect(pastJobs(jobs, now).map((entry) => entry.id)).toEqual(["finished-today", "finished-yesterday", "finished-29-days-ago"]);
  });
});

describe("adminRecordingState", () => {
  const finished = { completedAt: at(-day) };

  it("is available while the recording is kept", () => {
    expect(adminRecordingState(job("a", { ...finished, recordingId: "r", recordingExpiresAt: at(6 * day) }), now)).toBe("available");
  });

  it("is expired once the 7 days are over or the cleanup deleted it", () => {
    expect(adminRecordingState(job("a", { ...finished, recordingId: "r", recordingExpiresAt: at(-minute) }), now)).toBe("expired");
    expect(
      adminRecordingState(job("b", { ...finished, recordingId: "r", recordingExpiresAt: at(day), recordingDeleted: true }), now),
    ).toBe("expired");
  });

  it("is none for a job without a recording", () => {
    expect(adminRecordingState(job("a", finished), now)).toBe("none");
  });
});

describe("parseRecordingParam", () => {
  it("accepts one recording id and nothing else", () => {
    const id = "6f1c2a7e-3b4d-4c5e-9f60-718293a4b5c6";
    expect(parseRecordingParam(id)).toBe(id);
    expect(parseRecordingParam([id, "other"])).toBe(id);
    expect(parseRecordingParam("not-an-id")).toBeNull();
    expect(parseRecordingParam(undefined)).toBeNull();
  });
});
