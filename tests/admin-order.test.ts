import { describe, expect, it } from "vitest";
import {
  agencyPercent,
  findOrderTicket,
  normalizeOrderNumber,
  orderState,
  orderTimeline,
  parseOrderCode,
  paymentMethodKey,
  type TimelineOrder,
} from "@/components/back-office/admin-order";
import type { AdminJob } from "@/lib/jobs/jobs";

// The admin order detail page (D1, after the user's mocks "Admin-Order" and "Admin-Order-Issue"): which
// order the address asks for, the status chip under the title, the job's status steps, and the help
// chat that belongs to the order. Pure rules; the page renders what these return.

const now = new Date("2026-11-05T02:00:00.000Z");
const minute = 60_000;
const at = (offset: number) => new Date(now.getTime() + offset * minute).toISOString();

function job(overrides: Partial<AdminJob> = {}): AdminJob {
  return {
    id: "order-1",
    serviceId: "regular",
    areaId: "jakarta-selatan",
    startsAt: at(0),
    endsAt: at(120),
    cleanerId: null,
    cleanerName: "Uji Petugas",
    checkedInAt: null,
    completedAt: null,
    recordingId: null,
    recordingExpiresAt: null,
    recordingDeleted: false,
    agencyName: "Uji Agensi",
    orderCode: "HK-1042",
    ...overrides,
  };
}

describe("parseOrderCode", () => {
  it("accepts an order number as the database writes it", () => {
    expect(parseOrderCode("HK-1042")).toBe("HK-1042");
    expect(parseOrderCode("HK-123456")).toBe("HK-123456");
  });

  it("refuses anything else, so nothing odd reaches the lookup", () => {
    for (const value of ["", "hk-1042", "HK-12", "HK-1042x", "1042", "HK-1042;drop", "%48K-1042"]) {
      expect(parseOrderCode(value)).toBeNull();
    }
  });
});

describe("normalizeOrderNumber", () => {
  // Admin's order search (audit item 1): what an admin may type for an order number.
  it("reads the usual ways of writing an order number as the database writes it", () => {
    for (const value of ["HK-1170", "hk1170", "1170", "  HK-1170  ", "hk-1170", "Hk 1170", "HK1170", "\t1170\n"]) {
      expect(normalizeOrderNumber(value), JSON.stringify(value)).toBe("HK-1170");
    }
    expect(normalizeOrderNumber("123456")).toBe("HK-123456");
  });

  it("refuses what cannot be an order number", () => {
    for (const value of ["", "   ", "HK-", "117", "HK-12", "HK-1170x", "HX-1170", "1170 1171", "HK--1170", "#1170", "11.70", "HK-1170;drop", "1".repeat(40)]) {
      expect(normalizeOrderNumber(value), JSON.stringify(value)).toBeNull();
    }
  });

  it("always gives a number the order page accepts", () => {
    for (const value of ["hk1170", "1170", " HK 0042 "]) {
      expect(parseOrderCode(normalizeOrderNumber(value) ?? "")).not.toBeNull();
    }
  });
});

describe("orderState", () => {
  it("follows the live stream while there is one", () => {
    expect(orderState(job({ checkedInAt: at(4) }), "active")).toBe("active");
    expect(orderState(job({ checkedInAt: at(4) }), "weak")).toBe("weak");
    expect(orderState(job({ checkedInAt: at(4) }), "disconnected")).toBe("disconnected");
  });

  it("follows the job without a stream (or with one that has ended)", () => {
    expect(orderState(job({ cleanerName: null }), null)).toBe("unassigned");
    expect(orderState(job(), null)).toBe("assigned");
    expect(orderState(job({ checkedInAt: at(4) }), null)).toBe("inProgress");
    expect(orderState(job({ checkedInAt: at(4) }), "ended")).toBe("inProgress");
    expect(orderState(job({ checkedInAt: at(4), completedAt: at(100) }), "ended")).toBe("completed");
  });
});

