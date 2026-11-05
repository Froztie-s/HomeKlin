import type { AgencySlot } from "@/lib/agency/agency";

// The agency's schedule ("Jadwal", T27) in Jakarta time (WIB, UTC+7 all year, no daylight saving),
// whatever time zone the server or the browser runs in. The agency types a date and two clock times;
// the server actions take ISO times with their offset, so a window is written with "+07:00". The page
// shows one week of seven days at a time, from today, over the 60 days the database lists
// (agency_slots()). Pure, so tests/agency-ui.test.ts can pin "now".

const dayMs = 86_400_000;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

// en-CA writes a date as YYYY-MM-DD, which compares in time order as plain text.
const dateKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });

/** The Jakarta day of a moment, as YYYY-MM-DD. */
export function jakartaDateOf(moment: Date | string): string {
  return dateKeyFormat.format(typeof moment === "string" ? new Date(moment) : moment);
}

/** Today's date in Jakarta, as YYYY-MM-DD (what an <input type="date"> holds). */
export function jakartaToday(now: Date): string {
  return jakartaDateOf(now);
}

/** A YYYY-MM-DD date `days` later (or earlier). */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** "2026-12-03" and "20:35" -> "2026-12-03T20:35:00+07:00"; null for anything else. */
export function jakartaIso(date: string, time: string): string | null {
  const day = datePattern.exec(date);
  if (!day || !timePattern.test(time)) return null;
  const [year, month, dayOfMonth] = [Number(day[1]), Number(day[2]), Number(day[3])];
  const check = new Date(Date.UTC(year, month - 1, dayOfMonth));
  // 30 February would roll over into March: not a real date.
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== dayOfMonth) return null;
  return `${date}T${time}:00+07:00`;
}

export type SlotWindowInput = { ok: true; startsAt: string; endsAt: string } | { ok: false };

/** The window a date and two times describe, or not ok when a field is empty or it ends before it starts. */
export function slotWindowInput(date: string, start: string, end: string): SlotWindowInput {
  const startsAt = jakartaIso(date, start);
  const endsAt = jakartaIso(date, end);
  if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) return { ok: false };
  return { ok: true, startsAt, endsAt };
}

/** The last week the page offers: the database lists windows up to 60 days ahead (weeks 0 to 8). */
export const lastScheduleWeek = Math.floor(59 / 7);

export type ScheduleWeek = { from: string; to: string };

/** Week `index` of the schedule: seven Jakarta days, the first starting today. */
export function scheduleWeek(index: number, now: Date): ScheduleWeek {
  const from = addDays(jakartaToday(now), index * 7);
  return { from, to: addDays(from, 6) };
}

/** Which week of the schedule a window starts in. */
export function weekOfSlot(startsAt: string, now: Date): number {
  const [today, day] = [jakartaToday(now), jakartaDateOf(startsAt)].map((date) => Date.parse(`${date}T00:00:00Z`));
  return Math.floor(Math.round((day - today) / dayMs) / 7);
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** ?week= in the address: a whole number from 0 to the last week, else this week (0). */
export function parseScheduleWeek(value: string | string[] | undefined): number {
  const text = first(value);
  if (!text || !/^\d{1,2}$/.test(text)) return 0;
  const week = Number(text);
  return week <= lastScheduleWeek ? week : 0;
}

/** ?area= in the address, when it is one of the agency's own areas; null shows every area. */
export function parseScheduleArea(value: string | string[] | undefined, areaIds: readonly string[]): string | null {
  const text = first(value);
  return text && areaIds.includes(text) ? text : null;
}

export type ScheduleDay = { date: string; areas: { areaId: string; slots: AgencySlot[] }[] };

/**
 * The windows of one week by Jakarta day, and within a day by area (in `areaOrder`, the agency's own
 * areas), each area's windows earliest first. Days without windows are left out.
 */
export function groupScheduleDays(slots: readonly AgencySlot[], areaOrder: readonly string[], week: ScheduleWeek): ScheduleDay[] {
  const rank = (areaId: string) => {
    const index = areaOrder.indexOf(areaId);
    return index === -1 ? areaOrder.length : index;
  };
  const sorted = [...slots].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const days = new Map<string, Map<string, AgencySlot[]>>();
  for (const slot of sorted) {
    const date = jakartaDateOf(slot.startsAt);
    if (date < week.from || date > week.to) continue;
    const areas = days.get(date) ?? new Map<string, AgencySlot[]>();
    days.set(date, areas);
    areas.set(slot.areaId, [...(areas.get(slot.areaId) ?? []), slot]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, areas]) => ({
      date,
      areas: [...areas.entries()].sort(([a], [b]) => rank(a) - rank(b)).map(([areaId, list]) => ({ areaId, slots: list })),
    }));
}
