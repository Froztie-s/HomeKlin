import { describe, expect, it } from "vitest";
import {
  appRoles,
  isAllowed,
  rolesFor,
  roleHome,
  safeNextPath,
  stripLocale,
} from "@/lib/auth/roles";

// Who may open which page (T5). Public pages stay open to everyone; each protected section belongs to
// one role. These rules drive the proxy's sign-in redirect and the server-side role check.
describe("roles", () => {
  it("has the four roles from the spec", () => {
    expect(appRoles).toEqual(["customer", "cleaner", "agency", "admin"]);
  });

  it("sends each role to its own home after signing in", () => {
    expect(roleHome).toEqual({
      customer: "/home",
      cleaner: "/cleaner",
      agency: "/agency",
      admin: "/admin",
    });
  });
});

describe("stripLocale", () => {
  it("removes a language prefix and leaves other paths alone", () => {
    expect(stripLocale("/en/orders")).toBe("/orders");
    expect(stripLocale("/en")).toBe("/");
    expect(stripLocale("/id/agency/schedule")).toBe("/agency/schedule");
    expect(stripLocale("/orders")).toBe("/orders");
    expect(stripLocale("/")).toBe("/");
    expect(stripLocale("/english")).toBe("/english");
  });
});

describe("rolesFor", () => {
  it("leaves the landing page, the app home, services, help and sign-in public", () => {
    for (const path of ["/", "/home", "/services", "/support", "/login", "/signup"]) {
      expect(rolesFor(path)).toBeNull();
    }
  });

  it("gives each protected section to one role, including its sub-pages", () => {
    expect(rolesFor("/orders")).toEqual(["customer"]);
    expect(rolesFor("/account")).toEqual(["customer"]);
    expect(rolesFor("/cleaner")).toEqual(["cleaner"]);
    expect(rolesFor("/cleaner/account")).toEqual(["cleaner"]);
    expect(rolesFor("/agency")).toEqual(["agency"]);
    expect(rolesFor("/agency/schedule")).toEqual(["agency"]);
    expect(rolesFor("/admin")).toEqual(["admin"]);
    expect(rolesFor("/admin/monitor")).toEqual(["admin"]);
  });

  it("matches whole path segments only", () => {
    expect(rolesFor("/agencies")).toBeNull();
    expect(rolesFor("/administrator")).toBeNull();
    expect(rolesFor("/ordersx")).toBeNull();
  });

  it("ignores a trailing slash", () => {
    expect(rolesFor("/agency/")).toEqual(["agency"]);
  });
});

describe("isAllowed", () => {
  it("lets everyone open public pages", () => {
    for (const role of appRoles) expect(isAllowed(role, "/services")).toBe(true);
  });

  it("lets only the owning role open a protected section", () => {
    expect(isAllowed("customer", "/orders")).toBe(true);
    expect(isAllowed("cleaner", "/orders")).toBe(false);
    expect(isAllowed("agency", "/agency/cleaners")).toBe(true);
    expect(isAllowed("customer", "/admin")).toBe(false);
    expect(isAllowed("agency", "/admin")).toBe(false);
    expect(isAllowed("admin", "/agency")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("returns an internal page the role may open", () => {
    expect(safeNextPath("/orders", "customer")).toBe("/orders");
    expect(safeNextPath("/agency/schedule", "agency")).toBe("/agency/schedule");
    expect(safeNextPath("/services", "cleaner")).toBe("/services");
  });

  it("keeps a query string on an allowed page", () => {
    expect(safeNextPath("/services?area=jakarta-selatan", "customer")).toBe("/services?area=jakarta-selatan");
  });

  it("falls back to the role's home for a page that role may not open", () => {
    expect(safeNextPath("/admin", "customer")).toBe("/home");
    expect(safeNextPath("/orders", "agency")).toBe("/agency");
  });

  it("refuses anything that could leave the site (open redirect)", () => {
    for (const next of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "evil.example",
      "/%2F%2Fevil.example",
      " /orders",
    ]) {
      expect(safeNextPath(next, "customer")).toBe("/home");
    }
  });

  it("falls back to the role's home when there is no next page", () => {
    expect(safeNextPath(undefined, "admin")).toBe("/admin");
    expect(safeNextPath(null, "cleaner")).toBe("/cleaner");
    expect(safeNextPath("", "customer")).toBe("/home");
    expect(safeNextPath(42, "customer")).toBe("/home");
  });

  it("drops a language prefix, since the redirect adds the right one", () => {
    expect(safeNextPath("/en/orders", "customer")).toBe("/orders");
  });

  it("does not send a signed-in user back to the sign-in pages", () => {
    expect(safeNextPath("/login", "customer")).toBe("/home");
    expect(safeNextPath("/signup", "customer")).toBe("/home");
  });
});
