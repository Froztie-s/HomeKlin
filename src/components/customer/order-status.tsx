import { Ban, CircleCheck, CircleX, Hourglass, type LucideIcon } from "lucide-react";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { CustomerOrder, OrderStatus } from "@/lib/booking/orders";
import { jakartaDayOf } from "./booking-query";
import { getSlotLabels } from "./slot-labels";

// What the order list (T12) and an order's page (T9) say about an order, in the same words.

// The order's status, always as a word with an icon, never by colour alone.
const statusStyles: Record<OrderStatus, { Icon: LucideIcon; pill: string }> = {
  pending_payment: { Icon: Hourglass, pill: "bg-warning-surface text-warning" },
  paid: { Icon: CircleCheck, pill: "bg-success-surface text-success" },
  failed: { Icon: CircleX, pill: "bg-danger-surface text-danger" },
  cancelled: { Icon: Ban, pill: "bg-surface-sunken text-ink-muted" },
};

export function OrderStatusPill({ status, label }: { status: OrderStatus; label: string }) {
  const { Icon, pill } = statusStyles[status];
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${pill}`}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

/** The words for an order: its status, its service and its arrival window in Jakarta time (server only). */
export async function getOrderWords(locale: Locale) {
  const [t, labels] = await Promise.all([
    getTranslations({ locale, namespace: "OrderConfirmation" }),
    getSlotLabels(locale),
  ]);
  const now = new Date();
  return {
    status: (status: OrderStatus) => t(`status.${status}`),
    /** The service's name, or the fallback when it is no longer in the catalog. */
    service: (name: string | undefined) => name ?? t("serviceFallback"),
    /** "Jumat, 6 November, 15.00-17.00 WIB". A past window has its plain date, never today or tomorrow. */
    arrival: (order: Pick<CustomerOrder, "startsAt" | "endsAt">) =>
      t("windowValue", { day: labels.day(jakartaDayOf(order.startsAt, now)), window: labels.window(order) }),
  };
}
