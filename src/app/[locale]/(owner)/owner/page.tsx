import type { Metadata } from "next";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { Notice } from "@/components/admin/notice";
import { formatAgencyDate, parseDays } from "@/components/agency/agency-views";
import { FilterLinks, Panel } from "@/components/agency/agency-ui";
import { secondaryButton } from "@/components/agency/styles";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { DailyBars, ShareBars } from "@/components/back-office/summary-pieces";
import { chartBuckets, growth, payoutShares, statusRows, type Growth } from "@/components/owner/numbers";
import { PageHeader } from "@/components/ui/page-header";
import { Link } from "@/i18n/navigation";
import { formatRupiah } from "@/lib/format";
import { getBusinessNumbers, OwnerError, type BusinessNumbers } from "@/lib/owner/owner";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OwnerDashboardPage");
  return { title: t("title") };
}

type SearchParams = Record<string, string | string[] | undefined>;

// "Ringkasan", the owner's start page (T29b; D3, after the mock Owner-Overview), the owner only: the
// chosen period's revenue, paid orders, average order and what went to the partner agencies, each
// against the period before (7, 30 or 90 days, ?days=, 30 when absent); revenue over the same period
// (per day, per week for 90 days); the agency fees per partner in the period; and the orders made in
// the period by status (SPEC, Owner). Since 2026-11-20 every part follows the chosen period. The
// title is prerendered; the range toggle and the numbers render inside the page's own role checks (a
// layout's check would not protect them) and are read with the owner's own session through
// owner_numbers(p_days), which answers the owner role only and carries no customer data. Never cached.
export default function OwnerDashboardPage({ searchParams }: PageProps<"/[locale]/owner">) {
  const t = useTranslations("OwnerDashboardPage");
  return (
    <>
      <PageHeader
        size="compact"
        title={t("title")}
        description={t("description")}
        action={
          <Suspense fallback={<GateFallback variant="action" />}>
            <RoleGate roles={["owner"]}>
              <OverviewRange searchParams={searchParams} />
            </RoleGate>
          </Suspense>
        }
      />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["owner"]}>
          <OwnerOverview searchParams={searchParams} />
        </RoleGate>
      </Suspense>
    </>
  );
}

