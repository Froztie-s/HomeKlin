import { describe, expect, it } from "vitest";
import { bookingSteps } from "@/components/customer/booking-steps";
import { orderTimeline } from "@/components/customer/order-timeline";
import {
  filterHistory,
  groupByMonth,
  historyHref,
  parseHistoryMonth,
  pickMonth,
  historySummary,
  jakartaMonthOf,
  parseHistoryFilter,
  splitOrders,
} from "@/components/customer/orders-overview-data";
import { paymentMethodKey } from "@/components/customer/payment-method";
import { windowDays } from "@/components/customer/service-step-data";
import type { CustomerOrder } from "@/lib/booking/orders";

// D5 (pass 5a), the customer's booking flow and orders after the Main, Customer-* and Phone-* mocks:
// the pure rules behind the three steps (Layanan, Pesan, Bayar), the order page's status steps, the
// payment method as the customer reads it, the split of the orders between the home (still to come) and the history page,
// and the days of step 1's time chips (full windows included, marked as such).

const base: CustomerOrder = {
  id: "00000000-0000-4000-8000-000000000001",
  serviceId: "regular",
  areaId: "jakarta-selatan",
  startsAt: "2026-11-05T02:00:00.000Z",
  endsAt: "2026-11-05T04:00:00.000Z",
  address: "Jl. Contoh No. 12",
  contactPhone: "+6281234567890",
  priceIdr: 85_000,
  status: "paid",
  createdAt: "2026-11-02T06:12:00.000Z",
  cleanerName: null,
  cleanerPhotoUrl: null,
  checkedInAt: null,
  completedAt: null,
  recordingId: null,
  recordingExpiresAt: null,
  recordingDeleted: false,
  orderCode: "HK-1042",
  assignedAt: null,
  customerNote: "",
  paymentMethod: "qris",
};

describe("bookingSteps", () => {
  it("marks the steps before the current one done, the current one current and the rest upcoming", () => {
    expect(bookingSteps(1).map((step) => step.state)).toEqual(["current", "upcoming", "upcoming"]);
    expect(bookingSteps(2).map((step) => step.state)).toEqual(["done", "current", "upcoming"]);
    expect(bookingSteps(3).map((step) => step.state)).toEqual(["done", "done", "current"]);
  });

  it("marks every step done once the order is paid", () => {
    expect(bookingSteps("done").map((step) => step.state)).toEqual(["done", "done", "done"]);
  });

  it("keeps the three steps in order, numbered 1 to 3", () => {
    expect(bookingSteps(1).map((step) => [step.key, step.number])).toEqual([
      ["service", 1],
      ["details", 2],
      ["payment", 3],
    ]);
  });
});

describe("orderTimeline", () => {
  const keys = (order: CustomerOrder) => orderTimeline(order).map((step) => `${step.key}:${step.state}`);

  it("a paid order waiting for its Petugas: ordered and paid done, assigning current", () => {
    expect(keys(base)).toEqual([
      "ordered:done",
      "paid:done",
      "assigned:current",
      "checkedIn:upcoming",
      "inProgress:upcoming",
      "completed:upcoming",
    ]);
  });

  it("an order waiting for payment: the payment is the current step", () => {
    expect(keys({ ...base, status: "pending_payment", paymentMethod: null })).toEqual([
      "ordered:done",
      "paid:current",
      "assigned:upcoming",
      "checkedIn:upcoming",
      "inProgress:upcoming",
      "completed:upcoming",
    ]);
  });

  it("a job in progress: checked in done with its time, in progress current", () => {
    const order = {
      ...base,
      cleanerName: "Wulan Anggraeni",
      assignedAt: "2026-11-03T01:00:00.000Z",
      checkedInAt: "2026-11-05T02:04:00.000Z",
    };
    const steps = orderTimeline(order);
    expect(steps.map((step) => `${step.key}:${step.state}`)).toEqual([
      "ordered:done",
      "paid:done",
      "assigned:done",
      "checkedIn:done",
      "inProgress:current",
      "completed:upcoming",
    ]);
    expect(steps.find((step) => step.key === "checkedIn")?.at).toBe("2026-11-05T02:04:00.000Z");
    expect(steps.find((step) => step.key === "assigned")?.at).toBe("2026-11-03T01:00:00.000Z");
    expect(steps.find((step) => step.key === "ordered")?.at).toBe(base.createdAt);
  });

  it("an unfinished job's last step carries the window's end as an estimate", () => {
    const last = orderTimeline(base).at(-1);
    expect(last).toMatchObject({ key: "completed", state: "upcoming", at: base.endsAt, estimate: true });
  });

  it("a finished job: every step done, finished at its real time", () => {
    const order = {
      ...base,
      cleanerName: "Wulan Anggraeni",
      checkedInAt: "2026-11-05T02:04:00.000Z",
      completedAt: "2026-11-05T03:58:00.000Z",
    };
    const steps = orderTimeline(order);
    expect(steps.every((step) => step.state === "done")).toBe(true);
    expect(steps.at(-1)).toMatchObject({ at: "2026-11-05T03:58:00.000Z", estimate: false });
  });

  it("an assigned order from before B3 (no assigned time) is still assigned", () => {
    const step = orderTimeline({ ...base, cleanerName: "Wulan Anggraeni" }).find((candidate) => candidate.key === "assigned");
    expect(step).toMatchObject({ state: "done", at: null });
  });

  it("a failed or cancelled order has no steps to follow", () => {
    expect(orderTimeline({ ...base, status: "failed" })).toEqual([]);
    expect(orderTimeline({ ...base, status: "cancelled" })).toEqual([]);
  });
});

