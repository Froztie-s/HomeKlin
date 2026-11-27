import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRoles, type AppRole } from "@/lib/auth/roles";

// Admin's order search (audit item 1, src/lib/jobs/order-search-actions.ts): the field in the admin
// shell posts an order number to this Server Action, which checks the role, reads the number in the
// usual ways of writing it and goes to /admin/orders/<number>. Anything that cannot be an order number
// comes back as a message key, so the field shows an error without leaving the page. The role check and
// the redirect are replaced by stand-ins.

const authorizeMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("@/lib/auth/dal", () => ({ authorize: authorizeMock }));
vi.mock("@/i18n/navigation", () => ({ redirect: redirectMock }));

const { findOrder } = await import("@/lib/jobs/order-search-actions");

const refusedRoles: AppRole[] = ["customer", "cleaner", "agency", "owner"];

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

/** Who is signed in: authorize(roles) answers the user when their role is among `roles`, else null. */
function signedInAs(role: AppRole | null) {
  authorizeMock.mockImplementation(async (roles: readonly AppRole[]) =>
    role !== null && roles.includes(role) ? { id: `${role}-1`, role, fullName: `Uji ${role}` } : null,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  signedInAs("admin");
});

describe("findOrder", () => {
  it("goes to the order's page, in admin's language", async () => {
    await findOrder(null, form({ code: "  hk1170 ", locale: "en" }));
    expect(authorizeMock).toHaveBeenCalledWith(["admin"]);
    expect(redirectMock).toHaveBeenCalledWith({ href: "/admin/orders/HK-1170", locale: "en" });
  });

  it("reads a bare number and falls back to Indonesian for an unknown language", async () => {
    await findOrder(null, form({ code: "1170", locale: "fr" }));
    expect(redirectMock).toHaveBeenCalledWith({ href: "/admin/orders/HK-1170", locale: "id" });
  });

  it("answers an input that cannot be an order number with a message, and stays", async () => {
    expect(await findOrder(null, form({ code: "HK-12", locale: "id" }))).toEqual({ error: "invalid", value: "HK-12" });
    expect(await findOrder(null, form({ code: "   ", locale: "id" }))).toEqual({ error: "empty", value: "" });
    expect(await findOrder(null, form({ locale: "id" }))).toEqual({ error: "empty", value: "" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  // Each refusal below is made by the role check itself: the stand-in answers like authorize() does
  // (the user when their role is among the roles asked for, otherwise null), so the action is only refused
  // if it asks for admin alone.
  describe("refuses anyone but an admin before reading the form", () => {
    it.each(refusedRoles)("refuses a signed-in %s", async (role) => {
      signedInAs(role);

      expect(await findOrder(null, form({ code: "HK-1170", locale: "id" }))).toEqual({ error: "forbidden", value: "" });

      expect(authorizeMock).toHaveBeenCalledWith(["admin"]);
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("refuses a visitor who is not signed in", async () => {
      signedInAs(null);
      expect(await findOrder(null, form({ code: "HK-1170", locale: "id" }))).toEqual({ error: "forbidden", value: "" });
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("answers a refused role with forbidden, not with a message about what it typed", async () => {
      signedInAs("customer");
      expect(await findOrder(null, form({ code: "", locale: "id" }))).toEqual({ error: "forbidden", value: "" });
      expect(await findOrder(null, form({ code: "HK-12", locale: "id" }))).toEqual({ error: "forbidden", value: "" });
    });

    it("lets the admin through with the same form, so the refusals above are about the role", async () => {
      signedInAs("admin");
      await findOrder(null, form({ code: "HK-1170", locale: "id" }));
      expect(redirectMock).toHaveBeenCalledWith({ href: "/admin/orders/HK-1170", locale: "id" });
    });

    it("covers every role the app has: the ones tried here plus admin", () => {
      expect([...refusedRoles, "admin"].sort()).toEqual([...appRoles].sort());
    });
  });
});
