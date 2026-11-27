import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getBusinessNumbers, OwnerError } from "@/lib/owner/owner";

// What the owner dashboard reads (src/lib/owner/owner.ts, getBusinessNumbers): the owner_numbers
// function's one row, turned into the app's types. Two keys came later (20261120100000_owner_numbers_period.sql):
// `daily_period` (revenue per day over the whole chosen period) and `by_status_period` (the orders made
// in the period, by status). The reader falls back to the 14-day `daily` and the all-time `by_status`
// while the database has not got them yet, so a deploy before the migration still shows a dashboard.
// The real function is checked in tests/integration/owner-periods.test.ts; here a stand-in client
// answers with a row, so both shapes of the row can be tried.

type Answer = { data: unknown; error: { message: string } | null };

const totals = { revenue_idr: "300000", paid_orders: "3", avg_order_idr: "100000", paid_out_idr: "210000", homeklin_idr: "90000" };
const allTime = { pending_payment: 4, paid: 30, failed: 2, cancelled: 5 };
const inPeriod = { pending_payment: 1, paid: 3, failed: 0, cancelled: 1 };
const last14Days = [
  { date: "2026-11-19T00:00:00", revenue_idr: "100000" },
  { date: "2026-11-20", revenue_idr: 0 },
];
const wholePeriod = [
  { date: "2026-11-01", revenue_idr: "50000" },
  { date: "2026-11-02T00:00:00", revenue_idr: "250000" },
  { date: "2026-11-03", revenue_idr: 0 },
];

/** A row as owner_numbers answered before the period migration: no daily_period, no by_status_period. */
const oldRow = {
  revenue_idr: "1200000",
  paid_orders: "12",
  completed_jobs: "9",
  by_status: allTime,
  trend: [{ date: "2026-11-19T00:00:00", orders: "2", revenue_idr: "170000" }],
  agencies: [{ agency_id: "a1", name: "Agency One", status: "active", jobs: "5", completed: "4", revenue_idr: "400000" }],
  days: 7,
  period: totals,
  previous: { ...totals, revenue_idr: "0", paid_orders: "0", avg_order_idr: "0", paid_out_idr: "0", homeklin_idr: "0" },
  daily: last14Days,
  payouts_by_agency: [{ agency_id: "a1", name: "Agency One", paid_out_idr: "210000" }],
};

/** A stand-in for supabase.rpc: records the call and answers with `answer`. */
function fakeClient(answer: Answer) {
  const rpc = vi.fn(async () => answer);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("getBusinessNumbers", () => {
  it("asks owner_numbers for the chosen number of days, 30 when none is given", async () => {
    const week = fakeClient({ data: oldRow, error: null });
    await getBusinessNumbers(week.client, 7);
    expect(week.rpc).toHaveBeenCalledWith("owner_numbers", { p_days: 7 });

    const dflt = fakeClient({ data: oldRow, error: null });
    await getBusinessNumbers(dflt.client);
    expect(dflt.rpc).toHaveBeenCalledWith("owner_numbers", { p_days: 30 });
  });

  it("falls back to the 14-day daily revenue and the all-time statuses when the row has no period keys", async () => {
    const { client } = fakeClient({ data: oldRow, error: null });

    const numbers = await getBusinessNumbers(client, 7);

    expect(numbers.dailyPeriod).toEqual([
      { date: "2026-11-19", revenueIdr: 100000 },
      { date: "2026-11-20", revenueIdr: 0 },
    ]);
    expect(numbers.dailyPeriod).toEqual(numbers.daily);
    expect(numbers.byStatusPeriod).toEqual(allTime);
    expect(numbers.byStatusPeriod).toEqual(numbers.byStatus);
  });

  it("uses the period's own daily revenue and statuses when the row has them", async () => {
    const row = { ...oldRow, daily_period: wholePeriod, by_status_period: inPeriod };
    const { client } = fakeClient({ data: row, error: null });

    const numbers = await getBusinessNumbers(client, 7);

    expect(numbers.dailyPeriod).toEqual([
      { date: "2026-11-01", revenueIdr: 50000 },
      { date: "2026-11-02", revenueIdr: 250000 },
      { date: "2026-11-03", revenueIdr: 0 },
    ]);
    expect(numbers.byStatusPeriod).toEqual(inPeriod);
    // The 14-day and all-time answers stay what they were.
    expect(numbers.daily).toEqual([
      { date: "2026-11-19", revenueIdr: 100000 },
      { date: "2026-11-20", revenueIdr: 0 },
    ]);
    expect(numbers.byStatus).toEqual(allTime);
  });

  it("falls back for each key on its own when only one of the two is missing", async () => {
    const onlyDaily = fakeClient({ data: { ...oldRow, daily_period: wholePeriod }, error: null });
    const a = await getBusinessNumbers(onlyDaily.client, 7);
    expect(a.dailyPeriod).toHaveLength(3);
    expect(a.byStatusPeriod).toEqual(allTime);

    const onlyStatus = fakeClient({ data: { ...oldRow, by_status_period: inPeriod }, error: null });
    const b = await getBusinessNumbers(onlyStatus.client, 7);
    expect(b.dailyPeriod).toEqual(b.daily);
    expect(b.byStatusPeriod).toEqual(inPeriod);
  });

  it("keeps an empty daily_period as it is: no revenue days is an answer, not a missing key", async () => {
    const row = { ...oldRow, daily_period: [], by_status_period: { pending_payment: 0, paid: 0, failed: 0, cancelled: 0 } };
    const { client } = fakeClient({ data: row, error: null });

    const numbers = await getBusinessNumbers(client, 7);

    expect(numbers.dailyPeriod).toEqual([]);
    expect(numbers.byStatusPeriod).toEqual({ pending_payment: 0, paid: 0, failed: 0, cancelled: 0 });
  });

  it("turns the database's numbers, which can arrive as strings, into numbers and cuts the dates to the day", async () => {
    const { client } = fakeClient({ data: oldRow, error: null });

    const numbers = await getBusinessNumbers(client, 7);

    expect(numbers.revenueIdr).toBe(1200000);
    expect(numbers.paidOrders).toBe(12);
    expect(numbers.completedJobs).toBe(9);
    expect(numbers.days).toBe(7);
    expect(numbers.period).toEqual({ revenueIdr: 300000, paidOrders: 3, avgOrderIdr: 100000, paidOutIdr: 210000, homeklinIdr: 90000 });
    expect(numbers.previous.revenueIdr).toBe(0);
    expect(numbers.trend).toEqual([{ date: "2026-11-19", orders: 2, revenueIdr: 170000 }]);
    expect(numbers.agencies).toEqual([{ id: "a1", name: "Agency One", status: "active", jobs: 5, completed: 4, revenueIdr: 400000 }]);
    expect(numbers.payoutsByAgency).toEqual([{ id: "a1", name: "Agency One", paidOutIdr: 210000 }]);
  });

  it("throws an OwnerError carrying the database's message when owner_numbers fails", async () => {
    const { client } = fakeClient({ data: null, error: { message: "not the owner" } });

    const failure = await getBusinessNumbers(client, 30).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(OwnerError);
    expect((failure as OwnerError).message).toContain("not the owner");
  });
});