describe("paymentMethodKey", () => {
  it("names the Midtrans payment types the customer chooses from", () => {
    expect(paymentMethodKey("qris")).toBe("qris");
    expect(paymentMethodKey("bank_transfer")).toBe("bankTransfer");
    expect(paymentMethodKey("echannel")).toBe("bankTransfer");
    expect(paymentMethodKey("permata")).toBe("bankTransfer");
    expect(paymentMethodKey("credit_card")).toBe("card");
    expect(paymentMethodKey("gopay")).toBe("ewallet");
    expect(paymentMethodKey("shopeepay")).toBe("ewallet");
    expect(paymentMethodKey("cstore")).toBe("store");
  });

  it("has a plain word for any other type, and nothing before the payment", () => {
    expect(paymentMethodKey("akulaku")).toBe("other");
    expect(paymentMethodKey(null)).toBeNull();
    expect(paymentMethodKey("")).toBeNull();
  });
});

describe("splitOrders (the home and the history page)", () => {
  // base: a paid order for 5 Nov 2026, 09.00 to 11.00 WIB, booked on 2 Nov.
  const now = new Date("2026-11-04T03:00:00.000Z");
  const at = (day: number, hour: number) => new Date(Date.UTC(2026, 10, day, hour)).toISOString();
  const ids = (orders: readonly { id: string }[]) => orders.map((order) => order.id);

  it("puts a job in progress first, apart, and keeps it there a little after its window", () => {
    const live = { ...base, id: "live", cleanerName: "W", checkedInAt: "2026-11-05T02:04:00.000Z" };
    // Its window ended an hour ago: still under way within the grace hours (src/lib/jobs/overdue.ts).
    const late = { ...live, id: "late", startsAt: at(4, 0), endsAt: at(4, 2), checkedInAt: at(4, 0) };
    const split = splitOrders([live, late], now);
    expect(ids(split.live)).toEqual(["late", "live"]);
    expect(split.upcoming).toEqual([]);
    expect(split.history).toEqual([]);
  });

  it("keeps every order not finished yet in Sedang berjalan, the soonest arrival first", () => {
    const saturday = { ...base, id: "saturday", startsAt: at(7, 2), endsAt: at(7, 4), createdAt: at(3, 1) };
    const waiting = { ...base, id: "waiting", status: "pending_payment" as const, createdAt: at(4, 1) };
    // Its window has started but not ended: the cleaner may still arrive.
    const started = { ...base, id: "started", startsAt: at(4, 2), endsAt: at(4, 4), createdAt: at(1, 1) };
    const split = splitOrders([waiting, saturday, base, started], now);
    expect(ids(split.upcoming)).toEqual(["started", "waiting", base.id, "saturday"]);
    expect(split.live).toEqual([]);
    expect(split.history).toEqual([]);
  });

  it("moves finished, failed and cancelled orders, and orders whose window ended unused, to Riwayat, newest first", () => {
    const done = { ...base, id: "done", cleanerName: "W", checkedInAt: base.startsAt, completedAt: base.endsAt, createdAt: at(2, 5) };
    const failed = { ...base, id: "failed", status: "failed" as const, createdAt: at(2, 7) };
    const cancelled = { ...base, id: "cancelled", status: "cancelled" as const, createdAt: at(2, 3) };
    const missed = { ...base, id: "missed", startsAt: at(3, 2), endsAt: at(3, 3), createdAt: at(1, 1) };
    const unpaid = { ...base, id: "unpaid", status: "pending_payment" as const, startsAt: at(3, 2), endsAt: at(4, 3), createdAt: at(2, 9) };
    const split = splitOrders([cancelled, missed, done, unpaid, failed], now);
    expect(ids(split.history)).toEqual(["unpaid", "failed", "done", "cancelled", "missed"]);
    expect(split.live).toEqual([]);
    expect(split.upcoming).toEqual([]);
  });

  it("moves a job never checked out to Riwayat once it is hours past its window, under Selesai (2026-11-20)", () => {
    const stale = { ...base, id: "stale", cleanerName: "W", checkedInAt: "2026-11-01T02:05:00.000Z", startsAt: at(1, 2), endsAt: at(1, 4) };
    const split = splitOrders([stale], now);
    expect(split.live).toEqual([]);
    expect(ids(split.history)).toEqual(["stale"]);
    expect(ids(filterHistory(split.history, "done", now))).toEqual(["stale"]);
  });

  it("puts a finished job in Riwayat even when its window has not ended", () => {
    const early = { ...base, id: "early", checkedInAt: at(4, 2), completedAt: at(4, 2) };
    expect(ids(splitOrders([early], now).history)).toEqual(["early"]);
  });

  it("does not change the list it was given", () => {
    const orders = [{ ...base, id: "b", startsAt: at(9, 2), endsAt: at(9, 4) }, { ...base, id: "a" }];
    splitOrders(orders, now);
    expect(ids(orders)).toEqual(["b", "a"]);
  });
});

