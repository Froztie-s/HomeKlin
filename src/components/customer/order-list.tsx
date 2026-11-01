import { CalendarCheck, ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CustomerOrder } from "@/lib/booking/orders";
import { formatRupiah } from "@/lib/format";
import { getOrderWords, OrderStatusPill } from "./order-status";

type OrderListProps = {
  /** The customer's own orders, newest first (listMyOrders). */
  orders: CustomerOrder[];
  /** The service's name in this language, or undefined when it is no longer in the catalog. */
  serviceName: (order: CustomerOrder) => string | undefined;
};

// The customer's orders on /orders (T12). The whole row is one link to the order's details
// (/orders?order=<id>). A paid order's window is the job itself, so it stands out on a labelled line;
// on any other order it is only what was asked for, in muted text.
export async function OrderList({ orders, serviceName }: OrderListProps) {
  const locale = await getLocale();
  const [t, tConfirmation, words] = await Promise.all([
    getTranslations("OrdersPage"),
    getTranslations("OrderConfirmation"),
    getOrderWords(locale),
  ]);

  return (
    <ul aria-label={t("listLabel")} className="grid gap-3 lg:grid-cols-2">
      {orders.map((order) => (
        <li key={order.id} className="flex">
          <Link
            href={`/orders?order=${order.id}`}
            className="group flex w-full flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors duration-150 ease-out-quart hover:border-border-control active:bg-surface-sunken md:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="min-w-0 font-display text-lg font-semibold text-ink">{words.service(serviceName(order))}</h2>
              <ChevronRight
                className="mt-0.5 size-5 shrink-0 text-ink-muted transition-colors duration-150 ease-out-quart group-hover:text-ink"
                aria-hidden="true"
              />
            </div>
            <OrderStatusPill status={order.status} label={words.status(order.status)} />
            {order.status === "paid" ? (
              <span data-testid="job-slot" className="flex items-start gap-3 rounded-md bg-surface-sunken px-3 py-2.5">
                <CalendarCheck className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden="true" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm text-ink-muted">{tConfirmation("fields.window")}</span>
                  <span className="text-base font-semibold text-ink">{words.arrival(order)}</span>
                </span>
              </span>
            ) : (
              <span className="text-sm text-ink-muted">{words.arrival(order)}</span>
            )}
            <span className="mt-auto flex items-baseline justify-between gap-6">
              <span className="text-sm text-ink-muted">{tConfirmation("fields.total")}</span>
              <span className="font-display text-lg font-semibold whitespace-nowrap text-ink tabular-nums">
                {formatRupiah(order.priceIdr, locale)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
