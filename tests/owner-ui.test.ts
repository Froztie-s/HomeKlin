import { describe, expect, it } from "vitest";
import { barPercent, niceMax, shortDate, statusRows, trendSummary } from "@/components/owner/numbers";

// The owner dashboard's arithmetic (T29b): the trend chart's scale and bar heights, the 30-day totals,
// and orders by status with their share. Pure rules; the page renders what these return.

const day = (date: string, orders: number, revenueIdr = 0) => ({ date, orders, revenueIdr });

describe("niceMax", () => {
  it("rounds the largest value up to 1, 2 or 5 times a power of ten", () => {
    expect(niceMax(1)).toBe(1);
    expect(niceMax(2)).toBe(2);
    expect(niceMax(3)).toBe(5);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(12)).toBe(20);
    expect(niceMax(50)).toBe(50);
    expect(niceMax(51)).toBe(100);
  });

  it("keeps a scale of 1 when there is nothing to show, so no bar divides by zero", () => {
    expect(niceMax(0)).toBe(1);
  });
});

describe("barPercent", () => {
  it("gives a bar its share of the scale", () => {
    expect(barPercent(5, 10)).toBe(50);
    expect(barPercent(10, 10)).toBe(100);
    expect(barPercent(0, 10)).toBe(0);
  });

  it("keeps a small non-zero day visible", () => {
    expect(barPercent(1, 500)).toBe(2);
  });
});

describe("trendSummary", () => {
  it("adds up the orders and revenue and finds the busiest day", () => {
    const trend = [day("2026-11-02", 1, 100_000), day("2026-11-03", 3, 250_000), day("2026-11-04", 2, 0)];
    expect(trendSummary(trend)).toEqual({ orders: 6, revenueIdr: 350_000, busiest: trend[1], max: 5 });
  });

  it("has no busiest day when no order came in", () => {
    expect(trendSummary([day("2026-11-03", 0), day("2026-11-04", 0)])).toEqual({ orders: 0, revenueIdr: 0, busiest: null, max: 1 });
  });
});

describe("statusRows", () => {
  it("lists every status in a fixed order with its share of all orders", () => {
    expect(statusRows({ pending_payment: 1, paid: 2, failed: 1, cancelled: 0 })).toEqual([
      { status: "paid", count: 2, percent: 50 },
      { status: "pending_payment", count: 1, percent: 25 },
      { status: "failed", count: 1, percent: 25 },
      { status: "cancelled", count: 0, percent: 0 },
    ]);
  });

  it("shows no share when there are no orders yet", () => {
    expect(statusRows({ pending_payment: 0, paid: 0, failed: 0, cancelled: 0 }).map((row) => row.percent)).toEqual([0, 0, 0, 0]);
  });
});

describe("shortDate", () => {
  it("writes a Jakarta date as day and short month in either language", () => {
    expect(shortDate("2026-11-04", "id")).toBe("4 Nov");
    expect(shortDate("2026-08-17", "id")).toBe("17 Agu");
    expect(shortDate("2026-08-17", "en")).toBe("17 Aug");
  });
});
