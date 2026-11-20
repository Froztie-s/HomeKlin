import { ChevronDown } from "lucide-react";
import { chartScale, formatAgencyDate, formatRupiahCompact } from "@/components/agency/agency-views";
import { secondaryButton } from "@/components/agency/styles";
import { formatRupiah } from "@/lib/format";

// The summary pieces the redesigned agency and owner dashboards share (D2 "Partner-Summary", lifted at
// D3 for "Owner-Overview"; markdown/design.md): a number tile, daily bars and share bars, drawn in CSS
// with no chart library. Server-safe and without messages of their own: the caller passes the words.
// Nothing is shown by bar length alone: the daily bars carry a sentence for screen readers and an
// open-able table, and every share bar repeats the amount and the percentage written beside it.

type Locale = "id" | "en";

/** One number with what it is above it and a line under it. */
export function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-card p-5">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="font-display text-2xl font-semibold text-ink tabular-nums">{value}</span>
      <span className="text-sm text-ink-muted tabular-nums">{hint}</span>
    </li>
  );
}

export type DailyBar = { date: string; amountIdr: number };

type DailyTable = {
  /** The words of the toggle that opens the table ("Lihat angka per hari"). */
  show: string;
  caption: string;
  columns: readonly string[];
  /** One row per day; the first cell is the day. */
  rows: readonly { key: string; cells: readonly string[] }[];
};

/**
 * Daily amounts as bars (Jakarta days, oldest first) on a scale labelled in compact rupiah, with the
 * day numbers and the month names under them. `sentence` says what the bars show, for screen readers
 * (the bars are hidden from them); `table` holds every number in words.
 */
export function DailyBars({ series, locale, sentence, table }: { series: readonly DailyBar[]; locale: Locale; sentence: string; table: DailyTable }) {
  const max = Math.max(0, ...series.map((day) => day.amountIdr));
  const scale = chartScale(max);
  const first = series[0];
  const last = series[series.length - 1];
  // Month names under the first and last day shown, as in the mocks ("Okt", "Nov").
  const monthOf = (date: string) => formatAgencyDate(date, locale, "short").split(" ")[1];

  return (
    <>
      <p className="sr-only">{sentence}</p>
      {first && last ? (
        <div aria-hidden="true" className="flex gap-3">
          <div className="relative h-44 w-16 shrink-0 text-xs text-ink-muted tabular-nums">
            {scale.ticks.map((tick) => (
              <span key={tick} className="absolute right-0 translate-y-1/2" style={{ bottom: `${scale.top ? (tick / scale.top) * 100 : 0}%` }}>
                {formatRupiahCompact(tick, locale)}
              </span>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="relative h-44 border-b border-border-control">
              {scale.ticks.slice(1).map((tick) => (
                <span key={tick} className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${(tick / scale.top) * 100}%` }} />
              ))}
              <div className="absolute inset-0 flex items-end gap-1 sm:gap-2">
                {series.map((day) => (
                  <span
                    key={day.date}
                    data-day={day.date}
                    className="flex-1 rounded-t-sm bg-mint"
                    style={{ height: scale.top ? `${(day.amountIdr / scale.top) * 100}%` : "0%" }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-1 text-center text-xs text-ink-muted tabular-nums sm:gap-2">
              {/* Below 640 px a long series names every other day, counted back from the last, so two-digit days never touch. */}
              {series.map((day, index) => (
                <span
                  key={day.date}
                  className={`min-w-0 flex-1 ${series.length > 7 && (series.length - 1 - index) % 2 === 1 ? "max-sm:invisible" : ""}`}
                >
                  {Number(day.date.slice(8))}
                </span>
              ))}
            </div>
            <div className="flex justify-between text-xs font-semibold text-ink">
              <span>{monthOf(first.date)}</span>
              {monthOf(last.date) !== monthOf(first.date) ? <span>{monthOf(last.date)}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
      {/* The toggle looks like the page's other secondary buttons ("Lihat semua mitra"), with a chevron
          that turns when open, so it reads as something to press (2026-11-20, UX audit item 21). */}
      <details className="group text-sm">
        <summary className={`${secondaryButton} w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
          {table.show}
          <ChevronDown className="size-4 shrink-0 transition-transform duration-150 ease-out-quart group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-2 max-h-96 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{table.caption}</caption>
            <thead className="sticky top-0 bg-sunken">
              <tr>
                {table.columns.map((column, index) => (
                  <th key={column} scope="col" className={`px-3 py-2 text-xs font-semibold text-ink ${index === 0 ? "text-left" : "text-right"}`}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {table.rows.map((row) => (
                <tr key={row.key}>
                  {row.cells.map((cell, index) => (
                    <td key={index} className={`px-3 py-2 text-ink ${index === 0 ? "" : "text-right whitespace-nowrap tabular-nums"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export type ShareRow = { id: string; name: string; amountIdr: number; sharePercent: number };

/** Each row's amount and its share of the total, written out, with a bar that repeats the share. */
export function ShareBars({ rows, locale, empty }: { rows: readonly ShareRow[]; locale: Locale; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-ink-muted">{empty}</p>;
  const percent = new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-ID", { maximumFractionDigits: 1 });
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-1.5">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
            <span className="min-w-0 font-semibold text-ink">{row.name}</span>
            <span className="text-ink tabular-nums">
              <span className="font-semibold">{formatRupiah(row.amountIdr, locale)}</span>{" "}
              <span className="text-ink-muted">({percent.format(row.sharePercent)}%)</span>
            </span>
          </span>
          {/* The bar repeats the percentage beside it; it carries no meaning of its own. */}
          <span aria-hidden="true" className="block h-2 overflow-hidden rounded-full bg-sunken">
            <span className="block h-full rounded-full bg-mint" style={{ width: `${Math.min(Math.max(row.sharePercent, 0), 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
