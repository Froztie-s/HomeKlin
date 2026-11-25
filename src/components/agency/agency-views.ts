import type { AgencySlot } from "@/lib/agency/agency";
import { jobProgress, type AgencyJob, type JobProgress } from "@/lib/jobs/jobs";
import { VALID_DAYS, type ValidDays } from "@/lib/payouts/schemas";
import { backOfficeRecordingState } from "./recording-state";
import { addDays, jakartaDateOf } from "./schedule-time";

// The redesigned agency back office's pure pieces (D2, after the partner mocks): the summary's range
// (?days=) and daily bars, the incoming jobs ("Pekerjaan masuk") and the completed ones ("Pesanan
// selesai") with their filters and search from the address, the Jakarta week (Monday to Sunday), and
// the week overview of the agency's arrival windows on the cleaners page. Pure, so
// tests/agency-views.test.ts can pin "now". Every date is a Jakarta day as YYYY-MM-DD.

type Param = string | string[] | undefined;
const first = (value: Param) => (Array.isArray(value) ? value[0] : value);

/** ?days= on the summary: 7, 30 or 90 (what the database's summary functions take); 30 otherwise. */
export function parseDays(value: Param): ValidDays {
  const text = first(value);
  const days = text && /^\d+$/.test(text) ? Number(text) : NaN;
  return (VALID_DAYS as readonly number[]).includes(days) ? (days as ValidDays) : 30;
}

/** One bar of the daily chart. */
export type DailyFee = { date: string; feeIdr: number };

/** `count` days ending on `today`, oldest first, each with its fees (0 on a day without any). */
export function dailySeries(rows: readonly { day: string; feeIdr: number }[], today: string, count: number): DailyFee[] {
  const byDay = new Map<string, number>();
  for (const row of rows) byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.feeIdr);
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(today, index - count + 1);
    return { date, feeIdr: byDay.get(date) ?? 0 };
  });
}

/**
 * The chart's top line, rounded up to 1, 2, 2.5, 4, 5 or 8 times a power of ten, with a line at half of it;
 * a single 0 line when every bar is 0.
 */
export function chartScale(max: number): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 0, ticks: [0] };
  const power = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 4, 5, 8, 10].find((factor) => factor * power >= max) ?? 10;
  const top = step * power;
  return { top, ticks: [0, top / 2, top] };
}

/** The statuses "Pekerjaan masuk" can show one at a time (?status=). An overdue job shows under "Semua" only. */
export type IncomingStatus = Exclude<JobProgress, "completed" | "overdue">;
const incomingStatuses: readonly IncomingStatus[] = ["unassigned", "assigned", "inProgress"];

export function parseIncomingStatus(value: Param): IncomingStatus | null {
  const text = first(value);
  return incomingStatuses.find((status) => status === text) ?? null;
}

