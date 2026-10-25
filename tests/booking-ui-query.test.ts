import { describe, expect, it } from "vitest";
import {
  bookingHref,
  findFreeWindow,
  jakartaDayOf,
  parseBookedOrderId,
  parseBookingQuery,
  searchWithStarts,
} from "@/components/customer/booking-query";

// The booking screens (T9) keep the customer's choice in the address: /book?service=&area=&starts=
// (so a sign-in in between brings the customer back to the same booking), and the confirmation opens
// /orders?booked=<order id>. These helpers read and write those addresses; the server action checks
// every value again (src/lib/validation/booking.ts), so anything odd here is simply ignored.

const nov6At15 = "2026-11-06T08:00:00.000Z"; // Friday 6 November, 15.00 in Jakarta
const slot = (startsAt: string, hours = 2) => ({
  startsAt,
  endsAt: new Date(Date.parse(startsAt) + hours * 3_600_000).toISOString(),
});

describe("bookingHref", () => {
  it("leads to /book with the service, the area and the window's start", () => {
    const href = bookingHref({ serviceId: "regular", areaId: "jakarta-barat", startsAt: nov6At15 });
    expect(href).toBe("/book?service=regular&area=jakarta-barat&starts=2026-11-06T08%3A00%3A00.000Z");
    const url = new URL(href, "https://homeklin.invalid");
    expect(url.pathname).toBe("/book");
    expect(url.searchParams.get("starts")).toBe(nov6At15);
  });
});

describe("parseBookingQuery", () => {
  it("reads the service, the area and the window's start", () => {
    expect(parseBookingQuery({ service: "regular", area: "jakarta-barat", starts: nov6At15 })).toEqual({
      serviceId: "regular",
      areaId: "jakarta-barat",
      startsAt: nov6At15,
    });
  });

  it("writes the start the way the catalog does, whatever offset the address used", () => {
    expect(parseBookingQuery({ starts: "2026-11-06T15:00:00+07:00" }).startsAt).toBe(nov6At15);
    expect(parseBookingQuery({ starts: "2026-11-06T08:00:00Z" }).startsAt).toBe(nov6At15);
  });

  it("takes the first value when a field is repeated", () => {
    expect(parseBookingQuery({ service: ["deep", "regular"] }).serviceId).toBe("deep");
  });

  it("ignores what it does not understand", () => {
    expect(
      parseBookingQuery({ service: "Regular Cleaning", area: "../admin", starts: "tomorrow" }),
    ).toEqual({});
    expect(parseBookingQuery({ starts: "2026-11-06" })).toEqual({});
    expect(parseBookingQuery({ service: "x".repeat(41) })).toEqual({});
    expect(parseBookingQuery({})).toEqual({});
  });
});

describe("findFreeWindow", () => {
  const free = [slot("2026-11-06T01:00:00.000Z"), slot(nov6At15)];

  it("finds the free window that starts at that moment", () => {
    expect(findFreeWindow(free, nov6At15)).toEqual(free[1]);
    expect(findFreeWindow(free, "2026-11-06T15:00:00+07:00")).toEqual(free[1]);
  });

  it("finds nothing for a window that is not free, or no start at all", () => {
    expect(findFreeWindow(free, "2026-11-06T03:00:00.000Z")).toBeNull();
    expect(findFreeWindow(free, undefined)).toBeNull();
    expect(findFreeWindow([], nov6At15)).toBeNull();
  });
});

describe("parseBookedOrderId", () => {
  const id = "3f6c1d2e-8a4b-4c5d-9e6f-0a1b2c3d4e5f";

  it("reads the id of the order just booked", () => {
    expect(parseBookedOrderId({ booked: id })).toBe(id);
    expect(parseBookedOrderId({ booked: id.toUpperCase() })).toBe(id);
    expect(parseBookedOrderId({ booked: [id, "other"] })).toBe(id);
  });

  it("ignores anything that is not an order id", () => {
    expect(parseBookedOrderId({ booked: "1 or 1=1" })).toBeUndefined();
    expect(parseBookedOrderId({ booked: "" })).toBeUndefined();
    expect(parseBookedOrderId({})).toBeUndefined();
  });
});

describe("jakartaDayOf", () => {
  const now = new Date("2026-11-05T02:00:00.000Z"); // Thursday 5 November, 09.00 in Jakarta

  it("gives a window's day in Jakarta, and whether it is today or tomorrow", () => {
    expect(jakartaDayOf(nov6At15, now)).toEqual({ date: "2026-11-06", relative: "tomorrow" });
    expect(jakartaDayOf("2026-11-05T08:00:00.000Z", now)).toEqual({ date: "2026-11-05", relative: "today" });
    expect(jakartaDayOf("2026-11-09T01:00:00.000Z", now)).toEqual({ date: "2026-11-09", relative: null });
  });

  it("counts a late UTC evening as the next day in Jakarta", () => {
    expect(jakartaDayOf("2026-11-05T17:30:00.000Z", now).date).toBe("2026-11-06");
  });
});

describe("searchWithStarts", () => {
  it("replaces the window's start and keeps the rest of the address", () => {
    const search = "?service=regular&area=jakarta-barat&starts=2026-11-06T01%3A00%3A00.000Z";
    expect(searchWithStarts(search, nov6At15)).toBe(
      "?service=regular&area=jakarta-barat&starts=2026-11-06T08%3A00%3A00.000Z",
    );
  });

  it("adds the start when the address had none", () => {
    expect(searchWithStarts("?service=regular&area=jakarta-barat", nov6At15)).toBe(
      "?service=regular&area=jakarta-barat&starts=2026-11-06T08%3A00%3A00.000Z",
    );
  });
});