/** The range toggle beside the title: 7, 30 or 90 days, as links (?days=), like the partner summary. */
async function OverviewRange({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [t, params] = await Promise.all([getTranslations("OwnerDashboardPage"), searchParams]);
  const days = parseDays(params.days);
  return (
    <FilterLinks
      label={t("rangeLabel")}
      options={([7, 30, 90] as const).map((option) => ({
        key: String(option),
        label: t("range", { days: option }),
        href: option === 30 ? "/owner" : { pathname: "/owner", query: { days: String(option) } },
        current: option === days,
      }))}
    />
  );
}

async function OwnerOverview({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [t, locale, params] = await Promise.all([getTranslations("OwnerDashboardPage"), getLocale(), searchParams]);
  const days = parseDays(params.days);

  let numbers: BusinessNumbers;
  try {
    numbers = await getBusinessNumbers(await createSupabaseServerClient({ writeCookies: false }), days);
  } catch (error) {
    // Only a failed read becomes a message; anything else (such as Next.js' own signals) goes on.
    if (!(error instanceof OwnerError)) throw error;
    console.error(error);
    return (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }

  const money = (amount: number) => formatRupiah(amount, locale);
  const { period, previous } = numbers;
  const shares = payoutShares(numbers.payoutsByAgency.map((agency) => ({ id: agency.id, name: agency.name, amountIdr: agency.paidOutIdr })));
  const statuses = statusRows(numbers.byStatusPeriod);
  const totalOrders = statuses.reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <ul aria-label={t("statsLabel", { days })} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(50)),1fr))] gap-4">
        <Stat label={t("stats.revenue")} value={money(period.revenueIdr)}>
          <GrowthLine change={growth(period.revenueIdr, previous.revenueIdr)} days={days} />
        </Stat>
        <Stat label={t("stats.orders")} value={String(period.paidOrders)}>
          {t("stats.ordersHint")}
        </Stat>
        <Stat label={t("stats.average")} value={money(period.avgOrderIdr)}>
          {t("stats.averageHint")}
        </Stat>
        <Stat label={t("stats.paidOut")} value={money(period.paidOutIdr)}>
          {t("stats.paidOutHint", { amount: money(period.homeklinIdr) })}
        </Stat>
      </ul>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        <DailyRevenue daily={numbers.dailyPeriod} days={days} />
        <Panel id="owner-payouts" title={t("payouts.title")} description={t("payouts.description", { days, total: money(shares.totalIdr) })}>
          <ShareBars rows={shares.rows} locale={locale} empty={t("payouts.empty")} />
          <Link href="/owner/agencies" className={`${secondaryButton} w-fit`}>
            {t("payouts.allPartners")}
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        </Panel>
      </div>

      <Panel id="owner-status" title={t("status.title")} description={t("status.description", { days })}>
        <p className="text-sm font-semibold text-ink">{t("status.total", { count: totalOrders })}</p>
        <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          {statuses.map((row) => (
            <li key={row.status} className="flex flex-col gap-1.5">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="text-ink">{t(`status.${row.status}`)}</span>
                <span className="whitespace-nowrap tabular-nums">
                  <span className="font-semibold text-ink">{row.count}</span>{" "}
                  <span className="text-ink-muted">({t("status.share", { percent: row.percent })})</span>
                </span>
              </span>
              {/* One hue for every status: the bar repeats the share, the words say which status. */}
              <span aria-hidden="true" className="block h-2 overflow-hidden rounded-full bg-sunken">
                <span className="block h-full rounded-full bg-mint" style={{ width: `${row.percent}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

/** A number tile of the mock: what it is, the number, and a line under it. */
function Stat({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-card p-5">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="font-display text-2xl font-semibold text-ink tabular-nums">{value}</span>
      <span className="text-sm text-ink-muted tabular-nums">{children}</span>
    </li>
  );
}

/** "naik 8% dari 30 hari sebelumnya": the words carry the direction; the arrow and the green repeat it. */
async function GrowthLine({ change, days }: { change: Growth; days: number }) {
  const t = await getTranslations("OwnerDashboardPage");
  const words = t(`growth.${change.direction}`, { percent: change.percent, days });
  if (change.direction === "up" || change.direction === "down") {
    const Arrow = change.direction === "up" ? ArrowUpRight : ArrowDownRight;
    return (
      <span className={`inline-flex items-start gap-1.5 font-medium ${change.direction === "up" ? "text-success" : "text-danger"}`}>
        <Arrow className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {words}
      </span>
    );
  }
  return <>{words}</>;
}

async function DailyRevenue({ daily, days }: { daily: BusinessNumbers["dailyPeriod"]; days: number }) {
  const [t, locale] = await Promise.all([getTranslations("OwnerDashboardPage"), getLocale()]);
  const money = (amount: number) => formatRupiah(amount, locale);
  // One bar a day for 7 and 30 days, one a week for 90 (chartBuckets).
  const { unit, buckets: series } = chartBuckets(daily);
  const weekly = unit === "week";
  const dayLabel = (date: string) => formatAgencyDate(date, locale, "short");
  const first = series[0];
  const last = series[series.length - 1];
  const total = series.reduce((sum, day) => sum + day.amountIdr, 0);
  // What the bars say, in one sentence for screen readers (the bars themselves are hidden from them).
  let sentence = t("daily.noneSentence", { count: days });
  if (first && total > 0) {
    const highest = series.reduce((best, day) => (day.amountIdr > best.amountIdr ? day : best), first);
    sentence = t(weekly ? "daily.sentenceWeekly" : "daily.sentence", {
      count: days,
      total: money(total),
      high: money(highest.amountIdr),
      highDay: weekly ? t("daily.weekRange", { from: dayLabel(highest.date), to: dayLabel(highest.end) }) : dayLabel(highest.date),
    });
  }
  const span = first && last ? { from: dayLabel(first.date), to: dayLabel(last.end) } : { from: "", to: "" };

  return (
    <Panel
      id="owner-daily"
      title={weekly ? t("daily.titleWeekly") : t("daily.title")}
      description={t(weekly ? "daily.descriptionWeekly" : "daily.description", { ...span, days })}
    >
      <DailyBars
        series={series}
        locale={locale}
        sentence={sentence}
        table={{
          show: weekly ? t("daily.showTableWeekly") : t("daily.showTable"),
          caption: t(weekly ? "daily.tableCaptionWeekly" : "daily.tableCaption", { days }),
          columns: [weekly ? t("daily.week") : t("daily.day"), t("daily.revenue")],
          rows: series.map((bucket) => ({
            key: bucket.date,
            cells: [
              weekly ? t("daily.weekRange", { from: dayLabel(bucket.date), to: dayLabel(bucket.end) }) : formatAgencyDate(bucket.date, locale, "weekday"),
              money(bucket.amountIdr),
            ],
          })),
        }}
      />
    </Panel>
  );
}
