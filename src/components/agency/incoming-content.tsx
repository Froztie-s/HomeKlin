import { ClipboardList, SearchX } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Notice } from "@/components/admin/notice";
import { jakartaDayOf } from "@/components/customer/booking-query";
import { getSlotLabels } from "@/components/customer/slot-labels";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";
import { AgencyError, getMyAgency } from "@/lib/agency/agency";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import { formatRupiah } from "@/lib/format";
import { jobProgress, JobsError, listAgencyCleaners, listAgencyJobs, type AgencyCleaner, type AgencyJob } from "@/lib/jobs/jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { incomingCounts, incomingJobs, matchesSearch, parseIncomingStatus, parseSearch, type IncomingStatus } from "./agency-views";
import { CountTile, DetailArrow, FilterLinks, Initials, JobStatus, SearchField } from "./agency-ui";
import { AssignCell } from "./assign-cell";
import { NoAgency } from "./no-agency";
import { panel } from "./styles";

type SearchParams = Record<string, string | string[] | undefined>;

const cell = "px-4 py-3 align-middle";
const headCell = "px-4 py-3 text-left text-xs font-semibold text-ink-muted";

type Read = { jobs: AgencyJob[]; cleaners: AgencyCleaner[] } | null;

// "Pekerjaan masuk" (D2, after the mock Partner-Jobs; T18, T28): the paid jobs HomeKlin routed to this
// agency that are not finished yet, earliest first, with four counts above (waiting for a cleaner,
// assigned, under way, finished this week), a status filter (?status=) and a search (?q=, also by order
// number) that work as plain addresses, the agency's fee for each job ("perkiraan" until check-out
// records the real one, B4), and for every job nobody has checked in to yet the control that assigns
// one of the agency's own cleaners. Everything is read with the agency's own session: agency_jobs()
// and agency_cleaners() answer with this agency's rows only.
export async function IncomingContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [t, locale, params] = await Promise.all([getTranslations("AgencyOrdersPage"), getLocale(), searchParams]);
  const status = parseIncomingStatus(params.status);
  const query = parseSearch(params.q);

  let data: Read;
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    if (!(await getMyAgency(client))) data = null;
    else {
      const [jobs, cleaners] = await Promise.all([listAgencyJobs(client), listAgencyCleaners(client)]);
      data = { jobs, cleaners };
    }
  } catch (error) {
    // Only a failed read becomes a message; anything else (such as Next.js' own signals) goes on.
    if (!(error instanceof JobsError || error instanceof AgencyError)) throw error;
    console.error(error);
    return (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }
  if (!data) return <NoAgency title={t("noAgencyTitle")} body={t("noAgencyBody")} />;

  const now = new Date();
  const counts = incomingCounts(data.jobs, now);
  const [services, areas, labels] = await Promise.all([getCatalogServices(), getServiceAreas(), getSlotLabels(locale)]);
  const serviceName = (id: string) => services.find((service) => service.id === id)?.name[locale];
  const areaName = (id: string) => areas.find((area) => area.id === id)?.name[locale] ?? id;
  const fee = (job: AgencyJob) =>
    job.agencyFeeFinal ? formatRupiah(job.agencyFeeIdr, locale) : t("feeEstimate", { fee: formatRupiah(job.agencyFeeIdr, locale) });

  const open = incomingJobs(data.jobs, status, now);
  const rows = open.filter((job) =>
    matchesSearch([serviceName(job.serviceId), areaName(job.areaId), job.address, job.cleanerName, job.orderCode], query),
  );
  const choices = data.cleaners.map((cleaner) => ({ id: cleaner.id, fullName: cleaner.fullName }));

  const filterHref = (next: IncomingStatus | null) => ({
    pathname: "/agency/orders",
    query: { ...(next ? { status: next } : {}), ...(query ? { q: query } : {}) },
  });
  const filters = ([null, "unassigned", "assigned", "inProgress"] as const).map((key) => ({
    key: key ?? "all",
    label: t(`filter.${key ?? "all"}`),
    href: filterHref(key),
    current: key === status,
  }));

  return (
    <ClientMessages namespaces={["AgencyOrdersPage"]}>
      <ul aria-label={t("countsLabel")} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Each tile filters the list below, as its tab does (UX audit item 14). */}
        <CountTile value={counts.unassigned} label={t("counts.unassigned")} href={filterHref("unassigned")} current={status === "unassigned"} />
        <CountTile value={counts.assigned} label={t("counts.assigned")} href={filterHref("assigned")} current={status === "assigned"} />
        <CountTile value={counts.inProgress} label={t("counts.inProgress")} href={filterHref("inProgress")} current={status === "inProgress"} />
        <CountTile value={counts.completedThisWeek} label={t("counts.completedThisWeek")} dark />
      </ul>

      <section aria-labelledby="incoming-title" className={`${panel} flex min-w-0 flex-col overflow-hidden`}>
        <h2 id="incoming-title" className="sr-only">
          {t("listTitle")}
        </h2>
        <div className="flex flex-col gap-4 px-5 pt-5 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <FilterLinks label={t("filterLabel")} options={filters} />
          <SearchField
            id="incoming-search"
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            submit={t("searchSubmit")}
            value={query}
            keep={status ? { status } : {}}
          />
        </div>
        <p className="px-5 pb-3 text-sm text-ink-muted" aria-live="polite">
          {query ? t("countSearch", { count: rows.length, query }) : t("count", { count: rows.length })}
        </p>
        {rows.length === 0 ? (
          <div className="px-5 pb-5">
            {query ? (
              <EmptyState tone="forest" icon={SearchX} title={t("searchEmptyTitle")}>
                {t("searchEmptyBody")}
              </EmptyState>
            ) : (
              <EmptyState tone="forest" icon={ClipboardList} title={t(status ? "filterEmptyTitle" : "emptyTitle")}>
                {t(status ? "filterEmptyBody" : "emptyBody")}
              </EmptyState>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t("caption")}</caption>
            <thead className="hidden bg-sunken md:table-header-group">
              <tr>
                <th scope="col" className={headCell}>
                  {t("table.order")}
                </th>
                <th scope="col" className={headCell}>
                  {t("table.when")}
                </th>
                <th scope="col" className={headCell}>
                  {t("table.status")}
                </th>
                <th scope="col" className={`${headCell} hidden lg:table-cell`}>
                  {t("table.cleaner")}
                </th>
                <th scope="col" className={`${headCell} hidden text-right md:table-cell`}>
                  {t("table.fee")}
                </th>
                <th scope="col" className={headCell}>
                  <span className="sr-only">{t("table.detail")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((job) => {
                const progress = jobProgress(job, now);
                const service = serviceName(job.serviceId) ?? t("serviceFallback");
                const detail = { pathname: "/agency/orders/job", query: { order: job.id } };
                const where = `${job.orderCode}, ${areaName(job.areaId)}`;
                const day = labels.day({ date: jakartaDayOf(job.startsAt, now).date, relative: jakartaDayOf(job.startsAt, now).relative });
                const cleaner = (
                  <CleanerCell
                    job={job}
                    choices={choices}
                    canAssign={!job.checkedInAt}
                  />
                );
                return (
                  <tr key={job.id} data-job={job.id} className="border-t border-border align-top transition-colors duration-150 ease-out-quart hover:bg-field">
                    <td className={cell}>
                      <Link href={detail} className="font-semibold text-ink underline decoration-border-control underline-offset-4 transition-colors duration-150 ease-out-quart hover:decoration-primary active:text-band">
                        {service}
                      </Link>
                      <span className="mt-0.5 block text-xs text-ink-muted">{where}</span>
                      <span className="mt-0.5 block text-xs text-ink-muted">{job.address}</span>
                      {/* Phones and tablets: the rest of the job under its name, so nothing scrolls sideways. */}
                      <span className="mt-3 flex flex-col items-start gap-2 md:hidden">
                        <span className="text-ink tabular-nums">{t("whenValue", { day, window: labels.window(job) })}</span>
                        <JobStatus progress={progress} label={t(`status.${progress}`)} />
                        {cleaner}
                        <span className="text-ink tabular-nums">{t("feeValue", { fee: fee(job) })}</span>
                      </span>
                    </td>
                    <td className={`${cell} hidden whitespace-nowrap text-ink tabular-nums md:table-cell`}>
                      <span className="block">{day}</span>
                      <span className="block text-xs text-ink-muted">{t("windowValue", { window: labels.window(job) })}</span>
                    </td>
                    <td className={`${cell} hidden md:table-cell`}>
                      <span className="flex flex-col items-start gap-2">
                        <JobStatus progress={progress} label={t(`status.${progress}`)} />
                        <span className="lg:hidden">{cleaner}</span>
                      </span>
                    </td>
                    <td className={`${cell} hidden min-w-64 lg:table-cell`}>{cleaner}</td>
                    <td className={`${cell} hidden text-right whitespace-nowrap text-ink tabular-nums md:table-cell`}>
                      {formatRupiah(job.agencyFeeIdr, locale)}
                      {job.agencyFeeFinal ? null : <span className="block text-xs text-ink-muted">{t("estimate")}</span>}
                    </td>
                    <td className={`${cell} w-14 text-right`}>
                      <DetailArrow href={detail} label={t("detailFor", { service, day })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </ClientMessages>
  );
}

// Not started: the assign control, or the cleaner with "Ganti" (AssignCell). Under way: the cleaner
// only, as nobody can be reassigned after check-in (the database refuses it too).
function CleanerCell({ job, choices, canAssign }: { job: AgencyJob; choices: { id: string; fullName: string }[]; canAssign: boolean }) {
  if (canAssign) return <AssignCell orderId={job.id} cleaners={choices} cleanerId={job.cleanerId} cleanerName={job.cleanerName} />;
  if (!job.cleanerName) return null;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Initials name={job.cleanerName} />
      <span className="min-w-0 text-ink">{job.cleanerName}</span>
    </span>
  );
}
