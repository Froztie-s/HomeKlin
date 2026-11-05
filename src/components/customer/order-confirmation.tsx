import { CircleCheck, ClipboardList, Clock, RefreshCw, Video } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ClientMessages } from "@/i18n/client-messages";
import type { CustomerOrder } from "@/lib/booking/orders";
import { formatRupiah } from "@/lib/format";
import { OrderReview } from "@/components/reviews/order-review";
import { canReview } from "@/components/reviews/rating";
import { liveInProgress } from "./live-status";
import { OrderJob } from "./order-job";
import { OrderLive } from "./order-live";
import { OrderRecording } from "./order-recording";
import { getOrderWords, OrderStatusPill } from "./order-status";
import { PaymentForm } from "./payment-form";
import { recordingState } from "./recording-time";

type OrderConfirmationProps = {
  order: CustomerOrder;
  /** The service's name, or undefined when it is no longer in the catalog. */
  serviceName?: string;
  areaName: string;
  /** The customer has just come back from Midtrans' payment page (./payment-query.ts). */
  cameBackFromPayment?: boolean;
  /** "booked": the confirmation (/orders?booked=<id>). "details": opened from the list (/orders?order=<id>). */
  variant?: "booked" | "details";
  /** The moment the page is rendered: whether the recording is still kept, and its countdown. */
  now: Date;
};

// What the customer sees right after booking (T9, on /orders?booked=<id>): that the order is made,
// its status in words ("Menunggu pembayaran"), the facts of the booking (service, arrival window in
// Jakarta time, area, address, the full price as booked) and what happens next. An order that waits
// for payment has "Bayar sekarang" right under its total (T10, ./payment-form.tsx), which opens
// Midtrans' Sandbox payment page. Back from there, the order still waits until Midtrans' signed
// notification arrives (T11), so the page says the payment is being confirmed rather than claiming it
// is paid, and keeps the button for a customer who left before paying. It speaks as HomeKlin only:
// the order as the customer reads it never carries the agency (listMyOrders).
// Opened from the list (T12) the same facts carry their own title and a line for the order's status,
// since the order was not just made and a failed or cancelled one holds no window any more.
// A paid order shows its Petugas HomeKlin and the job's progress (./order-job.tsx), and a finished job
// its recording, with until when it is kept (T15, ./order-recording.tsx), and under it the review the
// customer gives the job once (T30, src/components/reviews/order-review.tsx). While the job is in
// progress the customer can watch it live here (T23, ./order-live.tsx); /orders/live?order=<id> shows
// the same.
export async function OrderConfirmation({
  order,
  serviceName,
  areaName,
  cameBackFromPayment = false,
  variant = "booked",
  now,
}: OrderConfirmationProps) {
  const locale = await getLocale();
  const [t, tPayment, words] = await Promise.all([
    getTranslations("OrderConfirmation"),
    getTranslations("Payment"),
    getOrderWords(locale),
  ]);
  const details = variant === "details";
  const awaitingPayment = order.status === "pending_payment";
  const goingAhead = awaitingPayment || order.status === "paid";
  const HeaderIcon = details ? ClipboardList : CircleCheck;
  const recording = recordingState(order, now.getTime());
  const live = liveInProgress(order);
  const lead = details ? (order.completedAt ? t("detailsLeadCompleted") : t(`detailsLead.${order.status}`)) : t("lead");
  const facts = [
    { label: t("fields.service"), value: words.service(serviceName) },
    { label: t("fields.window"), value: words.arrival(order) },
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
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${details ? "bg-brand-50 text-brand-700" : "bg-success-surface text-success"}`}
          >
            <HeaderIcon className="size-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="order-confirmation-title" className="font-display text-xl font-semibold text-ink">
              {details ? t("detailsTitle") : t("title")}
            </h2>
            <p className="text-sm text-ink-muted">{lead}</p>
          </div>
        </div>
        <OrderStatusPill status={order.status} label={words.status(order.status)} />
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

      {order.status === "paid" ? <OrderJob order={order} /> : null}
      {live ? <OrderLive orderId={order.id} variant="details" /> : null}
      {recording !== "none" ? <OrderRecording recordingId={order.recordingId} state={recording} now={now} /> : null}
      {details && canReview(order) ? <OrderReview orderId={order.id} cleanerName={order.cleanerName} /> : null}

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

      {/* A finished job's recording section and a job's live view already say who can see them. */}
      {(goingAhead || !details) && recording === "none" && !live ? (
        <div className="flex flex-col gap-3 border-t border-border p-5 md:p-6">
          {goingAhead && !order.cleanerName ? (
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
      ) : null}
    </section>
  );
}
