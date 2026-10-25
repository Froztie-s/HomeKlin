import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseBooking } from "@/lib/validation/booking";

// Booking (T9): the form's validation (src/lib/validation/booking.ts) and the Server Action
// (src/lib/booking/actions.ts) over book_slot(). The database rules and the race are tested against the
// test project in tests/integration/booking.test.ts; here a stand-in client checks the action's order of
// steps and how every refusal of the database becomes a message the page can translate.

const rpc = vi.fn();
const redirectMock = vi.fn();
let user: { id: string; role: string; fullName: string } | null = null;

vi.mock("@/lib/auth/dal", () => ({ authorize: async (roles: string[]) => (user && roles.includes(user.role) ? user : null) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));
vi.mock("@/i18n/navigation", () => ({ redirect: redirectMock }));

const { bookService } = await import("@/lib/booking/actions");

const startsAt = "2026-10-26T01:00:00.000Z";

function form(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    serviceId: "regular",
    areaId: "jakarta-selatan",
    startsAt,
    address: "Jl. Melati No. 10, Kebayoran Baru, Jakarta Selatan",
    consent: "on",
    locale: "en",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== undefined) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  user = { id: "customer-1", role: "customer", fullName: "Uji Pelanggan" };
});

describe("parseBooking", () => {
  it("reads a complete booking", () => {
    const parsed = parseBooking(form());
    expect(parsed).toEqual({
      ok: true,
      data: {
        serviceId: "regular",
        areaId: "jakarta-selatan",
        startsAt,
        address: "Jl. Melati No. 10, Kebayoran Baru, Jakarta Selatan",
        consent: true,
        locale: "en",
      },
    });
  });

  it("asks for the consent, an address of 10 to 300 characters, and a window", () => {
    const parsed = parseBooking(form({ consent: undefined, address: "  Jl. A  ", startsAt: "tomorrow" }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors).toEqual({ consent: "consentRequired", address: "addressTooShort", startsAt: "slotInvalid" });
  });

  it("refuses a service or area id that is not a plain slug, and an address that is too long", () => {
    const parsed = parseBooking(form({ serviceId: "../x", areaId: "", address: "x".repeat(301) }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors).toMatchObject({ serviceId: "serviceInvalid", areaId: "areaInvalid", address: "addressTooLong" });
  });
});

describe("bookService", () => {
  it("books through book_slot and opens the order, waiting for payment, in the visitor's language", async () => {
    rpc.mockResolvedValue({ data: [{ order_id: "order-1", status: "pending_payment" }], error: null });

    await bookService(null, form());

    expect(rpc).toHaveBeenCalledWith("book_slot", {
      p_service: "regular",
      p_area: "jakarta-selatan",
      p_starts_at: startsAt,
      p_address: "Jl. Melati No. 10, Kebayoran Baru, Jakarta Selatan",
      p_consent: true,
    });
    expect(redirectMock).toHaveBeenCalledWith({ href: { pathname: "/orders", query: { booked: "order-1" } }, locale: "en" });
  });

  it("refuses anyone but a customer before reading the form", async () => {
    user = { id: "agency-1", role: "agency", fullName: "Uji Agensi" };
    expect(await bookService(null, form())).toEqual({ formError: "notCustomer" });
    user = null;
    expect(await bookService(null, form())).toEqual({ formError: "notCustomer" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("never calls the database with an invalid form, and keeps what the customer typed", async () => {
    const result = await bookService(null, form({ consent: undefined }));
    expect(result).toMatchObject({ fieldErrors: { consent: "consentRequired" }, values: { address: expect.any(String) } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("tells the customer when the window was taken in the meantime", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "slot_unavailable", code: "P0001" } });
    expect(await bookService(null, form())).toMatchObject({ formError: "slotUnavailable" });
  });

  it("turns every other refusal of the database into its own message, and anything unknown into a retry", async () => {
    const cases: [string, object][] = [
      ["service_unavailable", { formError: "serviceUnavailable" }],
      ["consent_required", { fieldErrors: { consent: "consentRequired" } }],
      ["address_invalid", { fieldErrors: { address: "addressTooShort" } }],
      ["not_customer", { formError: "notCustomer" }],
      ["connection reset", { formError: "unavailable" }],
    ];
    for (const [message, expected] of cases) {
      rpc.mockResolvedValueOnce({ data: null, error: { message, code: "P0001" } });
      expect(await bookService(null, form()), message).toMatchObject(expected);
    }
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
