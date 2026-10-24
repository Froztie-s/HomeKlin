import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import type { Service, ServiceArea } from "@/lib/catalog/catalog";
import { splitDuration } from "@/lib/catalog/customer-duration";
import { pickFeatured } from "@/lib/catalog/customer-featured";
import { catalogQuery, defaultAreaId, resolveArea } from "@/lib/catalog/customer-filters";
import en from "@/messages/en.json";
import id from "@/messages/id.json";

// The pure logic behind the customer catalog pages (T8): which area the page shows, the address a
// filter leads to, how long a service takes in words, and which services the landing page features.

const area = (areaId: string, isServed = true): ServiceArea => ({
  id: areaId,
  name: { id: areaId, en: areaId },
  isServed,
});
const areas = [area("jakarta-selatan"), area("jakarta-timur"), area("jakarta-utara", false)];

describe("resolveArea", () => {
  it("starts in Jakarta Selatan", () => {
    expect(defaultAreaId).toBe("jakarta-selatan");
    expect(resolveArea(areas, undefined)?.id).toBe("jakarta-selatan");
  });

  it("shows the area from the address, served or not", () => {
    expect(resolveArea(areas, "jakarta-timur")?.id).toBe("jakarta-timur");
    expect(resolveArea(areas, "jakarta-utara")).toMatchObject({ id: "jakarta-utara", isServed: false });
  });

  it("falls back to the default for an area that does not exist", () => {
    expect(resolveArea(areas, "bandung")?.id).toBe("jakarta-selatan");
  });

  it("falls back to the first area when the default is missing, and to nothing without areas", () => {
    expect(resolveArea([area("jakarta-barat"), area("jakarta-pusat")], "bandung")?.id).toBe("jakarta-barat");
    expect(resolveArea([], undefined)).toBeNull();
  });
});

describe("catalogQuery", () => {
  it("writes the filters in a fixed order: area, type, keyword", () => {
    expect(catalogQuery({ query: "sofa", category: "fabrics", areaId: "jakarta-timur" })).toBe(
      "?area=jakarta-timur&type=fabrics&q=sofa",
    );
  });

  it("leaves out filters that are not set", () => {
    expect(catalogQuery({ areaId: "jakarta-timur" })).toBe("?area=jakarta-timur");
    expect(catalogQuery({ category: "rooms" })).toBe("?type=rooms");
    expect(catalogQuery({})).toBe("");
  });

  it("encodes the keyword", () => {
    expect(catalogQuery({ query: "dapur & kamar" })).toBe("?q=dapur+%26+kamar");
  });
});

describe("splitDuration", () => {
  it("splits minutes into whole hours and the minutes left over", () => {
    expect(splitDuration(120)).toEqual({ hours: 2, minutes: 0 });
    expect(splitDuration(90)).toEqual({ hours: 1, minutes: 30 });
    expect(splitDuration(45)).toEqual({ hours: 0, minutes: 45 });
  });

  it("rounds to whole minutes and never goes below zero", () => {
    expect(splitDuration(89.6)).toEqual({ hours: 1, minutes: 30 });
    expect(splitDuration(-5)).toEqual({ hours: 0, minutes: 0 });
  });
});

describe("the duration messages", () => {
  const tId = createTranslator({ locale: "id", messages: id, namespace: "Service" });
  const tEn = createTranslator({ locale: "en", messages: en, namespace: "Service" });

  it("says about how long a service takes, with the right plural in English", () => {
    expect(tId("durationHours", { hours: 2 })).toBe("± 2 jam");
    expect(tId("durationMinutes", { minutes: 45 })).toBe("± 45 menit");
    expect(tId("durationHoursMinutes", { hours: 1, minutes: 30 })).toBe("± 1 jam 30 menit");
    expect(tEn("durationHours", { hours: 1 })).toBe("About 1 hour");
    expect(tEn("durationHours", { hours: 4 })).toBe("About 4 hours");
    expect(tEn("durationMinutes", { minutes: 45 })).toBe("About 45 minutes");
    expect(tEn("durationHoursMinutes", { hours: 1, minutes: 30 })).toBe("About 1 hour 30 minutes");
  });

  it("does not call the one price a starting price", () => {
    for (const messages of [id.Service, en.Service]) {
      expect(JSON.stringify(messages)).not.toMatch(/mulai dari|\bfrom\b/i);
    }
  });
});

describe("pickFeatured", () => {
  const service = (serviceId: string): Service => ({
    id: serviceId,
    category: "whole-home",
    name: { id: serviceId, en: serviceId },
    description: { id: "", en: "" },
    priceIdr: 100000,
    durationMinutes: 120,
  });
  const list = ["a", "b", "c", "d", "e", "f"].map(service);
  const withPhoto = new Set(["b", "d", "e", "f"]);

  it("features the first services that have a photo, in admin's order", () => {
    expect(pickFeatured(list, (item) => withPhoto.has(item.id), 3).map((item) => item.id)).toEqual(["b", "d", "e"]);
  });

  it("fills up with services without a photo, still in admin's order, when too few have one", () => {
    expect(pickFeatured(list, (item) => item.id === "e", 3).map((item) => item.id)).toEqual(["a", "b", "e"]);
  });

  it("returns every service when there are fewer than asked for", () => {
    expect(pickFeatured(list.slice(0, 2), () => true, 4).map((item) => item.id)).toEqual(["a", "b"]);
  });
});
