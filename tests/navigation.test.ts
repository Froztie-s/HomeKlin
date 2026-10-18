import { describe, expect, it } from "vitest";
import { isActivePath } from "@/components/shell/is-active-path";
import { navigation } from "@/components/shell/navigation";

describe("isActivePath", () => {
  it("marks a section root as active only on that exact path", () => {
    const home = { href: "/", exact: true };
    expect(isActivePath("/", home)).toBe(true);
    expect(isActivePath("/agencies", home)).toBe(false);
  });

  it("keeps a dashboard root inactive on its sub-pages", () => {
    const dashboard = { href: "/agency", exact: true };
    expect(isActivePath("/agency", dashboard)).toBe(true);
    expect(isActivePath("/agency/services", dashboard)).toBe(false);
  });

  it("marks a section as active on its own path and on deeper paths", () => {
    const agencies = { href: "/agencies" };
    expect(isActivePath("/agencies", agencies)).toBe(true);
    expect(isActivePath("/agencies/melati-kilau", agencies)).toBe(true);
  });

  it("does not treat a path that only shares a prefix as the same section", () => {
    expect(isActivePath("/agency", { href: "/agencies" })).toBe(false);
    expect(isActivePath("/agencies-old", { href: "/agencies" })).toBe(false);
  });

  it("ignores a trailing slash", () => {
    expect(isActivePath("/agencies/", { href: "/agencies" })).toBe(true);
    expect(isActivePath("/agency/", { href: "/agency", exact: true })).toBe(true);
  });
});

describe("navigation", () => {
  it("gives the customer the five agreed sections, in order", () => {
    expect(navigation.customer.items.map((item) => [item.label, item.href])).toEqual([
      ["Beranda", "/"],
      ["Agensi", "/agencies"],
      ["Pesanan", "/orders"],
      ["Bantuan", "/support"],
      ["Akun", "/account"],
    ]);
  });

  it("keeps the cleaner navigation minimal", () => {
    expect(navigation.cleaner.items.map((item) => [item.label, item.href])).toEqual([
      ["Pekerjaan", "/cleaner"],
      ["Akun", "/cleaner/account"],
    ]);
  });

  it("gives the agency its back-office sections", () => {
    expect(navigation.agency.items.map((item) => [item.label, item.href])).toEqual([
      ["Dasbor", "/agency"],
      ["Layanan", "/agency/services"],
      ["Jadwal", "/agency/schedule"],
      ["Petugas", "/agency/cleaners"],
      ["Pesanan", "/agency/orders"],
      ["Rekaman", "/agency/recordings"],
    ]);
  });

  it("gives the admin its console sections", () => {
    expect(navigation.admin.items.map((item) => [item.label, item.href])).toEqual([
      ["Dasbor", "/admin"],
      ["Monitor Langsung", "/admin/monitor"],
      ["Tiket", "/admin/tickets"],
      ["Rekaman", "/admin/recordings"],
      ["FAQ", "/admin/faq"],
    ]);
  });

  it("matches each section root exactly, so only one item is ever current", () => {
    for (const { items } of Object.values(navigation)) {
      const [root, ...rest] = items;
      expect(root.exact).toBe(true);
      for (const item of rest) expect(item.href.startsWith(root.href)).toBe(true);
    }
  });

  it("names each navigation landmark differently, so screen readers can tell them apart", () => {
    const labels = Object.values(navigation).map((nav) => nav.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
