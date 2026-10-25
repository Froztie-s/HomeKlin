import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseBooking } from "@/lib/validation/booking";

// Ordering (T9, T9b): the signed-in customer's order (bookService), and the guest's order by emailed
// code (sendOrderCode, placeOrder), in src/lib/booking/actions.ts, over book_slot(). The database rules
// and the race are tested against the test project in tests/integration/booking.test.ts; here a
// stand-in client checks each action's order of steps and how every refusal becomes a message key.

const rpc = vi.fn();
const getUser = vi.fn();
const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const redirectMock = vi.fn();
const sendAppEmail = vi.fn();
let user: { id: string; role: string; fullName: string } | null = null;

const serviceRow = { name_id: "Pembersihan Rutin", name_en: "Regular Cleaning" };
const from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: serviceRow, error: null }) }) }) });

vi.mock("@/lib/auth/dal", () => ({ authorize: async (roles: string[]) => (user && roles.includes(user.role) ? user : null) }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc, from, auth: { getUser, signInWithOtp, verifyOtp } }),
}));
vi.mock("@/i18n/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/email/send", async (original) => ({ ...(await original<object>()), sendAppEmail }));

const { bookService, placeOrder, sendOrderCode } = await import("@/lib/booking/actions");

const startsAt = "2026-10-26T01:00:00.000Z";
const placed = { order_id: "order-1", status: "pending_payment", ends_at: "2026-10-26T03:00:00+00:00", price_idr: 85000 };

function form(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    serviceId: "regular",
    areaId: "jakarta-selatan",
    startsAt,
    address: "Jl. Melati No. 10, Kebayoran Baru, Jakarta Selatan",
    phone: "0812 3456 7890",
    email: "nadia@example.com",
    consent: "on",
    locale: "en",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== undefined) data.set(key, value);
  return data;
}

const bookArgs = {
  p_service: "regular",
  p_area: "jakarta-selatan",
  p_starts_at: startsAt,
  p_address: "Jl. Melati No. 10, Kebayoran Baru, Jakarta Selatan",
  p_phone: "+6281234567890",
  p_consent: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  user = { id: "customer-1", role: "customer", fullName: "Uji Pelanggan" };
  getUser.mockResolvedValue({ data: { user: { email: "nadia@example.com" } } });
  sendAppEmail.mockResolvedValue({ sent: true });
});

