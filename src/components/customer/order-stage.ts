import type { CustomerOrder, OrderStatus } from "@/lib/booking/orders";
import { checkOutOverdue } from "@/lib/jobs/overdue";

// Where an order is, for the pill on each order card (2026-11-18, UX audit item 2): the most advanced
// stage first, so a finished job reads "Selesai" in Riwayat, never "Sudah dibayar". An order that was
// not paid keeps its payment word. A paid order whose window ended with no check-in will not happen
// any more (the same rule that moves it to Riwayat, orders-overview-data.ts): "Tidak terlaksana".
// The words are the timeline's (Petugas ditugaskan, Selesai) where it has them (src/messages, OrderStage).

export type OrderStage = OrderStatus | "assigned" | "inProgress" | "awaitingCheckOut" | "completed" | "missed";

type StageFields = Pick<CustomerOrder, "status" | "cleanerName" | "assignedAt" | "checkedInAt" | "completedAt" | "endsAt">;

export function orderStage(order: StageFields, now: Date): OrderStage {
  if (order.status !== "paid") return order.status;
  if (order.completedAt !== null) return "completed";
  // Checked in, never checked out, and hours past its window (src/lib/jobs/overdue.ts, 2026-11-20).
  if (order.checkedInAt !== null) return checkOutOverdue(order, now) ? "awaitingCheckOut" : "inProgress";
  if (Date.parse(order.endsAt) <= now.getTime()) return "missed";
  if (order.cleanerName !== null || order.assignedAt !== null) return "assigned";
  return "paid";
}
