import { describe, expect, it } from "vitest";
import { isActivePath } from "@/components/shell/is-active-path";
import { appNavigation } from "@/components/shell/app-navigation";
import { backOfficeNavigation } from "@/components/shell/back-office-navigation";
import { navigation, navigationMessages, type NavKey } from "@/components/shell/navigation";
import en from "@/messages/en.json";
import id from "@/messages/id.json";

const messages = { id, en };
type Locale = keyof typeof messages;

/** The text a message key stands for, e.g. ("id", "AppNavigation", "customer.home") -> "Beranda". */
function message(locale: Locale, namespace: string, key: string): string {
  const value = `${namespace}.${key}`
    .split(".")
    .reduce<unknown>(
      (node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
      messages[locale],
    );
  if (typeof value !== "string") throw new Error(`${locale} has no message ${namespace}.${key}`);
  return value;
}

/** A navigation as people read it in one language: [label, href] per item. */
function items(nav: NavKey, locale: Locale) {
  return navigation[nav].items.map((item) => [message(locale, navigationMessages[nav], item.labelKey), item.href]);
}

function landmark(nav: NavKey, locale: Locale) {
  return message(locale, navigationMessages[nav], navigation[nav].labelKey);
}

const navKeys = Object.keys(navigation) as NavKey[];

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
  it("gives the customer the five agreed sections, in order, in Indonesian", () => {
    expect(items("customer", "id")).toEqual([
      ["Beranda", "/home"],
      ["Layanan", "/services"],
      ["Pesanan", "/orders"],
      ["Bantuan", "/support"],
      ["Akun", "/account"],
    ]);
  });

  it("gives the customer the same five sections in English", () => {
    expect(items("customer", "en")).toEqual([
      ["Home", "/home"],
      ["Services", "/services"],
      ["Orders", "/orders"],
      ["Help", "/support"],
      ["Account", "/account"],
    ]);
  });

  it("never names or links a partner agency in the customer navigation, in either language", () => {
    for (const locale of ["id", "en"] as const) {
      const text = JSON.stringify([landmark("customer", locale), items("customer", locale)]);
      expect(text, locale).not.toMatch(/agensi|agenc|mitra|partner/i);
    }
  });

  it("keeps the back-office menus and their labels out of what the customer and cleaner pages download", () => {
    expect(Object.keys(appNavigation)).toEqual(["customer", "cleaner"]);
    expect(Object.keys(backOfficeNavigation)).toEqual(["agency", "admin"]);
    expect(navigation).toEqual({ ...appNavigation, ...backOfficeNavigation });
    expect(JSON.stringify(appNavigation)).not.toMatch(/agensi|agency|mitra|partner/i);
    // The app shells send the AppNavigation messages to the browser (src/components/shell/mobile-shell.tsx).
    expect(navigationMessages.customer).toBe("AppNavigation");
    expect(navigationMessages.cleaner).toBe("AppNavigation");
    expect(JSON.stringify([id.AppNavigation, en.AppNavigation])).not.toMatch(/agensi|agency|mitra|partner/i);
  });

  it("keeps the cleaner navigation minimal", () => {
    expect(items("cleaner", "id")).toEqual([
      ["Pekerjaan", "/cleaner"],
      ["Akun", "/cleaner/account"],
    ]);
    expect(items("cleaner", "en")).toEqual([
      ["Jobs", "/cleaner"],
      ["Account", "/cleaner/account"],
    ]);
  });

  it("gives the agency its back-office sections, without services or prices", () => {
    expect(items("agency", "id")).toEqual([
      ["Dasbor", "/agency"],
      ["Jadwal", "/agency/schedule"],
      ["Petugas", "/agency/cleaners"],
      ["Pesanan", "/agency/orders"],
      ["Rekaman", "/agency/recordings"],
    ]);
    expect(items("agency", "en")).toEqual([
      ["Dashboard", "/agency"],
      ["Schedule", "/agency/schedule"],
      ["Cleaners", "/agency/cleaners"],
      ["Orders", "/agency/orders"],
      ["Recordings", "/agency/recordings"],
    ]);
  });

  it("gives the admin its console sections, including the price list", () => {
    expect(items("admin", "id")).toEqual([
      ["Dasbor", "/admin"],
      ["Monitor Langsung", "/admin/monitor"],
      ["Tiket", "/admin/tickets"],
      ["Rekaman", "/admin/recordings"],
      ["Layanan & Harga", "/admin/services"],
      ["FAQ", "/admin/faq"],
    ]);
    expect(items("admin", "en")).toEqual([
      ["Dashboard", "/admin"],
      ["Live monitor", "/admin/monitor"],
      ["Tickets", "/admin/tickets"],
      ["Recordings", "/admin/recordings"],
      ["Services & prices", "/admin/services"],
      ["FAQ", "/admin/faq"],
    ]);
  });

  it("marks exactly one item as current on each item's own page", () => {
    for (const [key, { items: navItems }] of Object.entries(navigation)) {
      for (const item of navItems) {
        const current = navItems.filter((other) => isActivePath(item.href, other)).map((other) => other.href);
        expect(current, `${key} navigation on ${item.href}`).toEqual([item.href]);
      }
    }
  });

  it("names each navigation landmark differently, so screen readers can tell them apart", () => {
    for (const locale of ["id", "en"] as const) {
      const labels = navKeys.map((nav) => landmark(nav, locale));
      expect(labels[0], locale).toBe(locale === "id" ? "Navigasi utama" : "Main navigation");
      expect(new Set(labels).size, locale).toBe(labels.length);
    }
  });
});
