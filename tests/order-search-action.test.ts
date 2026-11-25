import { beforeEach, describe, expect, it, vi } from "vitest";

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

const admin = { id: "admin-1", role: "admin", fullName: "Uji Admin" };

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeMock.mockResolvedValue(admin);
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

  it("refuses anyone but an admin before reading the form", async () => {
    for (const role of ["customer", "cleaner", "agency", "owner"]) {
      authorizeMock.mockResolvedValueOnce(null);
      expect(await findOrder(null, form({ code: "HK-1170", locale: "id" })), role).toEqual({ error: "forbidden", value: "" });
    }
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
