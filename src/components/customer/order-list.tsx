import { CalendarCheck, ChevronRight, Radio, ShieldCheck, Video, VideoOff, type LucideIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CustomerOrder } from "@/lib/booking/orders";
import { formatRupiah } from "@/lib/format";
import { jakartaDayOf } from "./booking-query";
import { liveInProgress } from "./live-status";
import { orderStage } from "./order-stage";
import { getOrderWords, OrderStatusPill } from "./order-status";
import { recordingState, type RecordingState } from "./recording-time";
import { getSlotLabels } from "./slot-labels";

type OrderListProps = {
  /** The customer's own orders, newest first (listMyOrders). */
  orders: CustomerOrder[];
  /** The service's name in this language, or undefined when it is no longer in the catalog. */
  serviceName: (order: CustomerOrder) => string | undefined;
  /** The moment the page is rendered: whether each recording is still kept. */
  now: Date;
};

const recordingIcons: Record<Exclude<RecordingState, "none">, { Icon: LucideIcon; text: string }> = {
  available: { Icon: Video, text: "font-medium text-ink" },
  expired: { Icon: ShieldCheck, text: "text-ink-muted" },
  unavailable: { Icon: VideoOff, text: "text-ink-muted" },
};

// "Riwayat pesanan" (T12, restyled in D5 after the Customer-Home mock): each order a white card that is
// one link to its page (/orders?order=<id>), with the service and price on top, the order number and
// time under it, and below a line its stage pill (order-stage.ts: "Selesai", "Petugas ditugaskan" and so
// on, a word with an icon, never colour alone) and, for a finished job, whether its recording can still be replayed and until when (T15). A paid order's time
// is the job itself, so it stands out on a labelled line; on any other order it is only what was asked
// for. A job in progress says it can be watched live (T23).
/** What a row says about a finished job's recording: until when it is kept, deleted, or none. */
export function recordingWords(
  tRecording: Awaited<ReturnType<typeof getTranslations<"Recording">>>,
  labels: Awaited<ReturnType<typeof getSlotLabels>>,
  now: Date,
) {
  return (order: CustomerOrder, state: Exclude<RecordingState, "none">): string => {
    if (state === "available" && order.recordingExpiresAt) {
      const until = order.recordingExpiresAt;
      const day = labels.day({ date: jakartaDayOf(until, now).date, relative: null });
      return tRecording("listAvailable", { day, time: labels.time(until) });
    }
    return state === "expired" ? tRecording("listExpired") : tRecording("listNone");
  };
}

export async function OrderList({ orders, serviceName, now }: OrderListProps) {
  const locale = await getLocale();
  const [t, tStage, tConfirmation, tRecording, tLive, words, labels] = await Promise.all([
    getTranslations("OrdersPage"),
    getTranslations("OrderStage"),
    getTranslations("OrderConfirmation"),
    getTranslations("Recording"),
    getTranslations("LiveStream"),
    getOrderWords(locale),
    getSlotLabels(locale),
  ]);

  const recordingText = recordingWords(tRecording, labels, now);

  return (
    <ul aria-label={t("listLabel")} className="flex flex-col gap-3">
      {orders.map((order) => {
        const recording = recordingState(order, now.getTime());
        const stage = orderStage(order, now);
        return (
          <li key={order.id} className="flex">
            <Link
              href={`/orders?order=${order.id}`}
              className="group flex w-full flex-col gap-3 rounded-lg bg-card p-4 transition-shadow duration-150 ease-out-quart hover:shadow-card-hover active:bg-sunken md:p-6"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <h3 className="font-display text-lg font-semibold text-ink">{words.service(serviceName(order))}</h3>
                  <span className="text-sm text-ink-muted tabular-nums">
                    {order.status === "paid"
                      ? t("orderLine", { code: order.orderCode })
                      : t("orderLineWithTime", { code: order.orderCode, arrival: words.arrival(order) })}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="font-display text-lg font-semibold whitespace-nowrap text-ink tabular-nums">
                    {formatRupiah(order.priceIdr, locale)}
                  </span>
                  <ChevronRight
                    className="size-5 shrink-0 text-ink-muted transition-transform duration-150 ease-out-quart group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </span>
              {order.status === "paid" ? (
                <span data-testid="job-slot" className="flex items-start gap-3 rounded-md bg-sunken px-3 py-2.5">
                  <CalendarCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm text-ink-muted">{tConfirmation("fields.window")}</span>
                    <span className="font-semibold text-ink">{words.arrival(order)}</span>
                  </span>
                </span>
              ) : null}
              <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
                <OrderStatusPill status={stage} label={tStage(stage)} />
                {liveInProgress(order, now) ? (
                  <span data-testid="live-line" className="flex items-start gap-2 text-sm font-medium text-ink">
                    <Radio className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{tLive("listLine")}</span>
                  </span>
                ) : null}
                {recording !== "none" ? <RecordingLine state={recording} text={recordingText(order, recording)} /> : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** A finished job's recording line, shared with the history page (./orders-history.tsx). */
export function RecordingLine({ state, text }: { state: Exclude<RecordingState, "none">; text: string }) {
  const { Icon, text: tone } = recordingIcons[state];
  return (
    <span data-testid="recording-line" className={`flex items-start gap-2 text-sm ${tone}`}>
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}
