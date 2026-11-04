import { CalendarCheck, ChevronRight, ShieldCheck, Video, VideoOff, type LucideIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CustomerOrder } from "@/lib/booking/orders";
import { formatRupiah } from "@/lib/format";
import { jakartaDayOf } from "./booking-query";
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

// The customer's orders on /orders (T12). The whole row is one link to the order's details
// (/orders?order=<id>). A paid order's window is the job itself, so it stands out on a labelled line;
// on any other order it is only what was asked for, in muted text. A finished job says whether its
// recording can still be replayed, and until when (T15); the player itself is on the details.
export async function OrderList({ orders, serviceName, now }: OrderListProps) {
  const locale = await getLocale();
  const [t, tConfirmation, tRecording, words, labels] = await Promise.all([
    getTranslations("OrdersPage"),
    getTranslations("OrderConfirmation"),
    getTranslations("Recording"),
    getOrderWords(locale),
    getSlotLabels(locale),
  ]);

  function recordingText(order: CustomerOrder, state: Exclude<RecordingState, "none">): string {
    if (state === "available" && order.recordingExpiresAt) {
      const until = order.recordingExpiresAt;
      const day = labels.day({ date: jakartaDayOf(until, now).date, relative: null });
      return tRecording("listAvailable", { day, time: labels.time(until) });
    }
    return state === "expired" ? tRecording("listExpired") : tRecording("listNone");
  }

  return (
    <ul aria-label={t("listLabel")} className="grid gap-3 lg:grid-cols-2">
      {orders.map((order) => {
        const recording = recordingState(order, now.getTime());
        return (
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
              {recording !== "none" ? <RecordingLine state={recording} text={recordingText(order, recording)} /> : null}
              <span className="mt-auto flex items-baseline justify-between gap-6">
                <span className="text-sm text-ink-muted">{tConfirmation("fields.total")}</span>
                <span className="font-display text-lg font-semibold whitespace-nowrap text-ink tabular-nums">
                  {formatRupiah(order.priceIdr, locale)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function RecordingLine({ state, text }: { state: Exclude<RecordingState, "none">; text: string }) {
  const { Icon, text: tone } = recordingIcons[state];
  return (
    <span data-testid="recording-line" className={`flex items-start gap-2 text-sm ${tone}`}>
      <Icon className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}
