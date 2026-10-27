// Midtrans Snap (T10): the hosted payment page of Midtrans, here always the Sandbox, where payments
// are simulated and no money moves (markdown/SPEC.md: "Payment via Midtrans Sandbox"). The server key
// stays on the server (MIDTRANS_SERVER_KEY). Requests only ever go to the Sandbox address below, and
// the Sandbox refuses production keys, so a production key put in by mistake can never charge anyone.
// (Sandbox keys of newer Midtrans accounts no longer start with "SB-", so the key itself is not checked.)
// Plain HTTPS, no SDK.
// Sources: https://docs.midtrans.com/reference/backend-integration ("Create Snap Transaction") and
// https://docs.midtrans.com/docs/snap-snap-integration-guide

const snapUrl = "https://app.sandbox.midtrans.com/snap/v1/transactions";
const paymentPage = /^https:\/\/app\.sandbox\.midtrans\.com\//;

export type PaymentErrorReason = "not_configured" | "refused" | "unexpected" | "network";

export class PaymentError extends Error {
  constructor(readonly reason: PaymentErrorReason) {
    super(`Midtrans payment could not be started (${reason}).`);
    this.name = "PaymentError";
  }
}

export type PaymentOrder = {
  orderId: string;
  serviceId: string;
  serviceName: string;
  /** Whole rupiah, as stored on the order when it was booked. */
  priceIdr: number;
  email: string | undefined;
  phone: string | null;
};

export type SnapPayload = {
  transaction_details: { order_id: string; gross_amount: number };
  item_details: { id: string; price: number; quantity: number; name: string }[];
  customer_details: { email?: string; phone?: string };
  callbacks: { finish: string };
  expiry: { unit: "minutes"; duration: number };
};

/**
 * The Snap request for an order: one item at the order's stored price (never a price from the
 * browser), the customer's contact, where Midtrans sends them back, and one hour to pay.
 */
export function snapPayload(order: PaymentOrder, finishUrl: string): SnapPayload {
  const customer: SnapPayload["customer_details"] = {};
  if (order.email) customer.email = order.email;
  if (order.phone) customer.phone = order.phone;
  return {
    transaction_details: { order_id: order.orderId, gross_amount: order.priceIdr },
    // gross_amount must equal the sum of the items; item names are at most 50 characters.
    item_details: [{ id: order.serviceId, price: order.priceIdr, quantity: 1, name: order.serviceName.slice(0, 50) }],
    customer_details: customer,
    callbacks: { finish: finishUrl },
    expiry: { unit: "minutes", duration: 60 },
  };
}

type CreateOptions = { serverKey: string | undefined; fetchFn?: typeof fetch };

/** Asks Midtrans for a Snap transaction; returns its token and the payment page's address. */
export async function createSnapTransaction(
  payload: SnapPayload,
  { serverKey, fetchFn = fetch }: CreateOptions,
): Promise<{ token: string; redirectUrl: string }> {
  if (!serverKey) throw new PaymentError("not_configured");

  let response: Response;
  try {
    response = await fetchFn(snapUrl, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new PaymentError("network");
  }
  if (!response.ok) throw new PaymentError("refused");

  const body = (await response.json().catch(() => null)) as { token?: unknown; redirect_url?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const redirectUrl = typeof body?.redirect_url === "string" ? body.redirect_url : "";
  if (!token || !paymentPage.test(redirectUrl)) throw new PaymentError("unexpected");
  return { token, redirectUrl };
}
