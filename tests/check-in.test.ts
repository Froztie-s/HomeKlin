import { describe, expect, it } from "vitest";
import { checkInState, checkInOpensAt } from "@/lib/jobs/check-in";

// When a cleaner may check in (T18): from 15 minutes before the arrival window opens until it closes.
// The database enforces the same rule (check_in() in supabase/migrations/20261104090000_jobs.sql);
// this copy lets the page say when check-in opens without asking the server.

const startsAt = "2026-11-10T03:00:00.000Z"; // 10.00 WIB
const endsAt = "2026-11-10T05:00:00.000Z"; // 12.00 WIB
const job = { startsAt, endsAt, checkedInAt: null, completedAt: null };

describe("checkInOpensAt", () => {
  it("is 15 minutes before the window", () => {
    expect(checkInOpensAt(startsAt)).toBe("2026-11-10T02:45:00.000Z");
  });
});

describe("checkInState", () => {
  it.each([
    ["2026-11-10T02:44:59.000Z", "early"],
    ["2026-11-10T02:45:00.000Z", "open"],
    ["2026-11-10T04:00:00.000Z", "open"],
    ["2026-11-10T05:00:00.000Z", "open"],
    ["2026-11-10T05:00:01.000Z", "late"],
  ])("at %s it is %s", (now, state) => {
    expect(checkInState(job, new Date(now))).toBe(state);
  });

  it("knows a job in progress and a finished one, whatever the time", () => {
    const late = new Date("2026-11-10T09:00:00.000Z");
    expect(checkInState({ ...job, checkedInAt: "2026-11-10T03:05:00.000Z" }, late)).toBe("checkedIn");
    expect(checkInState({ ...job, checkedInAt: "2026-11-10T03:05:00.000Z", completedAt: "2026-11-10T05:10:00.000Z" }, late)).toBe("completed");
  });
});
