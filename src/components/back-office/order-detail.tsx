import {
  ArrowLeft,
  CalendarClock,
  Circle,
  CircleCheck,
  CircleStop,
  Clock,
  CircleDashed,
  MessageCircle,
  Phone,
  ShieldCheck,
  UserRoundX,
  Wrench,
  WifiHigh,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { initialsOf } from "@/components/auth/user-avatar";
import { Link } from "@/i18n/navigation";
import { formatRupiah } from "@/lib/format";
import type { AdminOrderDetail } from "@/lib/jobs/admin-order";
import type { AdminJob } from "@/lib/jobs/jobs";
import type { LiveStream } from "@/lib/stream/streams";
import type { AdminRecordingState } from "./admin-console";
import { agencyPercent, orderState, orderTimeline, paymentMethodKey, type OrderState, type TimelineStep } from "./admin-order";
import { FeedCard } from "./feed-card";
import { FeedOpen } from "./feed-open";
import { FeedStatus } from "./feed-status";
import { SignedFeed, VideoLoading } from "./feed-tile";
import { StatusPill } from "./status-pill";

export type OrderDetailProps = {
  job: AdminJob;
  /** The order's own facts from admin_order_detail() (B2): address, note, customer, price split, times. */
  order: AdminOrderDetail;
  /** The order's live stream, if it has one now (live_streams()). */
  stream: LiveStream | null;
  serviceName: string;
  /** "Sekitar 2 jam" from the service's duration, or null when the service is gone. */
  duration: string | null;
  areaName: string | undefined;
  /** "Kamis, 5 November" and "09.00-11.00", in Jakarta time. */
  day: string;
  window: string;
  /** Jakarta clock time of an ISO time, "09.04". */
  time: (iso: string) => string;
  /** A status step's time: "09.04" on the job's day, "4 Nov, 14.20" on another day. */
  stamp: (iso: string) => string;
  recording: AdminRecordingState;
  /** The help chat about this order, if the customer opened one. */
  ticket: { id: string } | null;
};

// The admin order detail page (D1), after the user's mocks "Admin-Order" (in progress) and
// "Admin-Order-Issue" (disconnected): a way back to the monitor; the service as the title with the
// job's status chip, the order number and its window; "Buka obrolan pelanggan" when the customer has a
// help chat about the order; then the live video and the order's facts (with the address and the
// customer's note) on the left, and the customer, the cleaner and agency, the payment (booked price,
// agency fee, HomeKlin income and the method) and the status steps with their times on the right, from
// admin_order_detail() (B2). With a live stream the page sits inside FeedCard, so the chip under the title
// and the video frame follow the stream's status as it is polled. Needs the AdminMonitorPage client
// messages (the video, the chip and "Buka").
export async function OrderDetail(props: OrderDetailProps) {
  const { job, order, stream } = props;
  const [t, locale] = await Promise.all([getTranslations("AdminOrderPage"), getLocale()]);
  const money = (amount: number) => formatRupiah(amount, locale);
  const percent = agencyPercent(order.agencyFeeIdr, order.priceIdr);
  const method = paymentMethodKey(order.paymentMethod);
  const estimate = order.agencyFeeFinal ? null : t("payment.estimate");
  const live = stream && stream.status !== "ended" && !job.completedAt ? stream : null;
  const state = orderState(job, live?.status ?? null);

  const page = (
    <div className="flex flex-col gap-6">
      <OrderBackLink label={t("back")} />

      <header className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-title font-semibold break-words text-ink">{props.serviceName}</h1>
            {live ? <FeedStatus orderId={job.id} /> : <StateChip state={state} label={t(`state.${state}`)} />}
          </div>
          <p className="text-sm text-ink-muted tabular-nums">
            {t("subtitle", { code: job.orderCode, day: props.day, window: props.window })}
          </p>
        </div>
        {props.ticket ? (
          <Link
            href={`/admin/tickets?ticket=${props.ticket.id}`}
            className="inline-flex min-h-touch items-center gap-2 rounded-full border-[1.5px] border-outline px-5 text-sm font-semibold whitespace-nowrap text-ink transition-[background-color,transform] duration-150 ease-out-quart hover:bg-card active:scale-[0.98] active:bg-sunken"
          >
            <MessageCircle className="size-4.5 shrink-0" aria-hidden="true" />
            {t("openChat")}
          </Link>
        ) : null}
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_--spacing(80)]">
        <div className="flex min-w-0 flex-col gap-6">
          <VideoCard {...props} live={live} />
          <Card id="order-facts" title={t("details.title")}>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Fact term={t("details.service")}>{props.serviceName}</Fact>
              <Fact term={t("details.schedule")}>{t("details.scheduleValue", { day: props.day, window: props.window })}</Fact>
              {props.duration ? <Fact term={t("details.duration")}>{props.duration}</Fact> : null}
              {props.areaName ? <Fact term={t("details.area")}>{props.areaName}</Fact> : null}
              <Fact term={t("details.address")}>{order.address}</Fact>
              <Fact term={t("details.note")} wide>
                {order.customerNote ? (
                  <span className="whitespace-pre-line">{order.customerNote}</span>
                ) : (
                  <span className="text-ink-muted">{t("details.noNote")}</span>
                )}
              </Fact>
            </dl>
          </Card>
        </div>

        <aside aria-label={t("asideLabel")} className="flex min-w-0 flex-col gap-6">
          <Card id="order-customer" title={t("customer.title")}>
            <Person name={order.customerName || t("customer.fallback")} detail={order.contactPhone ? null : t("customer.noPhone")} />
            {order.contactPhone ? <CallLink phone={order.contactPhone} label={t("customer.call")} /> : null}
          </Card>

          <Card id="order-cleaner" title={t("cleaner.title")}>
            {job.cleanerName ? (
              <>
                <Person name={job.cleanerName} detail={t("cleaner.role", { agency: job.agencyName })} />
                {/* The cleaner's phone (2026-11-20, UX audit item 18): set by their agency, so it may be missing. */}
                {order.cleanerPhone ? (
                  <CallLink phone={order.cleanerPhone} label={t("cleaner.call")} />
                ) : (
                  <p className="text-sm text-ink-muted">{t("cleaner.noPhone")}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-muted">{t("cleaner.none")}</p>
            )}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Fact term={t("cleaner.agency")}>{job.agencyName}</Fact>
              {props.areaName ? <Fact term={t("cleaner.area")}>{props.areaName}</Fact> : null}
            </dl>
          </Card>

          <Card id="order-payment" title={t("payment.title")}>
            <dl className="flex flex-col gap-2.5">
              <Amount term={t("payment.price")} value={money(order.priceIdr)} />
              <Amount
                term={percent === null ? t("payment.agencyFee") : t("payment.agencyFeePercent", { percent: String(percent) })}
                hint={estimate}
                value={money(order.agencyFeeIdr)}
              />
              <Amount term={t("payment.income")} hint={estimate} value={money(order.homeklinIncomeIdr)} strong />
            </dl>
            {estimate ? <p className="text-xs text-ink-muted">{t("payment.estimateNote")}</p> : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {order.status === "paid" ? (
                <StatusPill Icon={CircleCheck} pill="w-fit bg-success-surface text-success" label={t("payment.paid")} />
              ) : (
                <StatusPill Icon={CircleDashed} pill="w-fit bg-sunken text-ink" label={t(`payment.status.${order.status}`)} />
              )}
              {method ? <span className="text-ink-muted">{t("payment.method", { method: t(`payment.methods.${method}`) })}</span> : null}
            </div>
          </Card>

          <Card id="order-status" title={t("timeline.title")}>
            <Timeline steps={orderTimeline(order, live ? { status: live.status, updatedAt: order.streamUpdatedAt ?? live.updatedAt } : null)} stamp={props.stamp} />
          </Card>
        </aside>
      </div>
    </div>
  );

  return live ? <FeedCard initial={live.status}>{page}</FeedCard> : page;
}

/** "Kembali ke pemantauan langsung": underlined like the mock, a full 44 px target. */
export function OrderBackLink({ label }: { label: string }) {
  return (
    <Link
      href="/admin/monitor"
      className="inline-flex min-h-touch w-fit items-center gap-2 rounded-full pr-3 text-sm font-semibold text-primary underline underline-offset-4 transition-colors duration-150 ease-out-quart hover:decoration-2 active:text-ink"
    >
      <ArrowLeft className="size-4.5 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}

const stateStyles: Record<Exclude<OrderState, "active">, { Icon: LucideIcon; pill: string }> = {
  unassigned: { Icon: UserRoundX, pill: "bg-warning-surface text-warning" },
  assigned: { Icon: Clock, pill: "bg-sunken text-ink" },
  weak: { Icon: WifiHigh, pill: "bg-warning-surface text-warning" },
  disconnected: { Icon: WifiOff, pill: "bg-danger-surface text-danger" },
  inProgress: { Icon: Wrench, pill: "bg-success-surface text-success" },
  completed: { Icon: CircleCheck, pill: "bg-success-surface text-success" },
};

/** The chip under the title when there is no live stream to follow: an icon and a word. */
function StateChip({ state, label }: { state: OrderState; label: string }) {
  if (state === "active") return null;
  return <StatusPill {...stateStyles[state]} label={label} />;
}

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4 rounded-lg bg-card p-5 text-sm md:p-6">
      <h2 id={id} className="font-display text-lg font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Fact({ term, wide = false, children }: { term: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs font-medium text-ink-muted">{term}</dt>
      <dd className="break-words text-ink">{children}</dd>
    </div>
  );
}

/** One line of the payment: the word (with "perkiraan" before check-out) and the amount. */
function Amount({ term, hint = null, value, strong = false }: { term: string; hint?: string | null; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-ink-muted">
        {term}
        {hint ? <span className="ml-1.5 text-xs">({hint})</span> : null}
      </dt>
      <dd className={`whitespace-nowrap text-ink tabular-nums ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

/** A phone number as an outlined pill that calls it; a screen reader hears "Telepon +62...". */
function CallLink({ phone, label }: { phone: string; label: string }) {
  return (
    <a
      href={`tel:${phone}`}
      className="inline-flex min-h-touch w-fit items-center gap-2 rounded-full border-[1.5px] border-outline px-5 text-sm font-semibold whitespace-nowrap text-ink tabular-nums transition-[background-color,transform] duration-150 ease-out-quart hover:bg-field active:scale-[0.98] active:bg-sunken"
    >
      <Phone className="size-4.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{label} </span>
      {phone}
    </a>
  );
}

function Person({ name, detail }: { name: string; detail: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="flex size-touch shrink-0 items-center justify-center rounded-full bg-lime-wash text-sm font-semibold text-on-lime-wash">
        {initialsOf(name)}
      </span>
      <span className="flex min-w-0 flex-col leading-snug">
        <span className="font-semibold break-words text-ink">{name}</span>
        {detail ? <span className="text-sm break-words text-ink-muted">{detail}</span> : null}
      </span>
    </div>
  );
}

type VideoCardProps = OrderDetailProps & { live: LiveStream | null };

/** The live video when there is a stream; otherwise a calm frame that says why there is none. */
async function VideoCard({ job, order, live, time, recording }: VideoCardProps) {
  const [t, tMonitor] = await Promise.all([getTranslations("AdminOrderPage"), getTranslations("AdminMonitorPage")]);
  const cleaner = job.cleanerName ?? tMonitor("cleanerFallback");

  let frame: ReactNode;
  let note: ReactNode;
  if (live) {
    frame = (
      <Suspense fallback={<VideoLoading label={tMonitor("loading")} />}>
        <SignedFeed orderId={job.id} label={tMonitor("videoLabel", { name: cleaner })} />
      </Suspense>
    );
    const checkIn = job.checkedInAt ? time(job.checkedInAt) : null;
    note =
      live.status === "disconnected"
        ? t("video.disconnectedNote", { time: time(live.updatedAt) })
        : live.status === "weak"
          ? t("video.weakNote", { time: time(live.updatedAt) })
          : checkIn
            ? t("video.activeNote", { time: checkIn })
            : t("video.activeNoteNoTime");
  } else if (job.completedAt) {
    frame = <QuietFrame Icon={CircleStop} text={t("video.endedFrame")} />;
    note = t("video.completedNote", { time: time(job.completedAt) });
  } else if (job.checkedInAt) {
    frame = <QuietFrame Icon={CircleStop} text={t("video.noStreamFrame")} />;
    note = t("video.noStreamNote", { time: time(job.checkedInAt) });
  } else {
    frame = <QuietFrame Icon={Clock} text={tMonitor("startsAt", { time: time(job.startsAt) })} />;
    note = job.cleanerName ? t("video.waitingNote") : t("video.unassignedNote");
  }

  return (
    <Card id="order-video" title={t("video.title")}>
      {frame}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 text-ink-muted">{note}</p>
        {live ? <FeedOpen name={cleaner} /> : null}
      </div>
      {/* The stream dropped (2026-11-20, UX audit item 18): the way to reach the cleaner, right here. */}
      {live?.status === "disconnected" && order.cleanerPhone ? (
        <a
          href={`tel:${order.cleanerPhone}`}
          className="inline-flex min-h-touch w-fit items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold whitespace-nowrap text-on-primary transition-[background-color,transform] duration-150 ease-out-quart hover:bg-primary-container active:scale-[0.98] active:bg-band"
        >
          <Phone className="size-4.5 shrink-0" aria-hidden="true" />
          {t("video.callCleaner")}
          <span className="sr-only"> {order.cleanerPhone}</span>
        </a>
      ) : null}
      {job.completedAt ? <RecordingLine job={job} recording={recording} /> : null}
      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>{t("video.retention")}</span>
      </p>
    </Card>
  );
}

function QuietFrame({ Icon, text }: { Icon: LucideIcon; text: string }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-md bg-sunken p-4 text-center">
      <span aria-hidden="true" className="inline-flex size-14 items-center justify-center rounded-full bg-card text-primary">
        <Icon className="size-6" />
      </span>
      <p className="font-semibold text-ink tabular-nums">{text}</p>
    </div>
  );
}

/** A finished job's recording: a link to play it on the recordings page, or why there is none. */
async function RecordingLine({ job, recording }: { job: AdminJob; recording: AdminRecordingState }) {
  const t = await getTranslations("AdminOrderPage.video");
  if (recording === "available" && job.recordingId) {
    return (
      <Link
        href={`/admin/recordings?recording=${job.recordingId}`}
        className="inline-flex min-h-touch w-fit items-center gap-2 rounded-full border-[1.5px] border-outline px-5 text-sm font-semibold text-ink transition-[background-color,transform] duration-150 ease-out-quart hover:bg-field active:scale-[0.98] active:bg-sunken"
      >
        <CalendarClock className="size-4.5 shrink-0" aria-hidden="true" />
        {t("playRecording")}
      </Link>
    );
  }
  return <p className="text-sm text-ink-muted">{recording === "expired" ? t("recordingExpired") : t("recordingNone")}</p>;
}

const stepIcons: Record<TimelineStep["state"], { Icon: LucideIcon; tone: string }> = {
  done: { Icon: CircleCheck, tone: "text-success" },
  problem: { Icon: WifiOff, tone: "text-danger" },
  pending: { Icon: Circle, tone: "text-ink-muted" },
};

/** The status steps in order, each with an icon, its word and its time (or "Belum"). */
async function Timeline({ steps, stamp }: { steps: TimelineStep[]; stamp: (iso: string) => string }) {
  const t = await getTranslations("AdminOrderPage.timeline");
  return (
    <ol className="flex flex-col gap-3.5">
      {steps.map((step) => {
        const { Icon, tone } = step.key === "weak" ? { Icon: WifiHigh, tone: "text-warning" } : stepIcons[step.state];
        return (
          <li key={step.key} data-step={step.key} data-state={step.state} className="flex items-center gap-2.5">
            <Icon className={`size-5 shrink-0 ${tone}`} aria-hidden="true" />
            <span className={`flex-1 text-ink ${step.state === "pending" ? "" : "font-semibold"}`}>
              {t(`steps.${step.key}`)}
              {step.state === "pending" ? null : <span className="sr-only">, {t(`states.${step.state}`)}</span>}
            </span>
            <span className="text-xs text-ink-muted tabular-nums">
              {step.at ? stamp(step.at) : step.state === "pending" ? t("notYet") : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
