import { CalendarClock, ChevronRight, ClipboardList, SearchX } from "lucide-react";
import type { Locale } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";
import type { CustomerOrder } from "@/lib/booking/orders";
import { formatJakartaTime } from "@/lib/catalog/slots-days";
import { formatRupiah } from "@/lib/format";
import { flowCard, flowCardTitle, flowNote, flowNoteIcon, flowPageTitle, flowTextLink } from "./flow-styles";
import { HelpCard } from "./order-details";
import { recordingWords, RecordingLine } from "./order-list";
import { orderStage } from "./order-stage";
import { OrderStatusPill } from "./order-status";
import {
  filterHistory,
  groupByMonth,
  historyHref,
  historyFilterOf,
  historySummary,
  pickMonth,
  splitOrders,
  type HistoryFilter,
} from "./orders-overview-data";
import { recordingState } from "./recording-time";
import { getSlotLabels } from "./slot-labels";
import { HistoryMonthPicker } from "./history-month-picker";

type OrdersHistoryProps = {
  orders: CustomerOrder[];
  serviceName: (order: CustomerOrder) => string | undefined;
  now: Date;
  filter: HistoryFilter;
  /** The month asked for in the address (?bulan=2026-11); the latest month with orders otherwise. */
  month?: string;
};

const dateLocales: Record<Locale, string> = { id: "id-ID", en: "en-ID" };
const jakarta = "Asia/Jakarta";

