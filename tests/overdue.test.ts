import { describe, expect, it } from "vitest";
import { checkOutGraceHours, checkOutOverdue } from "@/lib/jobs/overdue";

// A job checked in to and never checked out stops counting as under way 3 hours after its window.
describe("checkOutOverdue", () => {
  const endsAt = "2026-11-14T08:00:00.000Z";
  const at = (hoursAfterEnd: number) => new Date(Date.parse(endsAt) + hoursAfterEnd * 3_600_000);
  const job = { checkedInAt: "2026-11-14T06:05:00.000Z", completedAt: null, endsAt };

  it("is still under way during the window and the grace hours after it", () => {
    expect(checkOutOverdue(job, at(-1))).toBe(false);
    expect(checkOutOverdue(job, at(checkOutGraceHours - 0.1))).toBe(false);
  });

  it("is overdue once the grace hours have passed, and days later", () => {
    expect(checkOutOverdue(job, at(checkOutGraceHours))).toBe(true);
    expect(checkOutOverdue(job, at(24 * 6))).toBe(true);
  });

  it("is never overdue without a check-in, or once checked out", () => {
    expect(checkOutOverdue({ ...job, checkedInAt: null }, at(48))).toBe(false);
    expect(checkOutOverdue({ ...job, completedAt: "2026-11-14T08:10:00.000Z" }, at(48))).toBe(false);
  });
});
