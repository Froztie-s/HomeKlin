import { CalendarClock, CirclePlay, ShieldCheck, VideoOff, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { SlotLabels } from "@/components/customer/slot-labels";
import { jakartaDayOf } from "@/components/customer/booking-query";
import { Link } from "@/i18n/navigation";
import type { AdminJob } from "@/lib/jobs/jobs";
import type { AdminRecordingState } from "./admin-console";

/** A finished job as the table shows it. */
export type RecordingRow = AdminJob & {
  serviceName: string | undefined;
  areaName: string | undefined;
  state: AdminRecordingState;
};

type RecordingsTableProps = {
  rows: readonly RecordingRow[];
  /** The recording being played, if any, so its row says so. */
  playing: string | null;
  labels: SlotLabels;
  now: Date;
};

const cell = "px-4 py-3 align-top";
const headCell = "px-4 py-3 text-left text-xs font-semibold text-ink-muted";

const stateIcons: Record<AdminRecordingState, { Icon: LucideIcon; tone: string }> = {
  available: { Icon: CalendarClock, tone: "text-ink" },
  expired: { Icon: ShieldCheck, tone: "text-ink-muted" },
  none: { Icon: VideoOff, tone: "text-ink-muted" },
};

// Admin's past jobs (T26): when each finished, which service in which area, the partner agency, the
// cleaner, and its recording: available until when (with "Putar"), deleted after its 7 days, or none.
// A real table on a desk; below 1024 px the agency and the cleaner move under the service, and below
// 768 px each job is one cell, so nothing scrolls sideways. Hidden cells are display: none, so a
// screen reader meets each fact once. Times in Jakarta time (WIB).
export async function RecordingsTable({ rows, playing, labels, now }: RecordingsTableProps) {
  const t = await getTranslations("AdminRecordingsPage");

  const day = (iso: string) => labels.day({ date: jakartaDayOf(iso, now).date, relative: null });

  const finished = (row: RecordingRow) => {
    const at = row.completedAt ?? row.endsAt;
    return <span className="block font-semibold whitespace-nowrap">{t("finishedAt", { day: day(at), time: labels.time(at) })}</span>;
  };

  const service = (row: RecordingRow, under: string) => (
    <>
      <span className="block font-semibold text-ink">{row.serviceName ?? t("serviceFallback")}</span>
      {row.areaName ? <span className="mt-0.5 block text-ink-muted">{row.areaName}</span> : null}
      <span className={`mt-0.5 block text-ink-muted ${under}`}>
        {row.agencyName} · {row.cleanerName ?? t("noCleaner")}
      </span>
    </>
  );

  const recording = (row: RecordingRow) => {
    const { Icon, tone } = stateIcons[row.state];
    // adminRecordingState says available only with an expiry time.
    const until = row.recordingExpiresAt ?? row.endsAt;
    const text =
      row.state === "available" ? t("state.available", { day: day(until), time: labels.time(until) }) : t(`state.${row.state}`);
    return (
      <span className={`flex items-start gap-1.5 ${tone}`}>
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{text}</span>
      </span>
    );
  };

  const action = (row: RecordingRow) => {
    if (row.state !== "available" || !row.recordingId) return null;
    if (row.recordingId === playing) {
      return (
        <span className="-ml-3 inline-flex min-h-touch items-center gap-1.5 px-3 text-sm font-semibold whitespace-nowrap text-live" aria-current="true">
          <span aria-hidden="true" className="size-2 rounded-full bg-live-dot" />
          {t("playing")}
        </span>
      );
    }
    return (
      <Link
        href={`/admin/recordings?recording=${row.recordingId}`}
        className="-ml-3 inline-flex min-h-touch items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap text-brand-700 transition-colors duration-150 ease-out-quart hover:bg-surface-sunken hover:text-brand-800 active:bg-brand-50"
      >
        <CirclePlay className="size-4 shrink-0" aria-hidden="true" />
        {t("play")}
        <span className="sr-only"> {row.serviceName ?? t("serviceFallback")}, {row.cleanerName ?? t("noCleaner")}</span>
      </Link>
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{t("tableCaption")}</caption>
        <thead className="bg-surface-sunken">
          <tr>
            <th scope="col" className={headCell}>
              {t("table.finished")}
            </th>
            <th scope="col" className={`${headCell} hidden md:table-cell`}>
              {t("table.service")}
            </th>
            <th scope="col" className={`${headCell} hidden lg:table-cell`}>
              {t("table.agency")}
            </th>
            <th scope="col" className={`${headCell} hidden lg:table-cell`}>
              {t("table.cleaner")}
            </th>
            <th scope="col" className={`${headCell} hidden md:table-cell`}>
              {t("table.recording")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr
              key={row.id}
              data-job={row.id}
              className={`transition-colors duration-150 ease-out-quart hover:bg-canvas ${row.recordingId !== null && row.recordingId === playing ? "bg-brand-50" : ""}`}
            >
              <td className={`${cell} text-ink tabular-nums`}>
                {finished(row)}
                {/* Phones: the whole job in this one cell, so the table never needs a sideways scroll. */}
                <span className="mt-3 flex flex-col gap-2 md:hidden">
                  <span>{service(row, "")}</span>
                  {recording(row)}
                  <span>{action(row)}</span>
                </span>
              </td>
              <td className={`${cell} hidden md:table-cell`}>{service(row, "lg:hidden")}</td>
              <td className={`${cell} hidden text-ink lg:table-cell`}>{row.agencyName}</td>
              <td className={`${cell} hidden lg:table-cell`}>
                {row.cleanerName ? <span className="text-ink">{row.cleanerName}</span> : <span className="text-ink-muted">{t("noCleaner")}</span>}
              </td>
              <td className={`${cell} hidden md:table-cell`}>
                <span className="flex flex-col items-start gap-1">
                  {recording(row)}
                  {action(row)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
