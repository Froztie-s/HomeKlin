import type { FreeSlot } from "@/lib/catalog/catalog";
import { groupSlotsByJakartaDay, type SlotDay } from "@/lib/catalog/slots-days";

// The addresses of the booking screens (T9, T9b). The old booking address,
// /book?service=<id>&area=<id>&starts=<ISO start of the window>, now leads to the order page
// (./order-query.ts, which reads its own address with the same rules); the confirmation is
// /orders?booked=<order id>. Whatever the address says is only a suggestion: the
// page checks it against the catalog and the free windows, and the booking action checks every field
// again on the server (src/lib/validation/booking.ts).

type SearchParams = Record<string, string | string[] | undefined>;

export type BookingQuery = {
  serviceId?: string;
  areaId?: string;
  /** The window's start as the catalog writes it (ISO 8601 in UTC, e.g. 2026-11-06T08:00:00.000Z). */
  startsAt?: string;
};

// The same id rule as the booking form (lowercase words joined by hyphens, at most 40 characters).
const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// A date and a time with its offset; a date alone is not a window.
const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function first(value: string | string[] | undefined): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === "string" ? text.trim() : undefined;
}

function slug(value: string | string[] | undefined): string | undefined {
  const text = first(value);
  return text && text.length <= 40 && slugPattern.test(text) ? text : undefined;
}

/** An ISO time written the way the catalog writes it, or undefined. */
function isoStart(value: string | string[] | undefined): string | undefined {
  const text = first(value);
  if (!text || !isoPattern.test(text)) return undefined;
  const time = Date.parse(text);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

/** The service, area and window in the booking page's address; anything unreadable is left out. */
export function parseBookingQuery(params: SearchParams): BookingQuery {
  const query: BookingQuery = {};
  const serviceId = slug(params.service);
  const areaId = slug(params.area);
  const startsAt = isoStart(params.starts);
  if (serviceId) query.serviceId = serviceId;
  if (areaId) query.areaId = areaId;
  if (startsAt) query.startsAt = startsAt;
  return query;
}

/** The free window that starts at that moment, or null when it is not (or no longer) free. */
export function findFreeWindow(slots: readonly FreeSlot[], startsAt: string | undefined): FreeSlot | null {
  if (!startsAt) return null;
  const time = Date.parse(startsAt);
  return slots.find((slot) => Date.parse(slot.startsAt) === time) ?? null;
}

/** The id of the order the confirmation shows (/orders?booked=<id>), or undefined. */
export function parseBookedOrderId(params: SearchParams): string | undefined {
  const text = first(params.booked)?.toLowerCase();
  return text && uuidPattern.test(text) ? text : undefined;
}

/** A window's day in Jakarta (YYYY-MM-DD) and whether that is today or tomorrow there. */
export function jakartaDayOf(startsAt: string, now: Date): Pick<SlotDay, "date" | "relative"> {
  const [day] = groupSlotsByJakartaDay([{ startsAt, endsAt: startsAt }], now);
  return { date: day.date, relative: day.relative };
}
