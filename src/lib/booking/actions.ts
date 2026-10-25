"use server";

import { redirect } from "@/i18n/navigation";
import { authorize } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseBooking, type BookingErrorKey, type BookingField } from "@/lib/validation/booking";

// Booking (T9). A Server Action is a public POST endpoint whatever page shows the form, so it:
// 1. checks that a customer is signed in (authorize, src/lib/auth/dal.ts), before reading the form;
// 2. parses the form with Zod (src/lib/validation/booking.ts);
// 3. books through book_slot() with the customer's own session: the database checks the role again,
//    routes the booking to a partner agency with a place left in that window and takes the place in one
//    transaction (supabase/migrations/20261025090000_orders.sql), so two customers cannot both get the
//    last place;
// 4. opens the order, which waits for payment (T10).
// Database messages never reach the browser; every refusal becomes a message key the page translates.
// Nothing returned to the browser names the agency.

/** Why the booking could not be made, as a message key ("Booking.formErrors.<key>"). */
export type BookingFailureKey = "notCustomer" | "slotUnavailable" | "serviceUnavailable" | "unavailable";

export type BookingFormState = {
  fieldErrors?: Partial<Record<BookingField, BookingErrorKey>>;
  formError?: BookingFailureKey;
  /** What the customer typed, to refill the form after an error. */
  values?: { address?: string };
} | null;

/** book_slot()'s refusals (raised by name in the migration) and what the customer is told. */
const refusals: Record<string, BookingFormState> = {
  slot_unavailable: { formError: "slotUnavailable" },
  service_unavailable: { formError: "serviceUnavailable" },
  not_customer: { formError: "notCustomer" },
  consent_required: { fieldErrors: { consent: "consentRequired" } },
  address_invalid: { fieldErrors: { address: "addressTooShort" } },
};

export async function bookService(_previous: BookingFormState, formData: FormData): Promise<BookingFormState> {
  if (!(await authorize(["customer"]))) return { formError: "notCustomer" };

  const address = formData.get("address");
  const values = { address: typeof address === "string" ? address : "" };
  const parsed = parseBooking(formData);
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };

  const { serviceId, areaId, startsAt, address: cleanAddress, locale } = parsed.data;
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { data, error } = await supabase.rpc("book_slot", {
    p_service: serviceId,
    p_area: areaId,
    p_starts_at: startsAt,
    p_address: cleanAddress,
    p_consent: true,
  });
  if (error) {
    const refusal = Object.hasOwn(refusals, error.message) ? refusals[error.message] : { formError: "unavailable" as const };
    return { ...refusal, values };
  }

  const [order] = (data ?? []) as { order_id: string }[];
  if (!order) return { formError: "unavailable", values };
  return redirect({ href: { pathname: "/orders", query: { booked: order.order_id } }, locale });
}
