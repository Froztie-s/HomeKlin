import type { Locale } from "next-intl";
import type { CustomerOrder } from "@/lib/booking/orders";
import { formatRating } from "@/lib/format";

// Ratings on the customer pages (T30). Pure, so tests/reviews-ui.test.ts covers it.

export const ratingValues = [1, 2, 3, 4, 5] as const;

/** A job can be reviewed once it is paid and finished; submit_review() checks the same on the server. */
export function canReview(order: Pick<CustomerOrder, "status" | "completedAt">): boolean {
  return order.status === "paid" && order.completedAt !== null;
}

/** 4.5 -> "4,5", in both languages (src/lib/format.ts uses Indonesian number conventions throughout). */
export function formatAverage(average: number, locale: Locale): string {
  return formatRating(average, locale);
}
