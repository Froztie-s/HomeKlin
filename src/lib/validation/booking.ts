import type { Locale } from "next-intl";
import { z } from "zod";
import { routing } from "@/i18n/routing";

// The order form (T9, T9b), checked on the server before book_slot() sees it (markdown/CONSTRAINTS.md:
// every Server Action parses its input with Zod). Each problem comes back as a message key per field
// ("Booking.errors.<key>" in src/messages), so both languages show their own text. The limits match
// the orders table (supabase/migrations/20261025090000_orders.sql, 20261025140000_order_contact.sql).
// A signed-in customer sends the order (parseBooking); a guest also sends the email that the code goes
// to (parseGuestOrder), and then the code (parseCode).

export type BookingErrorKey =
  | "serviceInvalid"
  | "areaInvalid"
  | "slotInvalid"
  | "addressTooShort"
  | "addressTooLong"
  | "phoneRequired"
  | "phoneInvalid"
  | "emailRequired"
  | "emailInvalid"
  | "consentRequired"
  | "codeInvalid";

export type BookingField = "serviceId" | "areaId" | "startsAt" | "address" | "phone" | "email" | "consent" | "code";

export type BookingInput = {
  serviceId: string;
  areaId: string;
  startsAt: string;
  address: string;
  /** +628..., the cleaner's contact on the day. */
  phone: string;
  consent: true;
  locale: Locale;
};

export type GuestOrderInput = BookingInput & { email: string };

/**
 * An Indonesian mobile number in the form the database stores (+628 then 7 to 11 digits), from the ways
 * people write it: 0812..., 62812..., +62 812..., with spaces, dashes, dots or brackets. Null otherwise.
 */
export function normalisePhone(value: string): string | null {
  const compact = value.replace(/[\s\-.()]/g, "");
  if (!/^\+?[0-9]+$/.test(compact)) return null;
  let international = compact;
  if (compact.startsWith("0")) international = `+62${compact.slice(1)}`;
  else if (compact.startsWith("62")) international = `+${compact}`;
  return /^\+628[0-9]{7,11}$/.test(international) ? international : null;
}

/** The six digits of an emailed code, spaces ignored, or null. */
export function parseCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\s/g, "");
  return /^[0-9]{6}$/.test(digits) ? digits : null;
}

const slug = (error: BookingErrorKey) =>
  z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error }).max(40, { error });

const phone = z
  .string()
  .trim()
  .min(1, { error: "phoneRequired" })
  .transform((value, context) => {
    const normalised = normalisePhone(value);
    if (!normalised) {
      context.addIssue({ code: "custom", message: "phoneInvalid" });
      return z.NEVER;
    }
    return normalised;
  });

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: "emailRequired" })
  .pipe(z.email({ error: "emailInvalid" }).max(254, { error: "emailInvalid" }));

const locale = z.enum(routing.locales).catch(routing.defaultLocale);

const bookingShape = {
  serviceId: slug("serviceInvalid"),
  areaId: slug("areaInvalid"),
  // The window's start as an ISO 8601 time with its offset (the page sends what listFreeSlots gave it).
  startsAt: z.iso.datetime({ offset: true, error: "slotInvalid" }),
  address: z
    .string()
    .trim()
    .min(10, { error: "addressTooShort" })
    .max(300, { error: "addressTooLong" }),
  phone,
  // A checkbox sends "on" when ticked and nothing at all when not.
  consent: z.literal("on", { error: "consentRequired" }).transform(() => true as const),
  locale,
};

const bookingSchema = z.object(bookingShape);
const guestSchema = z.object({ ...bookingShape, email });

type ParseResult<Data> =
  | { ok: true; data: Data }
  | { ok: false; locale: Locale; fieldErrors: Partial<Record<BookingField, BookingErrorKey>> };

export type BookingParseResult = ParseResult<BookingInput>;
export type GuestOrderParseResult = ParseResult<GuestOrderInput>;

function parse<Schema extends z.ZodObject>(schema: Schema, formData: FormData): ParseResult<z.infer<Schema>> {
  const names = Object.keys(schema.shape);
  const input: Record<string, string | undefined> = Object.fromEntries(
    names.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === "string" ? value : undefined];
    }),
  );
  // A missing text field reads as empty, so it reports its own message rather than a type error.
  for (const name of ["serviceId", "areaId", "startsAt", "address", "phone", "email"]) {
    if (names.includes(name)) input[name] ??= "";
  }

  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const fieldErrors: Partial<Record<BookingField, BookingErrorKey>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as BookingField;
    // The first problem per field is the one to fix first.
    fieldErrors[field] ??= issue.message as BookingErrorKey;
  }
  return { ok: false, locale: locale.parse(input.locale), fieldErrors };
}

/** The order of a signed-in customer. */
export function parseBooking(formData: FormData): BookingParseResult {
  return parse(bookingSchema, formData);
}

/** The order of a guest, with the email the code goes to. */
export function parseGuestOrder(formData: FormData): GuestOrderParseResult {
  return parse(guestSchema, formData);
}