describe("orderTimeline", () => {
  const order = (overrides: Partial<TimelineOrder> = {}): TimelineOrder => ({
    status: "paid",
    createdAt: at(-1440),
    paidAt: at(-1430),
    assignedAt: at(-600),
    cleanerName: "Uji Petugas",
    checkedInAt: null,
    completedAt: null,
    ...overrides,
  });

  it("marks the steps done so far, each with the time the database keeps", () => {
    expect(orderTimeline(order({ checkedInAt: at(4) }), null)).toEqual([
      { key: "created", state: "done", at: at(-1440) },
      { key: "paid", state: "done", at: at(-1430) },
      { key: "assigned", state: "done", at: at(-600) },
      { key: "checkedIn", state: "done", at: at(4) },
      { key: "completed", state: "pending", at: null },
    ]);
  });

  it("has only the booking and the payment done before a cleaner is assigned", () => {
    expect(orderTimeline(order({ cleanerName: null, assignedAt: null }), null).map((step) => step.state)).toEqual([
      "done",
      "done",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("keeps a paid order paid when the database has no payment time (older orders)", () => {
    expect(orderTimeline(order({ paidAt: null }), null)[1]).toEqual({ key: "paid", state: "done", at: null });
    expect(orderTimeline(order({ status: "pending_payment", paidAt: null }), null)[1]).toEqual({ key: "paid", state: "pending", at: null });
  });

  it("shows an assignment without a time when it was made before the time was kept", () => {
    expect(orderTimeline(order({ assignedAt: null }), null)[2]).toEqual({ key: "assigned", state: "done", at: null });
  });

  it("adds a stream problem as its own step, at the stream's last change", () => {
    const stream = { status: "disconnected" as const, updatedAt: at(41) };
    expect(orderTimeline(order({ checkedInAt: at(2) }), stream).slice(3)).toEqual([
      { key: "checkedIn", state: "done", at: at(2) },
      { key: "disconnected", state: "problem", at: at(41) },
      { key: "completed", state: "pending", at: null },
    ]);
    expect(orderTimeline(order({ checkedInAt: at(2) }), { status: "weak", updatedAt: at(30) })[4]).toEqual({
      key: "weak",
      state: "problem",
      at: at(30),
    });
    expect(orderTimeline(order({ checkedInAt: at(2) }), { status: "active", updatedAt: at(30) })).toHaveLength(5);
  });

  it("ends with the finish time", () => {
    const steps = orderTimeline(order({ checkedInAt: at(2), completedAt: at(118) }), { status: "ended", updatedAt: at(118) });
    expect(steps.at(-1)).toEqual({ key: "completed", state: "done", at: at(118) });
    expect(steps).toHaveLength(5);
  });
});

describe("paymentMethodKey", () => {
  it("names the ways Midtrans reports a payment", () => {
    expect(paymentMethodKey("gopay")).toBe("gopay");
    expect(paymentMethodKey("qris")).toBe("qris");
    expect(paymentMethodKey("bank_transfer")).toBe("bank_transfer");
    expect(paymentMethodKey("echannel")).toBe("bank_transfer");
    expect(paymentMethodKey("permata")).toBe("bank_transfer");
    expect(paymentMethodKey("credit_card")).toBe("credit_card");
    expect(paymentMethodKey("shopeepay")).toBe("shopeepay");
    expect(paymentMethodKey("cstore")).toBe("cstore");
  });

  it("calls anything else another method, and nothing when the order has none", () => {
    expect(paymentMethodKey("akulaku")).toBe("other");
    expect(paymentMethodKey("toString")).toBe("other");
    expect(paymentMethodKey(null)).toBeNull();
  });
});

describe("agencyPercent", () => {
  it("is the agency's share of the price, rounded", () => {
    expect(agencyPercent(105000, 150000)).toBe(70);
    expect(agencyPercent(59500, 85000)).toBe(70);
    expect(agencyPercent(100000, 300000)).toBe(33);
  });

  it("is null for a free order", () => {
    expect(agencyPercent(0, 0)).toBeNull();
  });
});

describe("findOrderTicket", () => {
  const ticket = (id: string, orderId: string | null, lastMessageAt: string) => ({ id, orderId, lastMessageAt });

  it("picks the order's help chat with the latest message", () => {
    const tickets = [ticket("other", "order-2", at(50)), ticket("old", "order-1", at(10)), ticket("new", "order-1", at(30)), ticket("none", null, at(60))];
    expect(findOrderTicket(tickets, "order-1")?.id).toBe("new");
  });

  it("finds none for an order nobody asked about", () => {
    expect(findOrderTicket([ticket("other", "order-2", at(5))], "order-1")).toBeUndefined();
  });
});
