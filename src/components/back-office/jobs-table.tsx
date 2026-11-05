import { CircleCheck, CircleDashed, MapPinCheck, UserCheck, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { jakartaDayOf } from "@/components/customer/booking-query";
import { getSlotLabels } from "@/components/customer/slot-labels";
import { jobProgress, type BackOfficeJob, type JobProgress } from "@/lib/jobs/jobs";

/** A job as the table shows it: the back-office job plus what the page knows about it. */
export type JobsTableRow = Pick<BackOfficeJob, "id" | "startsAt" | "endsAt" | "cleanerName" | "checkedInAt" | "completedAt"> & {
  /** The service's name in this language, or undefined when it is no longer in the catalog. */
  serviceName: string | undefined;
  /** A second line under the service: the area and address for the agency. */
  detail?: string;
  /** Admin only: the partner agency the job was routed to. */
  agencyName?: string;
  /** Agency only (T28): the control that assigns a cleaner, in place of the cleaner's name. */
  assign?: ReactNode;
};

type JobsTableProps = {
  rows: readonly JobsTableRow[];
  /** The table's name, for screen readers (and the e2e checks). */
  caption: string;
  /** "date" writes the day and the window (the agency's list); "time" only the window (today's jobs). */
  when: "date" | "time";
};

const cell = "px-4 py-3 align-top";
const headCell = "px-4 py-3 text-left text-xs font-semibold text-ink-muted";

// Where each status stands, as a word with an icon, never colour alone.
const statusStyles: Record<JobProgress, { Icon: LucideIcon; pill: string }> = {
  unassigned: { Icon: CircleDashed, pill: "bg-warning-surface text-warning" },
  assigned: { Icon: UserCheck, pill: "bg-info-surface text-info" },
  inProgress: { Icon: MapPinCheck, pill: "bg-live-surface text-live" },
  completed: { Icon: CircleCheck, pill: "bg-success-surface text-success" },
};

// Jobs in the back office (T18): when, which service, (for admin) which agency, which cleaner, and
// where the job stands: no cleaner yet, assigned, checked in at a time, finished at a time. Admin's
// table is read-only; the agency's rows may carry an assign control (T28) in place of the cleaner's
// name, for jobs nobody has checked in to yet. A real table on a desk; below 1024 px the agency and the cleaner move under
// the service and the status, and below 768 px each job is one cell, so nothing scrolls sideways. Hidden cells are display: none, so a screen reader meets each fact
// once. Times are in Jakarta time (WIB), whatever the server's time zone.
export async function JobsTable({ rows, caption, when }: JobsTableProps) {
  const locale = await getLocale();
  const [t, labels] = await Promise.all([getTranslations("BackOfficeJobs"), getSlotLabels(locale)]);
  const now = new Date();
  const showAgency = rows.some((row) => row.agencyName !== undefined);

  function status(row: JobsTableRow) {
    const progress = jobProgress(row);
    const { Icon, pill } = statusStyles[progress];
    // jobProgress says inProgress only with a check-in time and completed only with a finish time.
    const label =
      progress === "inProgress"
        ? t("status.inProgress", { time: labels.time(row.checkedInAt ?? row.startsAt) })
        : progress === "completed"
          ? t("status.completed", { time: labels.time(row.completedAt ?? row.endsAt) })
          : t(`status.${progress}`);
    return (
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${pill}`}>
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
      </span>
    );
  }

  const cleaner = (row: JobsTableRow) =>
    row.assign ? (
      row.assign
    ) : row.cleanerName ? <span className="text-ink">{row.cleanerName}</span> : <span className="text-ink-muted">{t("noCleaner")}</span>;

  // The base styles give every <p> `text-wrap: pretty`, which would undo an inherited nowrap, so the
  // lines that must not wrap are blocks of their own.
  const whenCell = (row: JobsTableRow) => {
    const span = t("timeValue", { window: labels.window(row) });
    return when === "date" ? (
      <>
        <span className="block font-semibold whitespace-nowrap">{labels.day(jakartaDayOf(row.startsAt, now))}</span>
        <span className="block whitespace-nowrap text-ink-muted">{span}</span>
      </>
    ) : (
      <span className="block font-semibold whitespace-nowrap">{span}</span>
    );
  };

  const service = (row: JobsTableRow, agencyUnder: string) => (
    <>
      <span className="block font-semibold text-ink">{row.serviceName ?? t("serviceFallback")}</span>
      {row.detail ? <span className="mt-0.5 block max-w-prose text-ink-muted">{row.detail}</span> : null}
      {showAgency ? <span className={`mt-0.5 block text-ink-muted ${agencyUnder}`}>{row.agencyName}</span> : null}
    </>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-sunken">
          <tr>
            <th scope="col" className={headCell}>
              {t("table.window")}
            </th>
            <th scope="col" className={`${headCell} hidden md:table-cell`}>
              {t("table.service")}
            </th>
            {showAgency ? (
              <th scope="col" className={`${headCell} hidden lg:table-cell`}>
                {t("table.agency")}
              </th>
            ) : null}
            <th scope="col" className={`${headCell} hidden lg:table-cell`}>
              {t("table.cleaner")}
            </th>
            <th scope="col" className={`${headCell} hidden md:table-cell`}>
              {t("table.status")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id} data-job={row.id} className="transition-colors duration-150 ease-out-quart hover:bg-canvas">
              <td className={`${cell} text-ink tabular-nums`}>
                {whenCell(row)}
                {/* Phones: the whole job in this one cell, so the table never needs a sideways scroll. */}
                <span className="mt-3 flex flex-col gap-2 md:hidden">
                  {status(row)}
                  <span>{service(row, "")}</span>
                  {cleaner(row)}
                </span>
              </td>
              <td className={`${cell} hidden md:table-cell`}>{service(row, "lg:hidden")}</td>
              {showAgency ? <td className={`${cell} hidden text-ink lg:table-cell`}>{row.agencyName}</td> : null}
              <td className={`${cell} hidden lg:table-cell`}>{cleaner(row)}</td>
              <td className={`${cell} hidden md:table-cell`}>
                <span className="flex flex-col gap-1">
                  {status(row)}
                  <span className="lg:hidden">{cleaner(row)}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
