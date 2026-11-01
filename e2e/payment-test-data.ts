import { createHash } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { adminClient } from "../tests/integration/test-project";

// Playing Midtrans in the specs (T11): notifications signed with the Sandbox server key, POSTed to the
// running app's /api/payments/midtrans exactly as Midtrans does once a Sandbox payment succeeds, fails
// or expires. They are the way to set an order to paid, failed or cancelled.

function serverKey(): string {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) throw new Error("MIDTRANS_SERVER_KEY (Sandbox) is not set: the notification tests sign with it (see .env.example).");
  return key;
}

export async function orderRow(orderId: string) {
  const { data, error } = await adminClient().from("orders").select("status, price_idr, slot_id").eq("id", orderId).single();
  if (error || !data) throw new Error(`Could not read the test order: ${error?.message}`);
  return data as { status: string; price_idr: number; slot_id: string };
}

/** A notification as Midtrans sends it for this order, signed with the given key. */
export async function notification(orderId: string, transactionStatus: string, statusCode: string, key = serverKey()) {
  const amount = `${(await orderRow(orderId)).price_idr}.00`;
  return {
    transaction_time: "2026-10-28 10:15:00",
    transaction_status: transactionStatus,
    transaction_id: crypto.randomUUID(),
    status_message: "midtrans payment notification",
    status_code: statusCode,
    signature_key: createHash("sha512").update(orderId + statusCode + amount + key).digest("hex"),
    payment_type: "bank_transfer",
    order_id: orderId,
    merchant_id: "G000000000",
    gross_amount: amount,
    fraud_status: "accept",
    currency: "IDR",
  };
}

export async function notify(request: APIRequestContext, body: object) {
  const response = await request.post("/api/payments/midtrans", { data: body });
  return { status: response.status(), body: await response.json() };
}
