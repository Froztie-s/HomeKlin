import type { Locale } from "next-intl";
import type { BusinessNumbers, OrderStatusCounts } from "@/lib/owner/owner";

// The arithmetic behind the owner dashboard (T29b): the trend chart's scale and bar heights, the
// 30-day totals and the orders by status with their share. Pure, so tests/owner-ui.test.ts covers it.

export type TrendDay = BusinessNumbers["trend"][number];
export type OrderStatus = keyof OrderStatusCounts;

/** The top of the chart's scale: the largest value rounded up to 1, 2 or 5 times a power of ten. */
export function niceMax(value: number): number {
  if (value <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    if (value <= step * power) return step * power;
  }
  return 10 * power;
}

/** A bar's height as a share of the scale; a non-zero day is never thinner than 2% so it stays visible. */
export function barPercent(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(Math.round((value / max) * 100), 2);
}

export function trendSummary(trend: readonly TrendDay[]) {
  let orders = 0;
  let revenueIdr = 0;
  let busiest: TrendDay | null = null;
  for (const day of trend) {
    orders += day.orders;
    revenueIdr += day.revenueIdr;
    if (day.orders > 0 && (!busiest || day.orders > busiest.orders)) busiest = day;
  }
  return { orders, revenueIdr, busiest, max: niceMax(busiest?.orders ?? 0) };
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

const shortDates = new Map<Locale, Intl.DateTimeFormat>();

/** "2026-11-04" (a Jakarta date) -> "4 Nov". */
export function shortDate(date: string, locale: Locale): string {
  let format = shortDates.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    shortDates.set(locale, format);
  }
  const [year, month, day] = date.split("-").map(Number);
  return format.format(new Date(Date.UTC(year, month - 1, day))).replace(".", "");
}
