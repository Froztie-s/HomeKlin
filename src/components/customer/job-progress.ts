import type { CustomerOrder } from "@/lib/booking/orders";
import { jobProgress } from "@/lib/jobs/jobs";

// The paid job's progress on its details (T15), as three steps the customer reads top to bottom: a
// Petugas HomeKlin is assigned, checks in at the address, and finishes. Each step is done, happening
// now (current) or still to come; the page writes each state in words as well as with an icon.

export type StepState = "done" | "current" | "upcoming";
export type ProgressStep = { key: "assigned" | "checkedIn" | "completed"; state: StepState; at: string | null };

export function progressSteps(order: Pick<CustomerOrder, "cleanerName" | "checkedInAt" | "completedAt">): ProgressStep[] {
  const progress = jobProgress(order);
  return [
    { key: "assigned", state: progress === "unassigned" ? "current" : "done", at: null },
    { key: "checkedIn", state: order.checkedInAt ? "done" : "upcoming", at: order.checkedInAt },
    {
      key: "completed",
      state: progress === "completed" ? "done" : progress === "inProgress" ? "current" : "upcoming",
      at: order.completedAt,
    },
  ];
}

/** "RW" for "Rina Wulandari": shown in place of a photo the cleaner does not have. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("id-ID"))
    .join("");
}