describe("the history page (/orders)", () => {
  const now = new Date("2026-11-20T03:00:00.000Z");
  const done = { ...base, id: "done", cleanerName: "W", checkedInAt: base.startsAt, completedAt: base.endsAt };
  const recorded = { ...done, id: "recorded", recordingId: "r1", recordingExpiresAt: "2026-11-25T00:00:00.000Z", priceIdr: 120_000 };
  const missed = { ...base, id: "missed" };
  const cancelled = { ...base, id: "cancelled", status: "cancelled" as const };
  const failed = { ...base, id: "failed", status: "failed" as const };
  const ids = (orders: readonly { id: string }[]) => orders.map((order) => order.id);

  it("reads the filter from the address, Semua by default", () => {
    expect(parseHistoryFilter("selesai")).toBe("done");
    expect(parseHistoryFilter("tidak-jadi")).toBe("notDone");
    for (const value of [undefined, null, "", "done", ["selesai"], "x"]) expect(parseHistoryFilter(value)).toBe("all");
    expect(historyHref("all")).toBe("/orders");
    expect(historyHref("done")).toBe("/orders?filter=selesai");
    expect(historyHref("notDone", "2026-10")).toBe("/orders?filter=tidak-jadi&bulan=2026-10");
    expect(historyHref("all", "2026-11")).toBe("/orders?bulan=2026-11");
  });

  it("shows one month: the one in the address when it has orders, otherwise the latest", () => {
    expect(parseHistoryMonth("2026-11")).toBe("2026-11");
    for (const value of [undefined, "2026-13", "2026-1", "nov", ["2026-11"]]) expect(parseHistoryMonth(value)).toBeUndefined();
    const groups = [{ month: "2026-11", orders: [1] }, { month: "2026-10", orders: [2] }];
    expect(pickMonth(groups, "2026-10")).toBe(1);
    expect(pickMonth(groups, "2026-09")).toBe(0);
    expect(pickMonth(groups, undefined)).toBe(0);
  });

  it("keeps the finished jobs under Selesai and the rest under Tidak jadi", () => {
    const all = [done, missed, cancelled, failed];
    expect(ids(filterHistory(all, "done", now))).toEqual(["done"]);
    expect(ids(filterHistory(all, "notDone", now))).toEqual(["missed", "cancelled", "failed"]);
    expect(ids(filterHistory(all, "all", now))).toEqual(ids(all));
  });

  it("groups the orders by their Jakarta month, the latest job first, each month once", () => {
    // 31 Oct 20:00Z is already 1 Nov 03.00 in Jakarta.
    expect(jakartaMonthOf("2026-10-31T20:00:00.000Z")).toBe("2026-11");
    expect(jakartaMonthOf("2026-10-31T16:00:00.000Z")).toBe("2026-10");
    const a = { ...base, id: "a", startsAt: "2026-11-10T02:00:00.000Z" };
    const b = { ...base, id: "b", startsAt: "2026-11-03T02:00:00.000Z" };
    const c = { ...base, id: "c", startsAt: "2026-10-20T02:00:00.000Z" };
    expect(groupByMonth([b, c, a]).map((group) => [group.month, ids(group.orders)])).toEqual([
      ["2026-11", ["a", "b"]],
      ["2026-10", ["c"]],
    ]);
  });

  it("sums up the jobs done, the recordings still to watch and what was paid", () => {
    expect(historySummary([done, recorded, missed, cancelled, failed], now)).toEqual({ done: 2, recordings: 1, paidIdr: 85_000 * 2 + 120_000 });
  });
});

describe("windowDays (step 1's time chips)", () => {
  // Jakarta is UTC+7: 01:00Z is 08.00 WIB.
  const now = new Date("2026-11-04T03:00:00.000Z");
  const windows = [
    { startsAt: "2026-11-05T06:00:00.000Z", endsAt: "2026-11-05T08:00:00.000Z", isFull: false },
    { startsAt: "2026-11-05T01:00:00.000Z", endsAt: "2026-11-05T03:00:00.000Z", isFull: true },
    { startsAt: "2026-11-06T01:00:00.000Z", endsAt: "2026-11-06T03:00:00.000Z", isFull: true },
  ];

  it("groups the windows by their Jakarta day, in time order, keeping whether each is full", () => {
    const days = windowDays(windows, now);
    expect(days.map((day) => day.date)).toEqual(["2026-11-05", "2026-11-06"]);
    expect(days[0].windows.map((window) => [window.startsAt, window.isFull])).toEqual([
      ["2026-11-05T01:00:00.000Z", true],
      ["2026-11-05T06:00:00.000Z", false],
    ]);
  });

  it("says whether a day has any free window left", () => {
    const days = windowDays(windows, now);
    expect(days.map((day) => day.hasFree)).toEqual([true, false]);
  });
});
