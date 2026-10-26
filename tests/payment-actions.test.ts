import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentError, type snapPayload } from "@/lib/payment/midtrans";

// Starting a payment (T10, startPayment in src/lib/payment/actions.ts), with a stand-in Supabase client
// and a stand-in Midtrans. The Snap request itself is tested in tests/payment.test.ts, the database
// rules against the test project in tests/integration/payment.test.ts.

const order = {
  orderId: "0b8f3c1e-1111-4222-8333-944455556666",
  serviceId: "regular",
  serviceName: "Pembersihan Rutin",
  priceIdr: 85000,
  email: "nadia@pelanggan-uji.id",
  phone: "+6281234567890",
};
const rpc = vi.fn();
const getUser = vi.fn();
const redirectMock = vi.fn();
const { createSnap } = vi.hoisted(() => ({ createSnap: vi.fn() }));
let user: { id: string; role: string; fullName: string } | null = null;

vi.mock("@/lib/auth/dal", () => ({ authorize: async (roles: string[]) => (user && roles.includes(user.role) ? user : null) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc, auth: { getUser } }) }));
vi.mock("next/navigation", async (original) => ({ ...(await original<object>()), redirect: redirectMock }));
vi.mock("@/lib/payment/midtrans", async (original) => ({ ...(await original<object>()), createSnapTransaction: createSnap }));

const { startPayment } = await import("@/lib/payment/actions");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ locale: "id", ...values })) data.set(key, value);
  return data;
}

const row = {
  order_id: order.orderId,
  service_id: "regular",
  service_name_id: "Pembersihan Rutin",
  service_name_en: "Regular Cleaning",
  price_idr: 85000,
  contact_phone: order.phone,
  status: "pending_payment",
  payment_url: null,
};

describe("startPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    user = { id: "customer-1", role: "customer", fullName: "Uji" };
    getUser.mockResolvedValue({ data: { user: { email: order.email } } });
    createSnap.mockResolvedValue({ token: "tok-1", redirectUrl: "https://app.sandbox.midtrans.com/snap/v4/redirection/tok-1" });
  });

  it("creates the Snap transaction from the stored order, keeps its link, and sends the customer to pay", async () => {
    rpc.mockImplementation(async (name: string) =>
      name === "order_for_payment" ? { data: [row], error: null } : { data: null, error: null },
    );

    await startPayment(null, form({ orderId: order.orderId }));

    const [payload] = createSnap.mock.calls[0] as [ReturnType<typeof snapPayload>];
    expect(payload.transaction_details).toEqual({ order_id: order.orderId, gross_amount: 85000 });
    expect(payload.customer_details).toEqual({ email: order.email, phone: order.phone });
    expect(payload.callbacks.finish).toMatch(/\/orders\?booked=0b8f3c1e-/);
    expect(rpc).toHaveBeenCalledWith("attach_payment", {
      p_order: order.orderId,
      p_token: "tok-1",
      p_url: "https://app.sandbox.midtrans.com/snap/v4/redirection/tok-1",
    });
    expect(redirectMock).toHaveBeenCalledWith("https://app.sandbox.midtrans.com/snap/v4/redirection/tok-1");
  });

  it("reuses the link of a payment that was started before, without a new transaction", async () => {
    rpc.mockResolvedValue({ data: [{ ...row, payment_url: "https://app.sandbox.midtrans.com/snap/v4/redirection/old" }], error: null });
    await startPayment(null, form({ orderId: order.orderId }));
    expect(createSnap).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("https://app.sandbox.midtrans.com/snap/v4/redirection/old");
  });

  it("refuses anyone but a customer, an order id that is not an id, and an order that is not theirs", async () => {
    user = null;
    expect(await startPayment(null, form({ orderId: order.orderId }))).toEqual({ formError: "notCustomer" });
    user = { id: "customer-1", role: "customer", fullName: "Uji" };
    expect(await startPayment(null, form({ orderId: "../x" }))).toEqual({ formError: "notFound" });
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await startPayment(null, form({ orderId: order.orderId }))).toEqual({ formError: "notFound" });
    expect(createSnap).not.toHaveBeenCalled();
  });

  it("does not charge an order that is no longer waiting for payment", async () => {
    rpc.mockResolvedValue({ data: [{ ...row, status: "paid" }], error: null });
    expect(await startPayment(null, form({ orderId: order.orderId }))).toEqual({ formError: "notPayable" });
    expect(createSnap).not.toHaveBeenCalled();
  });

  it("says payment is not available now when Midtrans cannot be reached or is not set up", async () => {
    rpc.mockResolvedValue({ data: [row], error: null });
    createSnap.mockRejectedValue(new PaymentError("not_configured"));
    expect(await startPayment(null, form({ orderId: order.orderId }))).toEqual({ formError: "paymentUnavailable" });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
