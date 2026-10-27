import { describe, expect, it, vi } from "vitest";
import { createSnapTransaction, PaymentError, snapPayload } from "@/lib/payment/midtrans";

// Paying with Midtrans Snap (T10): the transaction request (src/lib/payment/midtrans.ts) and the
// Server Action that starts a payment (src/lib/payment/actions.ts). The database rules are tested
// against the test project in tests/integration/payment.test.ts.

const order = {
  orderId: "0b8f3c1e-1111-4222-8333-944455556666",
  serviceId: "regular",
  serviceName: "Pembersihan Rutin",
  priceIdr: 85000,
  email: "nadia@pelanggan-uji.id",
  phone: "+6281234567890",
};
const finishUrl = "https://home-klin.vercel.app/orders?booked=0b8f3c1e-1111-4222-8333-944455556666";
const sandboxKey = "Mid-server-sandbox-abc123";

describe("snapPayload", () => {
  it("charges exactly the order's stored price, for one item, with the customer's contact and the way back", () => {
    expect(snapPayload(order, finishUrl)).toEqual({
      transaction_details: { order_id: order.orderId, gross_amount: 85000 },
      item_details: [{ id: "regular", price: 85000, quantity: 1, name: "Pembersihan Rutin" }],
      customer_details: { email: order.email, phone: order.phone },
      callbacks: { finish: finishUrl },
      expiry: { unit: "minutes", duration: 60 },
    });
  });

  it("keeps the item name within Midtrans' 50 characters", () => {
    const long = snapPayload({ ...order, serviceName: "x".repeat(80) }, finishUrl);
    expect(long.item_details[0].name).toHaveLength(50);
  });
});

describe("createSnapTransaction", () => {
  it("asks Midtrans' sandbox for a Snap transaction with the server key as Basic auth", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ token: "tok-1", redirect_url: "https://app.sandbox.midtrans.com/snap/v4/redirection/tok-1" }, { status: 201 }),
    );

    const result = await createSnapTransaction(snapPayload(order, finishUrl), { serverKey: sandboxKey, fetchFn });

    expect(result).toEqual({ token: "tok-1", redirectUrl: "https://app.sandbox.midtrans.com/snap/v4/redirection/tok-1" });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://app.sandbox.midtrans.com/snap/v1/transactions");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Basic ${Buffer.from(`${sandboxKey}:`).toString("base64")}`);
    expect(JSON.parse(String(init.body)).transaction_details.gross_amount).toBe(85000);
  });

  it("refuses to start without a server key, before calling anyone", async () => {
    const fetchFn = vi.fn();
    for (const serverKey of [undefined, ""]) {
      await expect(createSnapTransaction(snapPayload(order, finishUrl), { serverKey, fetchFn })).rejects.toMatchObject({
        reason: "not_configured",
      });
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("reports a refusal, an unexpected answer or a network error as a PaymentError", async () => {
    const payload = snapPayload(order, finishUrl);
    const refused = vi.fn(async () => Response.json({ error_messages: ["transaction_details.order_id has already been taken"] }, { status: 400 }));
    await expect(createSnapTransaction(payload, { serverKey: sandboxKey, fetchFn: refused })).rejects.toMatchObject({ reason: "refused" });
    const odd = vi.fn(async () => Response.json({ token: "t", redirect_url: "https://evil.example/pay" }, { status: 201 }));
    await expect(createSnapTransaction(payload, { serverKey: sandboxKey, fetchFn: odd })).rejects.toMatchObject({ reason: "unexpected" });
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(createSnapTransaction(payload, { serverKey: sandboxKey, fetchFn: offline })).rejects.toBeInstanceOf(PaymentError);
  });
});
