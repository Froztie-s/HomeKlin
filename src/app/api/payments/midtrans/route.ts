import { amountIdr, hasValidSignature, parseNotification, paymentResult } from "@/lib/payment/notification";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Midtrans' payment notification (T11). Set as the Notification URL in the Midtrans Sandbox dashboard:
// <SITE_URL>/api/payments/midtrans. Midtrans stops on a 2xx answer and retries anything else for up to
// a few hours, and may send the same notification twice: so a valid notification with nothing to change
// is acknowledged, a forged or broken one is refused, and a failure on HomeKlin's side answers 503 so
// Midtrans tries again. apply_payment_result() makes a repeat change nothing.
// Sources: https://docs.midtrans.com/docs/https-notification-webhooks ("Responding HTTP Notification",
// "Best Practice to Handle Notification") and node_modules/next/dist/docs/01-app/03-api-reference/
// 03-file-conventions/route.md

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reply(status: number, body: Record<string, string>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const notification = parseNotification(await request.json().catch(() => null));
  if (!notification) return reply(400, { error: "notification_invalid" });

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    console.error("[payment] MIDTRANS_SERVER_KEY is not set: notification for %s not checked", notification.orderId);
    return reply(503, { error: "not_configured" });
  }
  if (!hasValidSignature(notification, serverKey)) {
    console.warn("[payment] refused a notification with a wrong signature for %s", notification.orderId);
    return reply(403, { error: "signature_invalid" });
  }

  const result = paymentResult(notification.transactionStatus, notification.fraudStatus);
  if (!result) {
    console.info("[payment] %s is %s: nothing to change yet", notification.orderId, notification.transactionStatus);
    return reply(200, { result: "ignored" });
  }
  // Midtrans' own test notification and other merchants' order ids are not HomeKlin orders.
  if (!uuid.test(notification.orderId)) return reply(404, { error: "order_not_found" });
  const amount = amountIdr(notification.grossAmount);
  if (amount === null) return reply(400, { error: "amount_mismatch" });

  try {
    const { data, error } = await createSupabaseServiceClient().rpc("apply_payment_result", {
      p_order: notification.orderId,
      p_status: result,
      p_amount: amount,
    });
    if (error) {
      if (error.message === "order_not_found" || error.message === "amount_mismatch") {
        console.warn("[payment] refused %s for %s: %s", result, notification.orderId, error.message);
        return reply(error.message === "order_not_found" ? 404 : 400, { error: error.message });
      }
      throw new Error(error.message);
    }
    if (result === "paid" && data !== "paid") {
      // Money arrived for an order that failed or was cancelled and whose window has filled up since.
      console.warn("[payment] %s was paid but is %s: refund the payment", notification.orderId, data);
    } else {
      console.info("[payment] %s: Midtrans says %s, order is %s", notification.orderId, notification.transactionStatus, data);
    }
    return reply(200, { result: String(data) });
  } catch (cause) {
    console.error("[payment] could not record %s for %s:", result, notification.orderId, cause);
    return reply(503, { error: "unavailable" });
  }
}
