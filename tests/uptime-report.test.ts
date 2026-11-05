import { describe, expect, it } from "vitest";
import { availability } from "../scripts/uptime-report.mjs";

// The availability figure (T37, scripts/uptime-report.mjs): successes over successes and failures,
// cancelled and skipped runs left out, optionally from a date on.

const run = (conclusion: string | null, created_at: string) => ({ conclusion, created_at });

describe("availability", () => {
  it("is the share of checks that succeeded", () => {
    const runs = [
      run("success", "2026-11-05T10:00:00Z"),
      run("success", "2026-11-05T10:10:00Z"),
      run("success", "2026-11-05T10:20:00Z"),
      run("failure", "2026-11-05T10:30:00Z"),
    ];
    expect(availability(runs)).toEqual({
      checks: 4,
      up: 3,
      down: 1,
      availability: 75,
      firstCheck: "2026-11-05T10:00:00Z",
      lastCheck: "2026-11-05T10:30:00Z",
    });
  });

  it("leaves out cancelled, skipped and unfinished runs", () => {
    const runs = [run("success", "2026-11-05T10:00:00Z"), run("cancelled", "2026-11-05T10:10:00Z"), run("skipped", "2026-11-05T10:20:00Z"), run(null, "2026-11-05T10:30:00Z")];
    expect(availability(runs).checks).toBe(1);
    expect(availability(runs).availability).toBe(100);
  });

  it("counts only runs from the given date on", () => {
    const runs = [run("failure", "2026-11-04T23:50:00Z"), run("success", "2026-11-05T00:00:00Z"), run("success", "2026-11-05T00:10:00Z")];
    expect(availability(runs, new Date("2026-11-05T00:00:00Z"))).toMatchObject({ checks: 2, down: 0, availability: 100 });
  });

  it("has no figure before any check", () => {
    expect(availability([])).toMatchObject({ checks: 0, availability: null, firstCheck: null, lastCheck: null });
  });
});
