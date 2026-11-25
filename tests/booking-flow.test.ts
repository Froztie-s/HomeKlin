import { describe, expect, it } from "vitest";
import { paymentHrefFromOrders, paymentStepHref } from "@/components/customer/booking-query";
import {
  bookingBack,
  bookingStepOf,
  emptyFlowMemory,
  flowFallback,
  nextFlowMemory,
  type FlowMemory,
} from "@/components/customer/booking-flow";
import { serviceStepHref } from "@/components/customer/order-query";
import { rolesFor } from "@/lib/auth/roles";

// The booking flow's focused layout (2026-11-17): the three steps share one minimal header whose
// "Kembali" goes one step back (2 -> 1), from the payment to the customer's orders (the order is
// placed by then), and from step 1 back to where the customer came from: the browser's history when
// they came straight from another page of the site, that page again when they moved around inside the
// flow first, and the customer home when they opened the flow from outside.

const nov6At15 = "2026-11-06T08:00:00.000Z";
const orderId = "3f0c2b9e-7a41-4c55-9d3e-0b8f6a2d1c44";

describe("serviceStepHref (step 1's address)", () => {
  it("opens step 1 with nothing chosen", () => {
    expect(serviceStepHref({})).toBe("/services");
  });

  it("keeps the service only, for the landing page's service cards", () => {
    expect(serviceStepHref({ serviceId: "regular" })).toBe("/services?layanan=regular");
  });

  it("keeps the whole choice, the area first", () => {
    expect(serviceStepHref({ serviceId: "deep", areaId: "jakarta-barat", startsAt: nov6At15 })).toBe(
      `/services?area=jakarta-barat&layanan=deep&starts=${encodeURIComponent(nov6At15)}`,
    );
  });
});

describe("step 3's address", () => {
  it("is the payment page with the order", () => {
    expect(paymentStepHref(orderId)).toBe(`/orders/pay?order=${orderId}`);
  });

  it("moves the old address (/orders?booked=<id>) there, with Midtrans' fields", () => {
    expect(paymentHrefFromOrders({ booked: orderId })).toBe(`/orders/pay?order=${orderId}`);
    expect(paymentHrefFromOrders({ booked: orderId, status_code: "200", transaction_status: "settlement" })).toBe(
      `/orders/pay?order=${orderId}&status_code=200&transaction_status=settlement`,
    );
  });

  it("is for customers only, as the rest of /orders", () => {
    expect(rolesFor("/orders/pay")).toEqual(["customer"]);
  });

  it("leaves every other orders address alone", () => {
    expect(paymentHrefFromOrders({})).toBeNull();
    expect(paymentHrefFromOrders({ order: orderId })).toBeNull();
    expect(paymentHrefFromOrders({ booked: "not-an-id" })).toBeNull();
  });
});

describe("bookingStepOf", () => {
  it("knows the three steps by their address", () => {
    expect(bookingStepOf("/services")).toBe(1);
    expect(bookingStepOf("/services?layanan=regular")).toBe(1);
    expect(bookingStepOf("/pesan")).toBe(2);
    expect(bookingStepOf("/pesan/")).toBe(2);
    expect(bookingStepOf("/orders/pay?order=x")).toBe(3);
  });

  it("knows every other page is outside the flow", () => {
    for (const path of ["/", "/home", "/orders", "/orders?order=x", "/orders/live", "/support", "/servicesx", "/login"]) {
      expect(bookingStepOf(path)).toBeNull();
    }
  });
});

describe("nextFlowMemory", () => {
  it("remembers the page the customer entered the flow from", () => {
    expect(nextFlowMemory(emptyFlowMemory, "/#layanan", "/services")).toEqual({ exit: "/#layanan", moves: 0 });
    expect(nextFlowMemory(emptyFlowMemory, "/home", "/pesan?layanan=regular")).toEqual({ exit: "/home", moves: 0 });
  });

  it("counts the moves inside the flow and keeps the way out", () => {
    let memory: FlowMemory = nextFlowMemory(emptyFlowMemory, "/", "/services");
    memory = nextFlowMemory(memory, "/services", "/pesan?layanan=regular");
    memory = nextFlowMemory(memory, "/pesan?layanan=regular", "/services?layanan=regular");
    expect(memory).toEqual({ exit: "/", moves: 2 });
  });

  it("knows no way out when the flow is the first page opened", () => {
    expect(nextFlowMemory(emptyFlowMemory, null, "/services")).toEqual({ exit: null, moves: 0 });
    expect(nextFlowMemory(emptyFlowMemory, null, "/home")).toEqual(emptyFlowMemory);
  });

  it("forgets the way out once the customer leaves the flow", () => {
    const inside = nextFlowMemory(emptyFlowMemory, "/", "/services");
    expect(nextFlowMemory(inside, "/services", "/support")).toEqual(emptyFlowMemory);
  });
});

describe("bookingBack", () => {
  it("goes from step 2 to step 1 with the choice in the address", () => {
    expect(bookingBack(2, `?layanan=deep&area=jakarta-barat&starts=${encodeURIComponent(nov6At15)}`, emptyFlowMemory)).toEqual({
      kind: "push",
      href: `/services?area=jakarta-barat&layanan=deep&starts=${encodeURIComponent(nov6At15)}`,
    });
    expect(bookingBack(2, "", emptyFlowMemory)).toEqual({ kind: "push", href: "/services" });
  });

  it("goes from the payment to the customer's orders, where the placed order waits", () => {
    expect(bookingBack(3, `?order=${orderId}`, { exit: "/", moves: 3 })).toEqual({ kind: "push", href: "/home" });
  });

  it("goes from step 1 back in the browser's history when the customer came straight from another page", () => {
    expect(bookingBack(1, "", { exit: "/", moves: 0 })).toEqual({ kind: "history" });
  });

  it("goes from step 1 to that page again after moves inside the flow", () => {
    expect(bookingBack(1, "?layanan=regular", { exit: "/home", moves: 2 })).toEqual({ kind: "push", href: "/home" });
  });

  it("goes from step 1 to the customer home when the flow was opened from outside the site", () => {
    expect(flowFallback).toBe("/home");
    expect(bookingBack(1, "", emptyFlowMemory)).toEqual({ kind: "push", href: "/home" });
  });
});

describe("the tab's record of the way in (flow-memory)", () => {
  it("follows the pages, keeps the way out across full loads inside the site, and starts afresh from another site", async () => {
    const { currentFlowMemory, lastVisit, recordVisit } = await import("@/components/shell/flow-memory");
    recordVisit("/support", null);
    recordVisit("/services", lastVisit());
    expect(currentFlowMemory()).toEqual({ exit: "/support", moves: 0 });
    // Step 1's summary is a full load to step 2: still the same visit.
    recordVisit("/pesan?layanan=regular", lastVisit());
    expect(currentFlowMemory()).toEqual({ exit: "/support", moves: 1 });
    // A reload records nothing new.
    recordVisit("/pesan?layanan=regular", lastVisit());
    expect(currentFlowMemory()).toEqual({ exit: "/support", moves: 1 });
    // Opened from another site: no page of the site behind it.
    recordVisit("/services", null);
    expect(currentFlowMemory()).toEqual(emptyFlowMemory);
    expect(lastVisit()).toBe("/services");
  });
});
