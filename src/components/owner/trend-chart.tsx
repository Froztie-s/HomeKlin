import { getLocale, getTranslations } from "next-intl/server";
import { formatRupiah } from "@/lib/format";
import { barPercent, shortDate, trendSummary, type TrendDay } from "./numbers";

type TrendChartProps = {
  /** The last 30 days, oldest first. */
  trend: readonly TrendDay[];
};

const headCell = "px-3 py-2 text-left text-xs font-semibold text-ink-muted";

// "30 hari terakhir" on the owner dashboard (T29b): new orders per day as one series of thin bars
// (one hue, no legend: the heading names it), drawn in CSS with no chart library. The chart is one
// image to a screen reader, labelled with the totals and the busiest day in words; every number is in
// the table under "Tampilkan sebagai tabel". Hovering a day shows its orders and revenue. The scale
// is labelled at its top and zero, with recessive gridlines at the top and the middle; the first and
// last dates sit under the bars. Nothing animates.
export async function TrendChart({ trend }: TrendChartProps) {
  const [t, locale] = await Promise.all([getTranslations("OwnerDashboardPage"), getLocale()]);
  const summary = trendSummary(trend);
  const revenue = formatRupiah(summary.revenueIdr, locale);
  const busiest = summary.busiest
    ? t("trend.busiest", { date: shortDate(summary.busiest.date, locale), count: summary.busiest.orders })
    : t("trend.none");
  const first = trend[0];
  const last = trend[trend.length - 1];

  return (
    <section aria-labelledby="owner-trend" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 xl:p-6">
      <header className="flex flex-col gap-1">
        <h2 id="owner-trend" className="font-display text-lg font-semibold text-ink">
          {t("trend.title")}
        </h2>
        <p className="text-sm text-ink-muted">{t("trend.description")}</p>
      </header>
      <p className="text-sm font-medium text-ink">{t("trend.summary", { orders: summary.orders, revenue })}</p>

      <div className="flex gap-3">
        {/* The scale: its top and zero, in muted text (the middle line is unlabelled). */}
        <div aria-hidden="true" className="flex h-44 flex-col justify-between text-right text-xs text-ink-faint tabular-nums">
          <span className="-translate-y-1/2">{summary.max}</span>
          <span className="translate-y-1/2">0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div
            role="img"
            aria-label={t("trend.chartLabel", { orders: summary.orders, busiest })}
            className="relative flex h-44 items-end gap-0.5 border-b border-border-control"
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 border-t border-border" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-border" />
            {trend.map((day) => {
              const height = barPercent(day.orders, summary.max);
              return (
                // The whole column is the hover target, wider and taller than the bar itself.
                <div key={day.date} aria-hidden="true" className="group relative flex h-full flex-1 items-end justify-center">
                  <span
                    className="w-full max-w-4 rounded-t-sm bg-brand-600 transition-colors duration-150 ease-out-quart group-hover:bg-brand-800"
                    style={{ height: `${height}%` }}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-(--z-sticky) mb-1 hidden -translate-x-1/2 rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-on-brand shadow-raised group-hover:block">
                    {t("trend.tooltip", {
                      date: shortDate(day.date, locale),
                      orders: day.orders,
                      revenue: formatRupiah(day.revenueIdr, locale),
                    })}
                  </span>
                </div>
              );
            })}
          </div>
          {first && last ? (
            <div aria-hidden="true" className="mt-1.5 flex justify-between text-xs text-ink-faint">
              <span>{shortDate(first.date, locale)}</span>
              <span>{shortDate(last.date, locale)}</span>
            </div>
          ) : null}
        </div>
      </div>

      <details className="group/table rounded-md border border-border">
        <summary className="flex min-h-touch cursor-pointer items-center rounded-md px-3 text-sm font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:bg-surface-sunken hover:text-brand-800 active:bg-brand-50">
          {t("trend.showTable")}
        </summary>
        <div className="max-h-80 overflow-y-auto border-t border-border">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t("trend.tableCaption")}</caption>
            <thead className="sticky top-0 bg-surface-sunken">
              <tr>
                <th scope="col" className={headCell}>
                  {t("trend.date")}
                </th>
                <th scope="col" className={`${headCell} text-right`}>
                  {t("trend.orders")}
                </th>
                <th scope="col" className={`${headCell} text-right`}>
                  {t("trend.revenue")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {trend.map((day) => (
                <tr key={day.date}>
                  <th scope="row" className="px-3 py-2 text-left font-normal text-ink">
                    {shortDate(day.date, locale)}
                  </th>
                  <td className="px-3 py-2 text-right text-ink tabular-nums">{day.orders}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-ink tabular-nums">
                    {formatRupiah(day.revenueIdr, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
