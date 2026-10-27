import { Ban, CircleCheck, CircleX, Clock, Hourglass, RefreshCw, Video, type LucideIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ClientMessages } from "@/i18n/client-messages";
import type { CustomerOrder, OrderStatus } from "@/lib/booking/orders";
import { formatRupiah } from "@/lib/format";
import { jakartaDayOf } from "./booking-query";
import { PaymentForm } from "./payment-form";
import { getSlotLabels } from "./slot-labels";

type OrderConfirmationProps = {
  order: CustomerOrder;
  /** The service's name, or undefined when it is no longer in the catalog. */
  serviceName?: string;
  areaName: string;
  /** The customer has just come back from Midtrans' payment page (./payment-query.ts). */
  cameBackFromPayment?: boolean;
};

// The order's status, always as a word with an icon, never by colour alone.
const statusStyles: Record<OrderStatus, { Icon: LucideIcon; pill: string }> = {
  pending_payment: { Icon: Hourglass, pill: "bg-warning-surface text-warning" },
  paid: { Icon: CircleCheck, pill: "bg-success-surface text-success" },
  failed: { Icon: CircleX, pill: "bg-danger-surface text-danger" },
  cancelled: { Icon: Ban, pill: "bg-surface-sunken text-ink-muted" },
};

// What the customer sees right after booking (T9, on /orders?booked=<id>): that the order is made,
// its status in words ("Menunggu pembayaran"), the facts of the booking (service, arrival window in
// Jakarta time, area, address, the full price as booked) and what happens next. An order that waits
// for payment has "Bayar sekarang" right under its total (T10, ./payment-form.tsx), which opens
// Midtrans' Sandbox payment page. Back from there, the order still waits until Midtrans' signed
// notification arrives (T11), so the page says the payment is being confirmed rather than claiming it
// is paid, and keeps the button for a customer who left before paying. It speaks as HomeKlin only:
// the order as the customer reads it never carries the agency (listMyOrders).
export async function OrderConfirmation({
  order,
  serviceName,
  areaName,
  cameBackFromPayment = false,
}: OrderConfirmationProps) {
  const locale = await getLocale();
  const [t, tPayment, labels] = await Promise.all([
    getTranslations("OrderConfirmation"),
    getTranslations("Payment"),
    getSlotLabels(locale),
  ]);
  const status = statusStyles[order.status];
  const awaitingPayment = order.status === "pending_payment";
  const windowValue = t("windowValue", {
    day: labels.day(jakartaDayOf(order.startsAt, new Date())),
    window: labels.window(order),
  });
  const facts = [
    { label: t("fields.service"), value: serviceName ?? t("serviceFallback") },
    { label: t("fields.window"), value: windowValue },
    { label: t("fields.area"), value: areaName },
    { label: t("fields.address"), value: order.address },
  ];

  return (
    <section
      aria-labelledby="order-confirmation-title"
      className="mx-auto flex w-full max-w-2xl flex-col rounded-xl border border-border bg-surface shadow-card"
    >
      <div className="flex flex-col gap-4 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-surface text-success">
            <CircleCheck className="size-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="order-confirmation-title" className="font-display text-xl font-semibold text-ink">
              {t("title")}
            </h2>
            <p className="text-sm text-ink-muted">{t("lead")}</p>
          </div>
        </div>
        <p
          className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${status.pill}`}
        >
          <status.Icon className="size-4 shrink-0" aria-hidden="true" />
          {t(`status.${order.status}`)}
        </p>
        {awaitingPayment && cameBackFromPayment ? (
          <div role="status" className="flex items-start gap-3 rounded-md bg-info-surface px-4 py-3">
            <RefreshCw className="mt-0.5 size-5 shrink-0 text-info" aria-hidden="true" />
            <div className="text-sm text-ink">
              <h3 className="font-semibold">{tPayment("returnedTitle")}</h3>
              <p className="mt-1">{tPayment("returnedBody")}</p>
            </div>
          </div>
        ) : null}
      </div>

      <dl className="flex flex-col border-t border-border px-5 md:px-6">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex flex-col gap-0.5 border-b border-border py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
          >
            <dt className="shrink-0 text-sm text-ink-muted">{fact.label}</dt>
            <dd className="text-base text-ink sm:text-right">{fact.value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-6 py-4">
          <dt className="text-sm font-medium text-ink-muted">{t("fields.total")}</dt>
          <dd className="font-display text-2xl font-semibold whitespace-nowrap text-ink tabular-nums">
            {formatRupiah(order.priceIdr, locale)}
          </dd>
        </div>
      </dl>

      {awaitingPayment ? (
        <div className="px-5 pb-5 md:px-6 md:pb-6">
          <ClientMessages namespaces={["Payment"]}>
            <PaymentForm orderId={order.id} />
          </ClientMessages>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border p-5 md:p-6">
        {awaitingPayment || order.status === "paid" ? (
          <div className="flex items-start gap-3 rounded-md bg-surface-sunken px-4 py-3">
            <Clock className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden="true" />
            <div className="text-sm text-ink">
              <h3 className="font-semibold">{t("nextTitle")}</h3>
              <p className="mt-1">{t("nextBody")}</p>
            </div>
          </div>
        ) : null}
        <p className="flex items-start gap-3 px-1 text-sm text-ink-muted">
          <Video className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
          <span>{t("streamNote")}</span>
        </p>
      </div>
    </section>
  );
}