// "Riwayat pesanan", /orders (2026-11-20): the customer's finished orders on a page of their own, apart
// from the signed-in home (/home, ./orders-overview.tsx), which holds the orders still to come. The
// same forest look, laid out as a record rather than a to-do list: a summary of jobs done, recordings
// still to watch and what was paid; a filter (Semua, Selesai, Tidak jadi) kept in the address; and the
// orders of one month at a time (picked with ./history-month-picker.tsx, kept in the address as
// ?bulan=2026-11, so the page never becomes one long scroll), the latest job first, as compact rows in
// one white card, each with its date, its stage, its recording and its price.
// Every row opens the order (/orders?order=<id>). Orders still running are only counted, with the way
// back to the home.
export async function OrdersHistory({ orders, serviceName, now, filter, month }: OrdersHistoryProps) {
  const locale = await getLocale();
  const [t, tStage, tConfirmation, tOverview, tRecording, labels] = await Promise.all([
    getTranslations("OrdersHistory"),
    getTranslations("OrderStage"),
    getTranslations("OrderConfirmation"),
    getTranslations("OrdersOverview"),
    getTranslations("Recording"),
    getSlotLabels(locale),
  ]);
  const recordingText = recordingWords(tRecording, labels, now);
  const split = splitOrders(orders, now);
  const ongoing = split.live.length + split.upcoming.length;
  const history = split.history;
  const shown = filterHistory(history, filter, now);
  const summary = historySummary(history, now);
  const counts: Record<HistoryFilter, number> = {
    all: history.length,
    done: history.filter((order) => historyFilterOf(order, now) === "done").length,
    notDone: history.filter((order) => historyFilterOf(order, now) === "notDone").length,
  };

  const monthFormat = new Intl.DateTimeFormat(dateLocales[locale], { month: "long", year: "numeric", timeZone: jakarta });
  const dayFormat = new Intl.DateTimeFormat(dateLocales[locale], { day: "numeric", timeZone: jakarta });
  const weekdayFormat = new Intl.DateTimeFormat(dateLocales[locale], { weekday: "short", timeZone: jakarta });
  const monthLabel = (value: string) => monthFormat.format(new Date(`${value}-15T05:00:00.000Z`));
  const groups = groupByMonth(shown);
  const group = groups[pickMonth(groups, month)];

  return (
    <div className="flex flex-col gap-6 md:gap-7">
      <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className={flowPageTitle}>{t("title")}</h1>
          <p className="max-w-prose text-ink-muted md:text-body-lg">{t("lead")}</p>
        </div>
        <ButtonLink href="/services" variant="forest" size="lg" className="shrink-0">
          {tOverview("bookAgain")}
        </ButtonLink>
      </header>

      {ongoing > 0 ? (
        <p className={flowNote}>
          <span className={flowNoteIcon} aria-hidden="true">
            <CalendarClock className="size-4.5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="py-2">{t("ongoingNote", { count: ongoing })}</span>
            <Link href="/home" className={flowTextLink}>
              {t("ongoingLink")}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </span>
        </p>
      ) : null}

      {history.length === 0 ? (
        <EmptyState tone="forest" icon={ClipboardList} title={t("emptyTitle")}>
          {t("emptyBody")}
        </EmptyState>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div className="flex min-w-0 flex-col gap-6">
            <dl aria-label={t("summaryLabel")} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat term={t("stats.done")} value={String(summary.done)} />
              <Stat term={t("stats.recordings")} value={String(summary.recordings)} />
              <Stat term={t("stats.paid")} value={formatRupiah(summary.paidIdr, locale)} wide />
            </dl>

            <nav aria-label={t("filterLabel")} className="-mx-1 flex flex-wrap gap-2 px-1">
              {(["all", "done", "notDone"] as const).map((option) => {
                const active = option === filter;
                return (
                  <Link
                    key={option}
                    href={historyHref(option, group?.month)}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-touch items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-150 ease-out-quart ${
                      active ? "bg-primary text-on-primary" : "bg-card text-ink inset-ring-1 inset-ring-border hover:bg-sunken active:bg-lime-wash"
                    }`}
                  >
                    {t(`filters.${option}`)}
                    <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${active ? "bg-band text-lime" : "bg-sunken text-ink-muted"}`}>
                      {counts[option]}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {!group ? (
              <EmptyState tone="forest" icon={SearchX} title={t("filterEmptyTitle")}>
                {t("filterEmptyBody")}
              </EmptyState>
            ) : (
                <section aria-labelledby={`bulan-${group.month}`} className="flex flex-col gap-2.5">
                  <HistoryMonthPicker
                    selected={group.month}
                    options={groups.map((option) => ({
                      value: option.month,
                      label: t("monthOption", { month: monthLabel(option.month), count: String(option.orders.length) }),
                      href: historyHref(filter, option.month),
                    }))}
                    labels={{ select: t("monthSelect"), older: t("olderMonth"), newer: t("newerMonth") }}
                  />
                  <h2 id={`bulan-${group.month}`} className="sr-only">
                    {monthLabel(group.month)}
                  </h2>
                  <ul aria-labelledby={`bulan-${group.month}`} className="divide-y divide-border overflow-hidden rounded-lg bg-card">
                    {group.orders.map((order) => {
                      const stage = orderStage(order, now);
                      const recording = recordingState(order, now.getTime());
                      const starts = new Date(order.startsAt);
                      return (
                        <li key={order.id}>
                          <Link
                            href={`/orders?order=${order.id}`}
                            className="group flex items-center gap-4 p-4 transition-colors duration-150 ease-out-quart hover:bg-sunken/60 active:bg-sunken md:px-6"
                          >
                            <span
                              aria-hidden="true"
                              className="flex size-14 shrink-0 flex-col items-center justify-center rounded-md bg-lime-wash text-on-lime-wash"
                            >
                              <span className="text-xs font-semibold uppercase">{weekdayFormat.format(starts)}</span>
                              <span className="font-display text-xl leading-none font-semibold tabular-nums">{dayFormat.format(starts)}</span>
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                                <span className="font-semibold text-ink">{serviceName(order) ?? tConfirmation("serviceFallback")}</span>
                                <span className="font-semibold whitespace-nowrap text-ink tabular-nums">{formatRupiah(order.priceIdr, locale)}</span>
                              </span>
                              <span className="text-sm text-ink-muted tabular-nums">
                                {t("rowLine", {
                                  code: order.orderCode,
                                  start: formatJakartaTime(order.startsAt, locale),
                                  end: formatJakartaTime(order.endsAt, locale),
                                })}
                              </span>
                              <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                                <OrderStatusPill status={stage} label={tStage(stage)} />
                                {recording !== "none" ? <RecordingLine state={recording} text={recordingText(order, recording)} /> : null}
                              </span>
                            </span>
                            <ChevronRight
                              className="size-5 shrink-0 text-ink-muted transition-transform duration-150 ease-out-quart group-hover:translate-x-0.5"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
            )}
          </div>

          <aside aria-label={tOverview("asideLabel")} className="flex flex-col gap-4">
            <section aria-labelledby="tentang-rekaman" className={flowCard}>
              <h2 id="tentang-rekaman" className={flowCardTitle}>
                {tOverview("recordingTitle")}
              </h2>
              <p className="mt-2 text-sm text-ink-muted">{tOverview("recordingFacts.kept")}</p>
              <Link href="/orders/recording" className={`${flowTextLink} mt-3`}>
                {tOverview("seeRecordings")}
              </Link>
            </section>
            <HelpCard />
          </aside>
        </div>
      )}
    </div>
  );
}

function Stat({ term, value, wide = false }: { term: string; value: string; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 rounded-lg bg-card p-4 md:p-5 ${wide ? "col-span-2 sm:col-span-1" : ""}`}>
      <dt className="text-sm text-ink-muted">{term}</dt>
      <dd className="font-display text-2xl font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}
