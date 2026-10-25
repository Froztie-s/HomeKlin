"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "@/i18n/navigation";
import { authorize } from "@/lib/auth/dal";
import { orderConfirmationEmail, sendAppEmail } from "@/lib/email/send";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  parseBooking,
  parseCode,
  parseGuestOrder,
  type BookingErrorKey,
  type BookingField,
  type BookingInput,
} from "@/lib/validation/booking";

// Ordering (T9, T9b). Server Actions are public POST endpoints whatever page shows the form, so every
// action parses its input with Zod first and lets the database decide what may happen.
// - bookService: a signed-in customer orders (authorize, parse, book).
// - sendOrderCode: a guest has filled in the order with their email; Supabase emails them a 6-digit
//   code. Nothing is booked yet, and the answer is the same whether or not the email has an account.
// - placeOrder: the guest types the code; verifying it proves the email is theirs, creates the
//   customer account if the email is new, and signs them in (session cookies); then the order is booked
//   as that customer.
// Booking goes through book_slot() with the customer's own session: the database checks the role
// again, routes the order to a partner agency with a place left in that window and takes the place in
// one transaction (supabase/migrations/20261025090000_orders.sql), so two customers cannot both get the
// last place. Database messages never reach the browser; every refusal becomes a message key the page
// translates. Nothing returned to the browser names the agency. After a successful order the
// confirmation is emailed; an email that cannot be sent never fails the order.

/** Why the order could not be made, as a message key ("Booking.formErrors.<key>"). */
export type BookingFailureKey = "notCustomer" | "slotUnavailable" | "serviceUnavailable" | "rateLimited" | "unavailable";

export type BookingFormState = {
  fieldErrors?: Partial<Record<BookingField, BookingErrorKey>>;
  formError?: BookingFailureKey;
  /** The code was emailed: the page shows the code step. */
  codeSent?: boolean;
  /** The guest is signed in now (the code was right) but the order failed: retry with bookService. */
  signedIn?: boolean;
  /** What the customer typed, to refill the form after an error. */
  values?: { address?: string; phone?: string; email?: string };
} | null;

/** book_slot()'s refusals (raised by name in the migrations) and what the customer is told. */
const refusals: Record<string, BookingFormState> = {
  slot_unavailable: { formError: "slotUnavailable" },
  service_unavailable: { formError: "serviceUnavailable" },
  not_customer: { formError: "notCustomer" },
  consent_required: { fieldErrors: { consent: "consentRequired" } },
  address_invalid: { fieldErrors: { address: "addressTooShort" } },
  phone_invalid: { fieldErrors: { phone: "phoneInvalid" } },
};

function typed(formData: FormData) {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return { address: text("address"), phone: text("phone"), email: text("email") };
}

const siteUrl = () => (process.env.SITE_URL ?? "https://home-klin.vercel.app").replace(/\/+$/, "");

/** Emails the confirmation; reports a failure in the server log only. */
async function emailConfirmation(
  supabase: SupabaseClient,
  to: string,
  orderId: string,
  order: BookingInput & { endsAt: string; priceIdr: number },
) {
  const { data: service } = await supabase.from("services").select("name_id, name_en").eq("id", order.serviceId).maybeSingle();
  const serviceName = (order.locale === "en" ? service?.name_en : service?.name_id) ?? order.serviceId;
  const prefix = order.locale === "en" ? "/en" : "";
  const message = orderConfirmationEmail(
    {
      serviceName,
      startsAt: order.startsAt,
      endsAt: order.endsAt,
      address: order.address,
      priceIdr: order.priceIdr,
      orderUrl: `${siteUrl()}${prefix}/orders?booked=${orderId}`,
    },
    order.locale,
  );
  const result = await sendAppEmail({ to, ...message });
  if (!result.sent) console.warn(`Order confirmation not emailed (${result.reason}).`);
}

/** Books as the signed-in customer of `supabase`; on success emails the confirmation and opens the order. */
async function book(
  supabase: SupabaseClient,
  order: BookingInput,
  email: string | undefined,
  values: NonNullable<BookingFormState>["values"],
  extra: Partial<NonNullable<BookingFormState>> = {},
): Promise<BookingFormState> {
  const { data, error } = await supabase.rpc("book_slot", {
    p_service: order.serviceId,
    p_area: order.areaId,
    p_starts_at: order.startsAt,
    p_address: order.address,
    p_phone: order.phone,
    p_consent: true,
  });
  if (error) {
    const refusal = Object.hasOwn(refusals, error.message) ? refusals[error.message] : { formError: "unavailable" as const };
    return { ...refusal, ...extra, values };
  }

  const [placed] = (data ?? []) as { order_id: string; ends_at: string; price_idr: number }[];
  if (!placed) return { formError: "unavailable", ...extra, values };
  if (email) {
    await emailConfirmation(supabase, email, placed.order_id, { ...order, endsAt: placed.ends_at, priceIdr: placed.price_idr });
  }
  return redirect({ href: { pathname: "/orders", query: { booked: placed.order_id } }, locale: order.locale });
}

/** A signed-in customer orders. */
export async function bookService(_previous: BookingFormState, formData: FormData): Promise<BookingFormState> {
  if (!(await authorize(["customer"]))) return { formError: "notCustomer" };

  const values = typed(formData);
  const parsed = parseBooking(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { data } = await supabase.auth.getUser();
  return book(supabase, parsed.data, data.user?.email ?? undefined, values);
}

/** A guest's order is complete: email them the code. Books nothing. */
export async function sendOrderCode(_previous: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const values = typed(formData);
  const parsed = parseGuestOrder(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    if (error.status === 429 || error.code?.startsWith("over_")) return { formError: "rateLimited", values };
    if (error.code === "email_address_invalid") return { fieldErrors: { email: "emailInvalid" }, values };
    return { formError: "unavailable", values };
  }
  return { codeSent: true, values };
}

/** The guest typed the code: verify it (sign in, account created if new), then book. */
export async function placeOrder(_previous: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const values = typed(formData);
  const parsed = parseGuestOrder(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };
  const code = parseCode(formData.get("code"));
  if (!code) return { fieldErrors: { code: "codeInvalid" }, codeSent: true, values };

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: code, type: "email" });
  if (error) {
    if (error.status === 429) return { formError: "rateLimited", codeSent: true, values };
    return { fieldErrors: { code: "codeInvalid" }, codeSent: true, values };
  }
  return book(supabase, parsed.data, parsed.data.email, values, { signedIn: true });
}

