import { ArrowLeft, CircleHelp } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { OrderReview } from "@/components/reviews/order-review";
import { canReview } from "@/components/reviews/rating";
import { ClientMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";
import type { CustomerOrder } from "@/lib/booking/orders";
import { paymentStepHref } from "@/lib/booking/payment-address";
import { formatRupiah } from "@/lib/format";
import { flowCard, flowCardTitle, flowOutlineButton, flowPrimaryButton, flowTextLink } from "./flow-styles";
import { liveInProgress } from "./live-status";
import { OrderHero } from "./order-hero";
import { OrderLive } from "./order-live";
import { OrderRecording } from "./order-recording";
import { getOrderWords, OrderStatusPill } from "./order-status";
import { OrderTimelineCard } from "./order-timeline-card";
import { paymentMethodKey } from "./payment-method";
import { recordingState } from "./recording-time";
import { ResendEmail } from "./resend-email";
import { RevokeLinks } from "./revoke-links";

type OrderDetailsProps = {
  order: CustomerOrder;
  /** The service's name, or undefined when it is no longer in the catalog. */
  serviceName?: string;
  /** "± 2 jam" for the service, or undefined when it is no longer in the catalog. */
  duration?: ReactNode;
  areaName: string;
  /** The moment the page is rendered: whether the recording is still kept, and its countdown. */
  now: Date;
  /** An order not finished yet is listed on /home, so its way back leads there (2026-11-20). */
  fromHome?: boolean;
};

// One order's page, /orders?order=<id> (T12, restyled in D5 after the Customer-Orders mock): for a paid
// order the Petugas HomeKlin up top (./order-hero.tsx), the status steps, while the job runs its live
// view (T23), once finished its recording (T15) and the review (T30); then "Detail pesanan" with the
// order number, the service, the time, the address, the customer's note (B7) and how it was paid (B8),
// and for an order waiting for payment "Bayar sekarang" (T10). Beside it, the way to help. It speaks
// as HomeKlin only: the order as the customer reads it never carries the agency (listMyOrders).
export async function OrderDetails({ order, serviceName, duration, areaName, now, fromHome = false }: OrderDetailsProps) {
  const locale = await getLocale();
  const [t, tMethod, tPayment, tReplay, words] = await Promise.all([
    getTranslations("OrderConfirmation"),
    getTranslations("PaymentMethod"),
    getTranslations("Payment"),
    getTranslations("Replay"),
    getOrderWords(locale),
  ]);
  const paid = order.status === "paid";
  const awaitingPayment = order.status === "pending_payment";
  const recording = recordingState(order, now.getTime());
  const live = liveInProgress(order, now);
  const lead = order.completedAt ? t("detailsLeadCompleted") : t(`detailsLead.${order.status}`);
  const method = paymentMethodKey(order.paymentMethod);
  const service = words.service(serviceName);
  const price = formatRupiah(order.priceIdr, locale);
  const DetailsHeading = paid ? "h2" : "h1";

  const facts: { term: string; value: ReactNode }[] = [
    { term: t("fields.code"), value: <span className="tabular-nums">{order.orderCode}</span> },
    { term: t("fields.service"), value: duration ? <>{service}, {duration}</> : service },
    { term: t("fields.window"), value: words.arrival(order) },
    { term: t("fields.area"), value: areaName },
    { term: t("fields.address"), value: order.address },
    ...(order.customerNote.trim() ? [{ term: t("fields.note"), value: <span className="whitespace-pre-line">{order.customerNote}</span> }] : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <BackToList toHome={fromHome} />
      {paid ? <OrderHero order={order} serviceName={service} arrival={words.arrival(order)} now={now} /> : null}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-6">
        <div className="flex min-w-0 flex-col gap-5">
          {paid || awaitingPayment ? <OrderTimelineCard order={order} /> : null}
          {live ? (
            <div className="overflow-hidden rounded-lg bg-card [&>section]:border-t-0">
              <OrderLive orderId={order.id} variant="details" />
            </div>
          ) : null}
          {recording !== "none" ? (
            <div className="overflow-hidden rounded-lg bg-card [&>section]:border-t-0">
              <OrderRecording recordingId={order.recordingId} state={recording} now={now} />
              <p className="px-5 pb-5 md:px-6 md:pb-6">
                <Link href={`/orders/recording?order=${order.id}`} className={flowTextLink}>
                  {tReplay("open")}
                </Link>
              </p>
            </div>
          ) : null}
          {canReview(order) ? (
            <div className="overflow-hidden rounded-lg bg-card [&>section]:border-t-0">
              <OrderReview orderId={order.id} cleanerName={order.cleanerName} />
            </div>
          ) : null}

          <section aria-labelledby="detail-pesanan" className={flowCard}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                {/* A paid order's title is the hero's headline; otherwise these details are the page. */}
                <DetailsHeading id="detail-pesanan" className={paid ? flowCardTitle : `${flowCardTitle} md:text-title`}>
                  {t("detailsTitle")}
                </DetailsHeading>
                <p className="text-sm text-ink-muted">{lead}</p>
              </div>
              <OrderStatusPill status={order.status} label={words.status(order.status)} />
            </div>
            <dl className="mt-4 flex flex-col border-t border-border">
              {facts.map((fact) => (
                <div
                  key={fact.term}
                  className="flex flex-col gap-0.5 border-b border-border py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                >
                  <dt className="shrink-0 text-sm text-ink-muted">{fact.term}</dt>
                  <dd className="font-semibold break-words text-ink sm:text-right">{fact.value}</dd>
                </div>
              ))}
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
                <dt className="text-sm text-ink-muted">{t("fields.payment")}</dt>
                <dd className="font-semibold text-ink tabular-nums sm:text-right">
                  {paid && method ? t("paidWith", { method: tMethod(method), price }) : price}
                </dd>
              </div>
            </dl>
            {awaitingPayment ? (
              <div className="mt-4">
                {/* Paying happens on step 3, where the customer chooses how (QRIS, a bank or a card). */}
                <Link href={paymentStepHref(order.id)} className={flowPrimaryButton}>
                  {tPayment("submit")}
                </Link>
              </div>
            ) : null}
          </section>

          <OrderEmails orderId={order.id} canResend={paid || awaitingPayment} />
        </div>

        <aside aria-label={t("helpLabel")} className="flex flex-col gap-4 lg:sticky lg:top-24">
          <HelpCard />
        </aside>
      </div>
    </div>
  );
}

/**
 * "Email pesanan" (B9, B14a, review H1): "Kirim ulang email" while the order waits for payment or is
 * paid (resendOrderEmail refuses other orders too), and "Batalkan tautan email" for any order, so a
 * forwarded email's link can be stopped. The resend is the card's one button; the cancel is a quiet
 * text button under it (UX audit, 2026-11-18), so the rarer, undoing action does not compete.
 */
async function OrderEmails({ orderId, canResend }: { orderId: string; canResend: boolean }) {
  const t = await getTranslations("OrderEmails");
  return (
    <section aria-labelledby="email-pesanan" className={flowCard}>
      <h2 id="email-pesanan" className={flowCardTitle}>
        {t("title")}
      </h2>
      <p className="mt-1 max-w-prose text-sm text-ink-muted">{t("body")}</p>
      <ClientMessages namespaces={["ResendEmail", "OrderEmails"]}>
        <div className="mt-4 flex flex-col items-start gap-2">
          {canResend ? <ResendEmail orderId={orderId} /> : null}
          <RevokeLinks orderId={orderId} />
        </div>
      </ClientMessages>
    </section>
  );
}

/** "Ada yang perlu dibantu?": the support page (FAQ and a message to HomeKlin's admin). */
export async function HelpCard() {
  const t = await getTranslations("OrderConfirmation");
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg bg-sunken p-5 md:p-6">
      <p className="text-sm text-ink">
        <strong className="font-semibold">{t("helpTitle")}</strong> {t("helpBody")}
      </p>
      <Link href="/support" className={flowOutlineButton}>
        <CircleHelp className="size-4.5 shrink-0" aria-hidden="true" />
        {t("helpLink")}
      </Link>
    </div>
  );
}

/** Back to where the order is listed: /home for one still to come, the history (/orders) otherwise. */
export async function BackToList({ toHome = false }: { toHome?: boolean }) {
  const t = await getTranslations("OrdersPage");
  return (
    <Link
      href={toHome ? "/home" : "/orders"}
      className="inline-flex min-h-touch w-fit items-center gap-2 rounded-sm text-sm font-semibold text-primary underline-offset-4 transition-colors duration-150 ease-out-quart hover:underline active:text-band"
    >
      <ArrowLeft className="size-4.5 shrink-0" aria-hidden="true" />
      {t(toHome ? "backToHome" : "backToList")}
    </Link>
  );
}
