import { describe, expect, it } from "vitest";
import { isActivePath } from "@/components/shell/is-active-path";
import { appNavigation } from "@/components/shell/app-navigation";
import { backOfficeNavigation } from "@/components/shell/back-office-navigation";
import { navigation } from "@/components/shell/navigation";

describe("isActivePath", () => {
  it("marks an exact item as active only on that exact path", () => {
    const home = { href: "/home", exact: true };
    expect(isActivePath("/home", home)).toBe(true);
    expect(isActivePath("/home/settings", home)).toBe(false);
    expect(isActivePath("/services", home)).toBe(false);
  });

  it("keeps a dashboard root inactive on its sub-pages", () => {
    const dashboard = { href: "/agency", exact: true };
    expect(isActivePath("/agency", dashboard)).toBe(true);
    expect(isActivePath("/agency/schedule", dashboard)).toBe(false);
  });

  it("marks a section as active on its own path and on deeper paths", () => {
    const services = { href: "/services" };
    expect(isActivePath("/services", services)).toBe(true);
    expect(isActivePath("/services/deep", services)).toBe(true);
  });

  it("does not treat a path that only shares a prefix as the same section", () => {
    expect(isActivePath("/order", { href: "/orders" })).toBe(false);
    expect(isActivePath("/services-old", { href: "/services" })).toBe(false);
  });

  it("ignores a trailing slash", () => {
    expect(isActivePath("/services/", { href: "/services" })).toBe(true);
    expect(isActivePath("/agency/", { href: "/agency", exact: true })).toBe(true);
  });
});

describe("navigation", () => {
  it("gives the customer the five agreed sections, in order", () => {
    expect(navigation.customer.items.map((item) => [item.label, item.href])).toEqual([
      ["Beranda", "/home"],
      ["Layanan", "/services"],
      ["Pesanan", "/orders"],
      ["Bantuan", "/support"],
      ["Akun", "/account"],
    ]);
  });

  it("never names or links a partner agency in the customer navigation", () => {
    for (const item of navigation.customer.items) {
      expect(`${item.label} ${item.href}`).not.toMatch(/agensi|agenc|mitra/i);
    }
  });

  it("keeps the back-office menus out of the module the customer and cleaner pages download", () => {
    expect(Object.keys(appNavigation)).toEqual(["customer", "cleaner"]);
    expect(Object.keys(backOfficeNavigation)).toEqual(["agency", "admin"]);
    expect(JSON.stringify(appNavigation)).not.toMatch(/agensi|agency|mitra/i);
    expect(navigation).toEqual({ ...appNavigation, ...backOfficeNavigation });
  });

  it("keeps the cleaner navigation minimal", () => {
    expect(navigation.cleaner.items.map((item) => [item.label, item.href])).toEqual([
      ["Pekerjaan", "/cleaner"],
      ["Akun", "/cleaner/account"],
    ]);
  });

  it("gives the agency its back-office sections, without services or prices", () => {
    expect(navigation.agency.items.map((item) => [item.label, item.href])).toEqual([
      ["Dasbor", "/agency"],
      ["Jadwal", "/agency/schedule"],
      ["Petugas", "/agency/cleaners"],
      ["Pesanan", "/agency/orders"],
      ["Rekaman", "/agency/recordings"],
    ]);
  });

  it("gives the admin its console sections, including the price list", () => {
    expect(navigation.admin.items.map((item) => [item.label, item.href])).toEqual([
      ["Dasbor", "/admin"],
      ["Monitor Langsung", "/admin/monitor"],
      ["Tiket", "/admin/tickets"],
      ["Rekaman", "/admin/recordings"],
      ["Layanan & Harga", "/admin/services"],
      ["FAQ", "/admin/faq"],
    ]);
  });

  it("marks exactly one item as current on each item's own page", () => {
    for (const [key, { items }] of Object.entries(navigation)) {
      for (const item of items) {
        const current = items.filter((other) => isActivePath(item.href, other)).map((other) => other.href);
        expect(current, `${key} navigation on ${item.href}`).toEqual([item.href]);
      }
    }
  });

  it("names each navigation landmark differently, so screen readers can tell them apart", () => {
    const labels = Object.values(navigation).map((nav) => nav.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