describe("parseBooking", () => {
  it("reads a complete order with the phone in +62 form", () => {
    expect(parseBooking(form())).toMatchObject({ ok: true, data: { phone: "+6281234567890", consent: true, locale: "en" } });
  });

  it("asks for the consent, an address of 10 to 300 characters, a phone and a window", () => {
    const parsed = parseBooking(form({ consent: undefined, address: "  Jl. A  ", startsAt: "tomorrow", phone: "" }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors).toEqual({
      consent: "consentRequired",
      address: "addressTooShort",
      startsAt: "slotInvalid",
      phone: "phoneRequired",
    });
  });
});

describe("bookService (signed-in customer)", () => {
  it("books through book_slot, emails the confirmation and opens the order in the visitor's language", async () => {
    rpc.mockResolvedValue({ data: [placed], error: null });

    await bookService(null, form());

    expect(rpc).toHaveBeenCalledWith("book_slot", bookArgs);
    expect(sendAppEmail).toHaveBeenCalledTimes(1);
    const [message] = sendAppEmail.mock.calls[0] as [{ to: string; subject: string; text: string }];
    expect(message.to).toBe("nadia@example.com");
    expect(message.subject).toBe("Your HomeKlin order has been placed");
    expect(message.text).toContain("Regular Cleaning");
    expect(message.text).toContain("/en/orders?booked=order-1");
    expect(redirectMock).toHaveBeenCalledWith({ href: { pathname: "/orders", query: { booked: "order-1" } }, locale: "en" });
  });

  it("still opens the order when the email cannot be sent", async () => {
    rpc.mockResolvedValue({ data: [placed], error: null });
    sendAppEmail.mockResolvedValue({ sent: false, reason: "network" });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await bookService(null, form());

    expect(redirectMock).toHaveBeenCalledTimes(1);
  });

  it("refuses anyone but a signed-in customer before reading the form", async () => {
    user = { id: "agency-1", role: "agency", fullName: "Uji Agensi" };
    expect(await bookService(null, form())).toEqual({ formError: "notCustomer" });
    user = null;
    expect(await bookService(null, form())).toEqual({ formError: "notCustomer" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("turns every refusal of the database into its own message, sends no email and keeps the input", async () => {
    const cases: [string, object][] = [
      ["slot_unavailable", { formError: "slotUnavailable" }],
      ["service_unavailable", { formError: "serviceUnavailable" }],
      ["consent_required", { fieldErrors: { consent: "consentRequired" } }],
      ["address_invalid", { fieldErrors: { address: "addressTooShort" } }],
      ["phone_invalid", { fieldErrors: { phone: "phoneInvalid" } }],
      ["not_customer", { formError: "notCustomer" }],
      ["connection reset", { formError: "unavailable" }],
    ];
    for (const [message, expected] of cases) {
      rpc.mockResolvedValueOnce({ data: null, error: { message, code: "P0001" } });
      expect(await bookService(null, form()), message).toMatchObject({ ...expected, values: { phone: "0812 3456 7890" } });
    }
    expect(sendAppEmail).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("sendOrderCode (guest, step 1)", () => {
  beforeEach(() => {
    user = null;
  });

  it("emails a code that may create the account, and books nothing yet", async () => {
    signInWithOtp.mockResolvedValue({ error: null });

    expect(await sendOrderCode(null, form())).toMatchObject({ codeSent: true });
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "nadia@example.com", options: { shouldCreateUser: true } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("checks the whole order before sending a code", async () => {
    const result = await sendOrderCode(null, form({ email: "nadia@", consent: undefined }));
    expect(result).toMatchObject({ fieldErrors: { email: "emailInvalid", consent: "consentRequired" } });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("says when too many codes were asked for", async () => {
    signInWithOtp.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit" } });
    expect(await sendOrderCode(null, form())).toMatchObject({ formError: "rateLimited" });
  });
});

describe("placeOrder (guest, step 2)", () => {
  beforeEach(() => {
    user = null;
  });

  it("verifies the code (which signs the guest in) and then books as that customer", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "new-1" } }, error: null });
    rpc.mockResolvedValue({ data: [placed], error: null });

    await placeOrder(null, form({ code: "123 456" }));

    expect(verifyOtp).toHaveBeenCalledWith({ email: "nadia@example.com", token: "123456", type: "email" });
    expect(rpc).toHaveBeenCalledWith("book_slot", bookArgs);
    expect(verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
    expect((sendAppEmail.mock.calls[0] as [{ to: string }])[0].to).toBe("nadia@example.com");
    expect(redirectMock).toHaveBeenCalledWith({ href: { pathname: "/orders", query: { booked: "order-1" } }, locale: "en" });
  });

  it("books nothing with a missing or wrong code, and stays on the code step", async () => {
    expect(await placeOrder(null, form({ code: "12" }))).toMatchObject({ fieldErrors: { code: "codeInvalid" }, codeSent: true });
    expect(verifyOtp).not.toHaveBeenCalled();

    verifyOtp.mockResolvedValue({ data: { user: null }, error: { status: 403, code: "otp_expired" } });
    expect(await placeOrder(null, form({ code: "999999" }))).toMatchObject({ fieldErrors: { code: "codeInvalid" }, codeSent: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("tells a guest who is now signed in when the window was taken meanwhile", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "new-1" } }, error: null });
    rpc.mockResolvedValue({ data: null, error: { message: "slot_unavailable", code: "P0001" } });

    expect(await placeOrder(null, form({ code: "123456" }))).toMatchObject({ formError: "slotUnavailable", signedIn: true });
    expect(sendAppEmail).not.toHaveBeenCalled();
  });
});
