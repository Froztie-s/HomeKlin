import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// Midtrans' payment notification (T11): after a customer pays, fails or gives up on the Sandbox payment
// page, Midtrans POSTs the transaction's status to /api/payments/midtrans. Only that notification
// decides the order's status, never the customer's browser. Anyone can POST to the endpoint, so a
// notification counts only with Midtrans' signature: SHA-512 of order_id + status_code + gross_amount +
// the server key, which only Midtrans and HomeKlin know.
// Sources: https://docs.midtrans.com/docs/https-notification-webhooks ("Verifying Signature Key",
// "Status Definition") and https://docs.midtrans.com/docs/transaction-status-cycle

export type PaymentNotification = {
  orderId: string;
  statusCode: string;
  /** As Midtrans sends it, for example "85000.00": the signature is computed over this exact text. */
  grossAmount: string;
  signatureKey: string;
  transactionStatus: string;
  fraudStatus: string | undefined;
};

/** What a notification makes of an order. Matches the order_status values in the database. */
export type PaymentResult = "paid" | "failed" | "cancelled";

// Midtrans adds fields over time ("Your implementation should allow new fields"), so unknown ones are
// dropped instead of refused.
const notificationSchema = z.object({
  order_id: z.string().min(1).max(64),
  status_code: z.string().regex(/^\d{3}$/),
  gross_amount: z.string().regex(/^\d{1,12}(\.\d{2})?$/),
  signature_key: z.string().regex(/^[0-9a-fA-F]{128}$/),
  transaction_status: z.string().min(1).max(32),
  fraud_status: z.string().max(32).optional(),
});

/** The fields of a notification body the order needs, or null when it is not a Midtrans notification. */
export function parseNotification(body: unknown): PaymentNotification | null {
  const parsed = notificationSchema.safeParse(body);
  if (!parsed.success) return null;
  const n = parsed.data;
  return {
    orderId: n.order_id,
    statusCode: n.status_code,
    grossAmount: n.gross_amount,
    signatureKey: n.signature_key,
    transactionStatus: n.transaction_status,
    fraudStatus: n.fraud_status,
  };
}

/** True when Midtrans signed exactly this order, status code and amount with HomeKlin's server key. */
export function hasValidSignature(notification: PaymentNotification, serverKey: string): boolean {
  if (!serverKey) return false;
  const expected = createHash("sha512")
    .update(notification.orderId + notification.statusCode + notification.grossAmount + serverKey)
    .digest();
  const given = Buffer.from(notification.signatureKey, "hex");
  // Compared in constant time, so the answer's timing tells nothing about how close a guess was.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * The order's new status, or null while Midtrans has no final answer (pending, a payment held for a
 * fraud check, refunds and the like). Midtrans: a payment succeeded when it is "settlement" (or
 * "capture" for cards) and fraud_status, when sent, is "accept". "deny" and "failure" are failed
 * payments; "cancel" and "expire" (not paid in time) cancel the order.
 */
export function paymentResult(transactionStatus: string, fraudStatus: string | undefined): PaymentResult | null {
  switch (transactionStatus) {
    case "settlement":
    case "capture":
      if (fraudStatus === undefined || fraudStatus === "accept") return "paid";
      return fraudStatus === "deny" ? "failed" : null;
    case "deny":
    case "failure":
      return "failed";
    case "cancel":
    case "expire":
      return "cancelled";
    default:
      return null;
  }
}

/** "85000.00" as whole rupiah, or null for cents or zero: rupiah have no cents, and no order is free. */
export function amountIdr(grossAmount: string): number | null {
  const amount = Number(grossAmount);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
