import type { AdminOrderDetail } from "@/lib/jobs/admin-order";
import type { AdminJob } from "@/lib/jobs/jobs";
import type { StreamStatus } from "@/lib/stream/streams";

// The admin order detail page's rules (D1, after the user's mocks "Admin-Order" and
// "Admin-Order-Issue"): which order the address asks for, the status chip under the title, the job's
// status steps and the help chat that belongs to the order. Pure, tested in tests/admin-order.test.ts.

const orderCodePattern = /^HK-[0-9]{4,}$/;

/** The order number from the address ("HK-1042", as orders_code_format allows), or null. */
export function parseOrderCode(value: string): string | null {
  return orderCodePattern.test(value) ? value : null;
}

// What an admin may type in the shell's order search (audit item 1): the number as shown ("HK-1170"),
// in any case, with or without the dash or a space after "HK", or the digits alone ("1170"), with
// spaces around it. The digits follow orders_code_format (supabase/migrations/20261112090000_order_codes.sql).
const typedOrderNumber = /^(?:HK[-\s]?)?([0-9]{4,})$/i;

/** The order number admin typed, written as the database writes it ("HK-1170"), or null. */
export function normalizeOrderNumber(value: string): string | null {
  const trimmed = value.trim();
  // Longer than any order number the sequence will reach; nothing that long is looked at further.
  if (trimmed.length > 24) return null;
  const match = typedOrderNumber.exec(trimmed);
  return match ? `HK-${match[1]}` : null;
}

/** The chip under the title: the live stream's state while there is one, else how far the job is. */
export type OrderState = "unassigned" | "assigned" | "active" | "weak" | "disconnected" | "inProgress" | "completed";

export function orderState(job: Pick<AdminJob, "cleanerName" | "checkedInAt" | "completedAt">, stream: StreamStatus | null): OrderState {
  if (job.completedAt) return "completed";
  if (stream === "active" || stream === "weak" || stream === "disconnected") return stream;
  if (job.checkedInAt) return "inProgress";
  return job.cleanerName ? "assigned" : "unassigned";
}

export type TimelineStep = {
  key: "created" | "paid" | "assigned" | "checkedIn" | "weak" | "disconnected" | "completed";
  /** done: it happened; problem: the stream's trouble now; pending: not yet. */
  state: "done" | "problem" | "pending";
  /** When it happened; null when it has not, or when the database did not keep the time (older orders). */
  at: string | null;
};

/** What the status steps read from admin_order_detail() (B2). */
export type TimelineOrder = Pick<AdminOrderDetail, "status" | "createdAt" | "paidAt" | "assignedAt" | "cleanerName" | "checkedInAt" | "completedAt">;

/**
 * The status steps: booked, paid, assigned, checked in at the address, the stream's trouble when it has
 * some (at the stream's last change, stream_sessions.updated_at), and finished. A paid order without a
 * payment time, or a cleaner assigned before the time was kept (B3), is done without a time.
 */
export function orderTimeline(order: TimelineOrder, stream: { status: StreamStatus; updatedAt: string } | null): TimelineStep[] {
  const paid = order.paidAt !== null || order.status === "paid";
  const assigned = order.cleanerName !== null;
  const steps: TimelineStep[] = [
    { key: "created", state: "done", at: order.createdAt },
    { key: "paid", state: paid ? "done" : "pending", at: paid ? order.paidAt : null },
    { key: "assigned", state: assigned ? "done" : "pending", at: assigned ? order.assignedAt : null },
    { key: "checkedIn", state: order.checkedInAt ? "done" : "pending", at: order.checkedInAt },
  ];
  if (!order.completedAt && stream && (stream.status === "weak" || stream.status === "disconnected")) {
    steps.push({ key: stream.status, state: "problem", at: stream.updatedAt });
  }
  steps.push({ key: "completed", state: order.completedAt ? "done" : "pending", at: order.completedAt });
  return steps;
}

/** How an order was paid, grouped for the page; Midtrans names more types than the page needs words for. */
export type PaymentMethodKey = "gopay" | "shopeepay" | "qris" | "bank_transfer" | "credit_card" | "cstore" | "other";

const paymentMethods: Record<string, PaymentMethodKey> = {
  gopay: "gopay",
  shopeepay: "shopeepay",
  qris: "qris",
  bank_transfer: "bank_transfer",
  echannel: "bank_transfer",
  permata: "bank_transfer",
  credit_card: "credit_card",
  cstore: "cstore",
};

/** The word to show for Midtrans' payment_type (B8), or null when the order has none. */
export function paymentMethodKey(type: string | null): PaymentMethodKey | null {
  if (type === null) return null;
  return Object.hasOwn(paymentMethods, type) ? paymentMethods[type] : "other";
}

/** The agency's share of the price in whole percent ("Imbalan agensi (70%)"), or null for a free order. */
export function agencyPercent(feeIdr: number, priceIdr: number): number | null {
  return priceIdr > 0 ? Math.round((feeIdr * 100) / priceIdr) : null;
}

/** The order's help chat with the latest message, if the customer asked about this order. */
export function findOrderTicket<T extends { orderId: string | null; lastMessageAt: string }>(tickets: readonly T[], orderId: string): T | undefined {
  return tickets
    .filter((ticket) => ticket.orderId === orderId)
    .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt))[0];
}