/** The jobs not finished yet, earliest first, optionally of one status. */
export function incomingJobs<T extends AgencyJob>(jobs: readonly T[], status: IncomingStatus | null, now: Date): T[] {
  return jobs
    .filter((job) => !job.completedAt && (status === null || jobProgress(job, now) === status))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export type IncomingCounts = Record<IncomingStatus, number> & { completedThisWeek: number };

/** How many jobs wait for a cleaner, are assigned, are under way, and finished this Jakarta week. */
export function incomingCounts(jobs: readonly AgencyJob[], now: Date): IncomingCounts {
  const week = jakartaWeek(now);
  const counts: IncomingCounts = { unassigned: 0, assigned: 0, inProgress: 0, completedThisWeek: 0 };
  for (const job of jobs) {
    // A job overdue for check-out is not under way any more; it is listed, not counted (overdue.ts).
    const progress = jobProgress(job, now);
    if (progress === "overdue") continue;
    if (progress !== "completed") counts[progress] += 1;
    else if (job.completedAt && inWeek(jakartaDateOf(job.completedAt), week)) counts.completedThisWeek += 1;
  }
  return counts;
}

/** The recording filter of "Pesanan selesai" (?recording=): still playable, or deleted after 7 days. */
export type PastRecording = "available" | "deleted";

export function parsePastRecording(value: Param): PastRecording | null {
  const text = first(value);
  return text === "available" || text === "deleted" ? text : null;
}

/** The finished jobs, latest finish first, optionally by where their recording stands at `now`. */
export function pastJobs<T extends AgencyJob>(jobs: readonly T[], recording: PastRecording | null, now: number): T[] {
  return jobs
    .filter((job) => {
      if (!job.completedAt) return false;
      if (recording === null) return true;
      const state = backOfficeRecordingState(job, now);
      return recording === "available" ? state === "available" : state === "expired";
    })
    .sort((a, b) => Date.parse(b.completedAt ?? "") - Date.parse(a.completedAt ?? ""));
}

const searchLength = 80;

/** ?q=: the search words, trimmed and at most 80 characters. */
export function parseSearch(value: Param): string {
  return (first(value) ?? "").trim().slice(0, searchLength);
}

/** Whether every word of the query is found in one of the fields, ignoring case. */
export function matchesSearch(fields: readonly (string | null | undefined)[], query: string): boolean {
  const words = query.toLocaleLowerCase("id").split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = fields.filter(Boolean).join(" ").toLocaleLowerCase("id");
  return words.every((word) => text.includes(word));
}

export type JakartaWeek = { from: string; to: string };

/** The Monday to Sunday week in Jakarta that `now` falls in. */
export function jakartaWeek(now: Date): JakartaWeek {
  const today = jakartaDateOf(now);
  const [year, month, day] = today.split("-").map(Number);
  // getUTCDay of a plain date: 0 is Sunday. Monday is the first day of the week.
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const from = addDays(today, -((weekday + 6) % 7));
  return { from, to: addDays(from, 6) };
}

const inWeek = (date: string, week: JakartaWeek) => date >= week.from && date <= week.to;

/** How many of a cleaner's jobs start in the week. */
export function cleanerWeekJobs(jobs: readonly AgencyJob[], cleanerId: string, week: JakartaWeek): number {
  return jobs.filter((job) => job.cleanerId === cleanerId && inWeek(jakartaDateOf(job.startsAt), week)).length;
}

/** One cell of the week overview: the places of every window starting then, over all the agency's areas. */
export type AvailabilityCell = { capacity: number; booked: number; startsAt: string; endsAt: string };
export type AvailabilityGrid = { days: string[]; rows: { time: string; cells: (AvailabilityCell | null)[] }[] };

const timeKeyFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The week's windows as a grid: a row per Jakarta start time ("08:00"), a column per day. */
export function availabilityGrid(slots: readonly AgencySlot[], week: JakartaWeek): AvailabilityGrid {
  const days = Array.from({ length: 7 }, (_, index) => addDays(week.from, index));
  const rows = new Map<string, (AvailabilityCell | null)[]>();
  for (const slot of slots) {
    const column = days.indexOf(jakartaDateOf(slot.startsAt));
    if (column === -1) continue;
    const time = timeKeyFormat.format(new Date(slot.startsAt));
    const cells = rows.get(time) ?? days.map(() => null);
    rows.set(time, cells);
    const cell = cells[column];
    cells[column] = cell
      ? { ...cell, capacity: cell.capacity + slot.capacity, booked: cell.booked + slot.booked, endsAt: slot.endsAt > cell.endsAt ? slot.endsAt : cell.endsAt }
      : { capacity: slot.capacity, booked: slot.booked, startsAt: slot.startsAt, endsAt: slot.endsAt };
  }
  return {
    days,
    rows: [...rows.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([time, cells]) => ({ time, cells })),
  };
}

// Both languages use the Indonesian conventions for numbers and dates, like src/lib/format.ts.
const numberLocales = { id: "id-ID", en: "en-ID" } as const;
type AgencyLocale = keyof typeof numberLocales;

const dateOptions = {
  short: { day: "numeric", month: "short" },
  long: { weekday: "long", day: "numeric", month: "short", year: "numeric" },
  weekday: { weekday: "short", day: "numeric", month: "short" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

/** A Jakarta day: "10 Nov" (short), "Selasa, 10 Nov 2026" (long) or "Kam 5 Nov" (weekday). */
export function formatAgencyDate(date: string, locale: AgencyLocale, kind: keyof typeof dateOptions): string {
  const [year, month, day] = date.split("-").map(Number);
  // Noon UTC is the same calendar day everywhere the format is read; the time zone is fixed to UTC.
  const moment = new Date(Date.UTC(year, month - 1, day, 12));
  const parts = new Intl.DateTimeFormat(numberLocales[locale], { ...dateOptions[kind], timeZone: "UTC" }).formatToParts(moment);
  // Intl puts its own punctuation between the parts ("Kam, 5 Nov", "10 Nov."): keep the words only.
  const words = parts.filter((part) => part.type !== "literal").map((part) => part.value.replace(/\.$/, ""));
  if (kind === "long") return `${words[0]}, ${words.slice(1).join(" ")}`;
  return words.join(" ");
}

/** An amount on a chart axis: "Rp 600 rb", "Rp 1,5 jt" ("Rp 600K" in English). */
export function formatRupiahCompact(amount: number, locale: AgencyLocale): string {
  const number = new Intl.NumberFormat(numberLocales[locale], { notation: "compact", maximumFractionDigits: 1 }).format(amount);
  return `Rp ${number.replace(/ /g, " ")}`;
}
