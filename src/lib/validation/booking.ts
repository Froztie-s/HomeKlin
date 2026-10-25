import type { Locale } from "next-intl";
import { z } from "zod";
import { routing } from "@/i18n/routing";

// The booking form (T9), checked on the server before book_slot() sees it (markdown/CONSTRAINTS.md:
// every Server Action parses its input with Zod). Each problem comes back as a message key per field
// ("Booking.errors.<key>" in src/messages), so both languages show their own text. The limits match
// the orders table (supabase/migrations/20261025090000_orders.sql).

export type BookingErrorKey =
  | "serviceInvalid"
  | "areaInvalid"
  | "slotInvalid"
  | "addressTooShort"
  | "addressTooLong"
  | "consentRequired";

export type BookingField = "serviceId" | "areaId" | "startsAt" | "address" | "consent";

export type BookingInput = {
  serviceId: string;
  areaId: string;
  startsAt: string;
  address: string;
  consent: true;
  locale: Locale;
};

const slug = (error: BookingErrorKey) =>
  z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error }).max(40, { error });

const schema = z.object({
  serviceId: slug("serviceInvalid"),
  areaId: slug("areaInvalid"),
  // The window's start as an ISO 8601 time with its offset (the page sends what listFreeSlots gave it).
  startsAt: z.iso.datetime({ offset: true, error: "slotInvalid" }),
  address: z
    .string()
    .trim()
    .min(10, { error: "addressTooShort" })
    .max(300, { error: "addressTooLong" }),
  // A checkbox sends "on" when ticked and nothing at all when not.
  consent: z.literal("on", { error: "consentRequired" }).transform(() => true as const),
  locale: z.enum(routing.locales).catch(routing.defaultLocale),
});

const fields = ["serviceId", "areaId", "startsAt", "address", "consent", "locale"] as const;

export type BookingParseResult =
  | { ok: true; data: BookingInput }
  | { ok: false; locale: Locale; fieldErrors: Partial<Record<BookingField, BookingErrorKey>> };

export function parseBooking(formData: FormData): BookingParseResult {
  const input = Object.fromEntries(
    fields.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === "string" ? value : undefined];
    }),
  );
  // A missing text field reads as empty, so it reports its own message rather than a type error.
  for (const name of ["serviceId", "areaId", "startsAt", "address"] as const) input[name] ??= "";

  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const fieldErrors: Partial<Record<BookingField, BookingErrorKey>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as BookingField;
    // The first problem per field is the one to fix first.
    fieldErrors[field] ??= issue.message as BookingErrorKey;
  }
  return { ok: false, locale: schema.shape.locale.parse(input.locale), fieldErrors };
}
