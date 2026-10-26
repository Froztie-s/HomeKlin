"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { authorize } from "@/lib/auth/dal";
import { createSnapTransaction, PaymentError, snapPayload } from "@/lib/payment/midtrans";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Starting a payment (T10). A Server Action is a public POST endpoint, so it checks the customer, then
// reads the order through order_for_payment() with the customer's own session (the database answers
// only for the customer's own order, supabase/migrations/20261026090000_payments.sql), and charges
// exactly the price stored on that order. An order that already has a Snap link reuses it; otherwise a
// new Snap transaction is made and its link stored with attach_payment(). The customer then goes to
// Midtrans' Sandbox payment page; the result comes back to HomeKlin only through Midtrans' signed
// notification (T11), never through the browser.

/** Why the payment could not start, as a message key ("Payment.errors.<key>"). */
export type PaymentFailureKey = "notCustomer" | "notFound" | "notPayable" | "paymentUnavailable";

export type PaymentFormState = { formError?: PaymentFailureKey } | null;

const input = z.object({
  orderId: z.uuid(),
  locale: z.enum(routing.locales).catch(routing.defaultLocale),
});

type PaymentRow = {
  order_id: string;
  service_id: string;
  service_name_id: string;
  service_name_en: string;
  price_idr: number;
  contact_phone: string | null;
  status: string;
  payment_url: string | null;
};

const siteUrl = () => (process.env.SITE_URL ?? "https://home-klin.vercel.app").replace(/\/+$/, "");

export async function startPayment(_previous: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  if (!(await authorize(["customer"]))) return { formError: "notCustomer" };

  const parsed = input.safeParse({ orderId: formData.get("orderId"), locale: formData.get("locale") ?? undefined });
  if (!parsed.success) return { formError: "notFound" };
  const { orderId, locale } = parsed.data;

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { data, error } = await supabase.rpc("order_for_payment", { p_order: orderId });
  const order = ((data ?? []) as PaymentRow[])[0];
  if (error || !order) return { formError: "notFound" };
  if (order.status !== "pending_payment") return { formError: "notPayable" };
  // A payment that was started before keeps its transaction: send the customer back to it.
  if (order.payment_url) return redirect(order.payment_url);

  const { data: account } = await supabase.auth.getUser();
  const prefix = locale === "en" ? "/en" : "";
  const payload = snapPayload(
    {
      orderId: order.order_id,
      serviceId: order.service_id,
      serviceName: locale === "en" ? order.service_name_en : order.service_name_id,
      priceIdr: order.price_idr,
      email: account.user?.email ?? undefined,
      phone: order.contact_phone,
    },
    `${siteUrl()}${prefix}/orders?booked=${order.order_id}`,
  );

  let payment: { token: string; redirectUrl: string };
  try {
    payment = await createSnapTransaction(payload, { serverKey: process.env.MIDTRANS_SERVER_KEY });
  } catch (cause) {
    console.warn(`Payment not started (${cause instanceof PaymentError ? cause.reason : "error"}).`);
    return { formError: "paymentUnavailable" };
  }

  const stored = await supabase.rpc("attach_payment", { p_order: order.order_id, p_token: payment.token, p_url: payment.redirectUrl });
  if (stored.error) return { formError: "notPayable" };
  return redirect(payment.redirectUrl);
}
