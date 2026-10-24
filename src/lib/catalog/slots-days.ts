import type { Locale } from "next-intl";
import type { FreeSlot } from "./catalog";

// The free arrival windows of an area (listFreeSlots, ISO times in UTC), grouped and written the way a
// customer in Jakarta reads them: by their day in Jakarta and in Jakarta time (WIB, UTC+7, no daylight
// saving), whatever time zone the server or the browser runs in. Every Intl call names the time zone,
// so nothing here depends on the machine's clock settings. Both languages use the Indonesian
// conventions for numbers and times ("08.00"), like formatRupiah in src/lib/format.ts.

const timeZone = "Asia/Jakarta";
const dateLocales: Record<Locale, string> = { id: "id-ID", en: "en-ID" };

export type SlotDay = {
  /** The day in Jakarta, as YYYY-MM-DD. */
  date: string;
  /** Whether that day is today or tomorrow in Jakarta. */
  relative: "today" | "tomorrow" | null;
  windows: FreeSlot[];
};

// en-CA writes a date as YYYY-MM-DD, which is what the keys need.
const dateKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

/** The Jakarta day of a moment, as YYYY-MM-DD. */
function jakartaDate(moment: Date): string {
  return dateKeyFormat.format(moment);
}

/** The day after a YYYY-MM-DD date. */
function nextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** The windows grouped by their Jakarta day, days and windows in time order; today and tomorrow marked. */
export function groupSlotsByJakartaDay(slots: readonly FreeSlot[], now: Date): SlotDay[] {
  const today = jakartaDate(now);
  const tomorrow = nextDate(today);
  const sorted = [...slots].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const days = new Map<string, SlotDay>();
  for (const slot of sorted) {
    const date = jakartaDate(new Date(slot.startsAt));
    let day = days.get(date);
    if (!day) {
      day = { date, relative: date === today ? "today" : date === tomorrow ? "tomorrow" : null, windows: [] };
      days.set(date, day);
    }
    day.windows.push(slot);
  }
  return [...days.values()];
}

const timeFormats = new Map<Locale, Intl.DateTimeFormat>();
const weekdayFormats = new Map<Locale, Intl.DateTimeFormat>();
const dayMonthFormats = new Map<Locale, Intl.DateTimeFormat>();

function cached(cache: Map<Locale, Intl.DateTimeFormat>, locale: Locale, options: Intl.DateTimeFormatOptions) {
  let format = cache.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(dateLocales[locale], { timeZone, ...options });
    cache.set(locale, format);
  }
  return format;
}

/** The time of an ISO moment in Jakarta on the 24-hour clock, e.g. "08.00". */
export function formatJakartaTime(iso: string, locale: Locale): string {
  return cached(timeFormats, locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

/** A YYYY-MM-DD Jakarta day as its weekday ("Selasa") and its date ("27 Oktober"). */
export function formatJakartaDay(date: string, locale: Locale): { weekday: string; date: string } {
  const [year, month, day] = date.split("-").map(Number);
  // Noon in Jakarta (05:00Z) is safely inside that day.
  const moment = new Date(Date.UTC(year, month - 1, day, 5));
  return {
    weekday: cached(weekdayFormats, locale, { weekday: "long" }).format(moment),
    date: cached(dayMonthFormats, locale, { day: "numeric", month: "long" }).format(moment),
  };
}
