import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The endpoint Midtrans sends its payment notification to (T11, src/app/api/payments/midtrans/route.ts),
// with a stand-in database. What it answers matters: Midtrans stops on 2xx and retries the rest, so a
// notification the order cannot use yet is acknowledged, a forged one is refused, and a failure on
// HomeKlin's side asks Midtrans to try again later.

const serverKey = "SB-Mid-server-not-a-real-key";
const orderId = "0b8f3c1e-1111-4222-8333-944455556666";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));

const { POST } = await import("@/app/api/payments/midtrans/route");

function signed(fields: Record<string, string>, key = serverKey) {
  const body = {
    order_id: orderId,
    status_code: "200",
    gross_amount: "85000.00",
    transaction_status: "settlement",
    fraud_status: "accept",
    ...fields,
  };
  const signature_key = createHash("sha512")
    .update(body.order_id + body.status_code + body.gross_amount + key)
    .digest("hex");
  return { ...body, signature_key };
}

function post(body: unknown) {
  return POST(
    new Request("https://homeklin.test/api/payments/midtrans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

async function answer(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe("POST /api/payments/midtrans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MIDTRANS_SERVER_KEY", serverKey);
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockImplementation(async (_name: string, args: { p_status: string }) => ({ data: args.p_status, error: null }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["settlement", "paid"],
    ["capture", "paid"],
    ["deny", "failed"],
    ["expire", "cancelled"],
    ["cancel", "cancelled"],
  ])("a signed %s notification sets the order to %s", async (transaction, expected) => {
    const response = await answer(await post(signed({ transaction_status: transaction })));

    expect(response).toEqual({ status: 200, body: { result: expected } });
    expect(rpc).toHaveBeenCalledWith("apply_payment_result", {
      p_order: orderId,
      p_status: expected,
      p_amount: 85000,
    });
  });

  it("answers a repeated notification the same way, with whatever the order already is", async () => {
    rpc.mockResolvedValue({ data: "paid", error: null });
    const notification = signed({ transaction_status: "settlement" });

    const first = await answer(await post(notification));
    const second = await answer(await post(notification));

    expect(first).toEqual({ status: 200, body: { result: "paid" } });
    expect(second).toEqual(first);
  });

  it("acknowledges money for an order that can no longer be paid, and logs it for a refund", async () => {
    rpc.mockResolvedValue({ data: "cancelled", error: null });
    const response = await answer(await post(signed({ transaction_status: "settlement" })));
    expect(response).toEqual({ status: 200, body: { result: "cancelled" } });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("refund"), orderId, "cancelled");
  });

  it("acknowledges a pending payment without touching the order", async () => {
    const response = await answer(await post(signed({ transaction_status: "pending", status_code: "201" })));
    expect(response).toEqual({ status: 200, body: { result: "ignored" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a notification signed with another key, and changes nothing", async () => {
    const response = await answer(await post(signed({}, "SB-Mid-server-someone-else")));
    expect(response).toEqual({ status: 403, body: { error: "signature_invalid" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a notification whose amount was changed after signing", async () => {
    const response = await answer(await post({ ...signed({}), gross_amount: "1000.00" }));
    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["not JSON", "order_id=1"],
    ["missing fields", { order_id: orderId }],
  ])("refuses a body that is %s", async (_case, body) => {
    const response = await answer(await post(body));
    expect(response).toEqual({ status: 400, body: { error: "notification_invalid" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("asks Midtrans to retry when HomeKlin has no server key, instead of trusting the notification", async () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", "");
    const response = await answer(await post(signed({})));
    expect(response).toEqual({ status: 503, body: { error: "not_configured" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers 404 for an order id that is not one of HomeKlin's orders", async () => {
    const response = await answer(await post(signed({ order_id: "payment_notif_test_G000000000" })));
    expect(response).toEqual({ status: 404, body: { error: "order_not_found" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers 404 when the database has no such order", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "order_not_found" } });
    const response = await answer(await post(signed({})));
    expect(response).toEqual({ status: 404, body: { error: "order_not_found" } });
  });

  it("refuses an amount that is not the order's price", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "amount_mismatch" } });
    const response = await answer(await post(signed({})));
    expect(response).toEqual({ status: 400, body: { error: "amount_mismatch" } });
  });

  it("refuses an amount with cents without asking the database", async () => {
    const response = await answer(await post(signed({ gross_amount: "85000.50" })));
    expect(response).toEqual({ status: 400, body: { error: "amount_mismatch" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("asks Midtrans to retry when the database fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    const response = await answer(await post(signed({})));
    expect(response).toEqual({ status: 503, body: { error: "unavailable" } });
  });

  it("never writes the server key or the signature to the log", async () => {
    const notification = signed({ transaction_status: "settlement" });
    await post(notification);
    await post(signed({}, "SB-Mid-server-someone-else"));
    const logged = [console.info, console.warn, console.error]
      .flatMap((log) => vi.mocked(log).mock.calls.flat())
      .map(String)
      .join("\n");
    expect(logged).not.toContain(serverKey);
    expect(logged).not.toContain(notification.signature_key);
  });
});
