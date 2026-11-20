import { describe, expect, it } from "vitest";
import { orderStage } from "@/components/customer/order-stage";
import type { CustomerOrder } from "@/lib/booking/orders";

// The pill on each order card says where the order is (2026-11-18, UX audit item 2), most advanced
// first, not only whether it was paid: a finished job reads "Selesai", never "Sudah dibayar".

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

const before = new Date("2026-11-04T10:00:00.000Z");
const during = new Date("2026-11-05T03:00:00.000Z");
const after = new Date("2026-11-05T06:00:00.000Z");
const assigned = { cleanerName: "Petugas Contoh", assignedAt: "2026-11-03T08:00:00.000Z" };

describe("orderStage", () => {
  it("says a completed job is done, also after its window", () => {
    const order = { ...base, ...assigned, checkedInAt: "2026-11-05T02:05:00.000Z", completedAt: "2026-11-05T03:50:00.000Z" };
    expect(orderStage(order, during)).toBe("completed");
    expect(orderStage(order, after)).toBe("completed");
  });

  it("says a checked-in job that is not completed is in progress, even after its window", () => {
    const order = { ...base, ...assigned, checkedInAt: "2026-11-05T02:05:00.000Z" };
    expect(orderStage(order, during)).toBe("inProgress");
    expect(orderStage(order, after)).toBe("inProgress");
  });

  it("says a job checked in to but not checked out hours after its window awaits completion (2026-11-20)", () => {
    const order = { ...base, ...assigned, checkedInAt: "2026-11-05T02:05:00.000Z" };
    expect(orderStage(order, new Date("2026-11-05T07:00:00.000Z"))).toBe("awaitingCheckOut");
    expect(orderStage(order, new Date("2026-11-11T07:00:00.000Z"))).toBe("awaitingCheckOut");
  });

  it("says a paid order with a cleaner is assigned until its window ends", () => {
    expect(orderStage({ ...base, ...assigned }, before)).toBe("assigned");
    expect(orderStage({ ...base, ...assigned }, during)).toBe("assigned");
  });

  it("knows an assignment by the cleaner's name or the assignment time alone", () => {
    expect(orderStage({ ...base, cleanerName: "Petugas Contoh" }, before)).toBe("assigned");
    expect(orderStage({ ...base, assignedAt: "2026-11-03T08:00:00.000Z" }, before)).toBe("assigned");
  });

  it("keeps a paid order with no cleaner yet as paid", () => {
    expect(orderStage(base, before)).toBe("paid");
    expect(orderStage(base, during)).toBe("paid");
  });

  it("says a paid order whose window ended without a check-in did not take place", () => {
    expect(orderStage(base, after)).toBe("missed");
    expect(orderStage({ ...base, ...assigned }, after)).toBe("missed");
    // The window's last moment counts as ended, as in the orders' split.
    expect(orderStage(base, new Date(base.endsAt))).toBe("missed");
  });

  it("keeps the payment words for orders that were not paid", () => {
    expect(orderStage({ ...base, status: "pending_payment" }, before)).toBe("pending_payment");
    expect(orderStage({ ...base, status: "pending_payment" }, after)).toBe("pending_payment");
    expect(orderStage({ ...base, status: "failed" }, after)).toBe("failed");
    expect(orderStage({ ...base, status: "cancelled" }, before)).toBe("cancelled");
  });
});
