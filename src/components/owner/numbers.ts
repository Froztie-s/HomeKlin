import type { Locale } from "next-intl";
import type { OrderStatusCounts } from "@/lib/owner/owner";

// The arithmetic behind the owner pages (T29b; D3, after the mocks Owner-Overview, Owner-Partners and
// Owner-Admins): the growth against the period before, the payouts per partner agency and their share,
// orders by status with their share, the month a partner joined and an admin's last sign-in day. Pure, so tests/owner-ui.test.ts covers it.

export type OrderStatus = keyof OrderStatusCounts;

export type Growth = { direction: "up" | "down" | "same" | "none"; percent: number };

/**
 * A period's total against the period before, in whole percent ("naik 8% dari 30 hari sebelumnya").
 * "none" when the period before had nothing to compare with; "same" when the change rounds to 0%.
 */
export function growth(current: number, previous: number): Growth {
  if (!(previous > 0)) return { direction: "none", percent: 0 };
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return { direction: "same", percent: 0 };
  return { direction: percent > 0 ? "up" : "down", percent: Math.abs(percent) };
}

export type PayoutShare = { id: string; name: string; amountIdr: number; sharePercent: number };

/**
 * What each partner agency earned in the period (owner_numbers' payouts_by_agency): only the agencies
 * that earned something, largest first (by name when equal), each with its share of the total to one
 * decimal.
 */
export function payoutShares(rows: readonly { id: string; name: string; amountIdr: number }[]): { totalIdr: number; rows: PayoutShare[] } {
  const totalIdr = rows.reduce((sum, row) => sum + row.amountIdr, 0);
  const paid = rows
    .filter((row) => row.amountIdr > 0)
    .sort((a, b) => b.amountIdr - a.amountIdr || a.name.localeCompare(b.name, "id"))
    .map((row) => ({ ...row, sharePercent: Math.round((row.amountIdr / totalIdr) * 1000) / 10 }));
  return { totalIdr, rows: paid };
}

const jakartaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });

/** Whether a moment falls on today or yesterday in Jakarta, or earlier ("Hari ini, 08.02"). */
export function signInDay(moment: string, now: Date): "today" | "yesterday" | "earlier" {
  const day = jakartaDay.format(new Date(moment));
  if (day === jakartaDay.format(now)) return "today";
  return day === jakartaDay.format(new Date(now.getTime() - 86_400_000)) ? "yesterday" : "earlier";
}

/** The statuses in the order the owner reads them: what earned money first. */
export const statusOrder = ["paid", "pending_payment", "failed", "cancelled"] as const satisfies readonly OrderStatus[];

export function statusRows(byStatus: OrderStatusCounts) {
  const total = statusOrder.reduce((sum, status) => sum + byStatus[status], 0);
  return statusOrder.map((status) => ({
    status,
    count: byStatus[status],
    percent: total === 0 ? 0 : Math.round((byStatus[status] / total) * 100),
  }));
}

export type ChartBucket = { date: string; end: string; amountIdr: number };

/**
 * The revenue chart's bars for the chosen period (2026-11-20): one bar a day up to 30 days; for a
 * longer period one bar a week, so 90 days stay 13 readable bars. Weeks are counted back from the last
 * day, so the last bar always ends today and only the first may be shorter. `date` is the bucket's
 * first day (the label under the bar), `end` its last.
 */
export function chartBuckets(daily: readonly { date: string; revenueIdr: number }[]): { unit: "day" | "week"; buckets: ChartBucket[] } {
  if (daily.length <= 30) return { unit: "day", buckets: daily.map((day) => ({ date: day.date, end: day.date, amountIdr: day.revenueIdr })) };
  const buckets: ChartBucket[] = [];
  for (let end = daily.length; end > 0; end -= 7) {
    const week = daily.slice(Math.max(0, end - 7), end);
    buckets.unshift({ date: week[0].date, end: week[week.length - 1].date, amountIdr: week.reduce((sum, day) => sum + day.revenueIdr, 0) });
  }
  return { unit: "week", buckets };
}

const monthYears = new Map<Locale, Intl.DateTimeFormat>();

/** A moment as its Jakarta month and year: "Mar 2026" ("Sejak Mar 2026" on the partner list). */
export function monthYear(moment: string, locale: Locale): string {
  let format = monthYears.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
    monthYears.set(locale, format);
  }
  return format.format(new Date(moment)).replace(".", "");
}
