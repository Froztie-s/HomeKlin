import type { CustomerOrder } from "@/lib/booking/orders";
import { liveInProgress } from "./live-status";
import { orderStage } from "./order-stage";
import { recordingState } from "./recording-time";

// The customer's orders, split over two pages (2026-11-20): the signed-in home (/home) holds every
// order not finished yet, a job in progress first (with its live view), then the rest by the soonest
// arrival; the history page (/orders) holds the finished ones, newest first, by month, with a filter.
//
// - Live: paid, checked in and not completed (liveInProgress), even a little after the window, but not
//   once it is hours past it without a check-out (src/lib/jobs/overdue.ts): that one goes to Riwayat.
// - Riwayat: completed, failed or cancelled (Midtrans' "expire", a payment not made in time, cancels
//   the order: src/lib/payment/notification.ts), or a window that has ended without a check-in. A
//   paid order no one checked in to will not happen any more, and an order still waiting for payment
//   after its window can no longer be used, though the database would still take the payment.
// - Home: everything else, waiting for payment or paid, its window not ended yet.

type SplitFields = Pick<CustomerOrder, "status" | "checkedInAt" | "completedAt" | "startsAt" | "endsAt" | "createdAt">;

export type OrdersSplit<T> = { live: T[]; upcoming: T[]; history: T[] };

function finished(order: SplitFields, now: number): boolean {
  if (order.completedAt !== null || order.status === "failed" || order.status === "cancelled") return true;
  return Date.parse(order.endsAt) <= now;
}

const bySoonest = (a: SplitFields, b: SplitFields) => Date.parse(a.startsAt) - Date.parse(b.startsAt);
const byNewest = (a: SplitFields, b: SplitFields) => Date.parse(b.createdAt) - Date.parse(a.createdAt);

export function splitOrders<T extends SplitFields>(orders: readonly T[], now: Date): OrdersSplit<T> {
  const time = now.getTime();
  const live = orders.filter((order) => liveInProgress(order, now));
  const rest = orders.filter((order) => !liveInProgress(order, now));
  return {
    live: live.toSorted(bySoonest),
    upcoming: rest.filter((order) => !finished(order, time)).toSorted(bySoonest),
    history: rest.filter((order) => finished(order, time)).toSorted(byNewest),
  };
}

/** The filter of the history page (/orders), kept in the address as ?filter=selesai or ?filter=tidak-jadi. */
export type HistoryFilter = "all" | "done" | "notDone";
export const historyFilterParam = "filter";
const filterValues: Record<Exclude<HistoryFilter, "all">, string> = { done: "selesai", notDone: "tidak-jadi" };

export function parseHistoryFilter(value: string | string[] | null | undefined): HistoryFilter {
  if (typeof value !== "string") return "all";
  return (Object.keys(filterValues) as Exclude<HistoryFilter, "all">[]).find((filter) => filterValues[filter] === value) ?? "all";
}

/** The month shown on the history page, kept in the address as ?bulan=2026-11 (2026-11-20, user). */
export const historyMonthParam = "bulan";

export function parseHistoryMonth(value: string | string[] | null | undefined): string | undefined {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : undefined;
}

/** The history page's address with a filter and, when given, a month. */
export function historyHref(filter: HistoryFilter, month?: string): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set(historyFilterParam, filterValues[filter]);
  if (month) params.set(historyMonthParam, month);
  const query = params.toString();
  return query ? `/orders?${query}` : "/orders";
}

/** The month to show: the one asked for when it has orders, otherwise the latest one (groups come latest first). */
export function pickMonth<T>(groups: readonly { month: string; orders: T[] }[], wanted: string | undefined): number {
  const index = groups.findIndex((group) => group.month === wanted);
  return index === -1 ? 0 : index;
}

type HistoryFields = SplitFields & Pick<CustomerOrder, "cleanerName" | "assignedAt">;

/**
 * Done: the job took place, finished or checked in to but never checked out (the work was done; only
 * the closing step is missing). Not done: cancelled, failed to pay, or a window that passed unused.
 */
export function historyFilterOf(order: HistoryFields, now: Date): Exclude<HistoryFilter, "all"> {
  const stage = orderStage(order, now);
  return stage === "completed" || stage === "awaitingCheckOut" ? "done" : "notDone";
}

export function filterHistory<T extends HistoryFields>(orders: readonly T[], filter: HistoryFilter, now: Date): T[] {
  return filter === "all" ? [...orders] : orders.filter((order) => historyFilterOf(order, now) === filter);
}

/** The Jakarta month of a moment, "2026-11" (UTC+7, no daylight saving). */
export function jakartaMonthOf(iso: string): string {
  return new Date(Date.parse(iso) + 7 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

/** The orders grouped by the Jakarta month of their arrival, the latest job first (so a month shows once). */
export function groupByMonth<T extends Pick<CustomerOrder, "startsAt">>(orders: readonly T[]): { month: string; orders: T[] }[] {
  const groups: { month: string; orders: T[] }[] = [];
  for (const order of orders.toSorted((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))) {
    const month = jakartaMonthOf(order.startsAt);
    const last = groups.at(-1);
    if (last?.month === month) last.orders.push(order);
    else groups.push({ month, orders: [order] });
  }
  return groups;
}

/** The summary on top of the history: jobs done, recordings still to watch, and what was paid. */
export function historySummary(
  orders: readonly (HistoryFields & Pick<CustomerOrder, "priceIdr" | "recordingId" | "recordingExpiresAt" | "recordingDeleted">)[],
  now: Date,
): { done: number; recordings: number; paidIdr: number } {
  return {
    done: orders.filter((order) => historyFilterOf(order, now) === "done").length,
    recordings: orders.filter((order) => recordingState(order, now.getTime()) === "available").length,
    paidIdr: orders.filter((order) => order.status === "paid").reduce((sum, order) => sum + order.priceIdr, 0),
  };
}
