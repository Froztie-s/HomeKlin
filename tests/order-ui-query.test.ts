import { describe, expect, it } from "vitest";
import { orderHref, orderHrefFromBook, orderSearch, parseOrderQuery } from "@/components/customer/order-query";

// The order page (T9b) keeps the customer's choice in the address: /pesan?layanan=&area=&starts=, so
// a reload or a shared link opens the same order. The old booking address (/book?service=&area=&starts=)
// leads there too. Whatever the address says is only a suggestion: the page checks it against the
// catalog and the free windows, and the server actions check every field again.

const nov6At15 = "2026-11-06T08:00:00.000Z"; // Friday 6 November, 15.00 in Jakarta

describe("orderHref", () => {
  it("leads to /pesan with the service, the area and the window's start", () => {
    const href = orderHref({ serviceId: "regular", areaId: "jakarta-barat", startsAt: nov6At15 });
    expect(href).toBe("/pesan?layanan=regular&area=jakarta-barat&starts=2026-11-06T08%3A00%3A00.000Z");
    const url = new URL(href, "https://homeklin.invalid");
    expect(url.pathname).toBe("/pesan");
    expect(url.searchParams.get("starts")).toBe(nov6At15);
  });

  it("leaves out what is not chosen yet", () => {
    expect(orderHref({ serviceId: "deep" })).toBe("/pesan?layanan=deep");
    expect(orderHref({})).toBe("/pesan");
  });
});

describe("parseOrderQuery", () => {
  it("reads the service, the area and the window's start", () => {
    expect(parseOrderQuery({ layanan: "regular", area: "jakarta-barat", starts: nov6At15 })).toEqual({
      serviceId: "regular",
      areaId: "jakarta-barat",
      startsAt: nov6At15,
    });
  });

  it("writes the start the way the catalog does, whatever offset the address used", () => {
    expect(parseOrderQuery({ starts: "2026-11-06T15:00:00+07:00" }).startsAt).toBe(nov6At15);
  });

  it("ignores what it does not understand, and the old field name", () => {
    expect(parseOrderQuery({ layanan: "Regular Cleaning", area: "../admin", starts: "tomorrow" })).toEqual({});
    expect(parseOrderQuery({ service: "regular" })).toEqual({});
    expect(parseOrderQuery({ layanan: ["deep", "regular"] })).toEqual({ serviceId: "deep" });
  });
});

describe("orderHrefFromBook", () => {
  it("turns the old booking address into the order page's", () => {
    expect(orderHrefFromBook({ service: "regular", area: "jakarta-barat", starts: nov6At15 })).toBe(
      "/pesan?layanan=regular&area=jakarta-barat&starts=2026-11-06T08%3A00%3A00.000Z",
    );
  });

  it("drops anything unreadable on the way", () => {
    expect(orderHrefFromBook({ service: "<script>", area: "jakarta-barat" })).toBe("/pesan?area=jakarta-barat");
    expect(orderHrefFromBook({})).toBe("/pesan");
  });
});

describe("orderSearch", () => {
  const search = "?layanan=regular&area=jakarta-barat&starts=2026-11-06T01%3A00%3A00.000Z";

  it("replaces one choice and keeps the rest", () => {
    expect(orderSearch(search, { startsAt: nov6At15 })).toBe(
      "?layanan=regular&area=jakarta-barat&starts=2026-11-06T08%3A00%3A00.000Z",
    );
    expect(orderSearch(search, { serviceId: "deep" })).toBe(
      "?layanan=deep&area=jakarta-barat&starts=2026-11-06T01%3A00%3A00.000Z",
    );
  });

  it("drops a choice set to null (another area has other windows)", () => {
    expect(orderSearch(search, { areaId: "jakarta-timur", startsAt: null })).toBe(
      "?layanan=regular&area=jakarta-timur",
    );
  });

  it("adds a choice the address did not have yet", () => {
    expect(orderSearch("", { serviceId: "regular" })).toBe("?layanan=regular");
    expect(orderSearch("?layanan=regular", { startsAt: null })).toBe("?layanan=regular");
  });
});
