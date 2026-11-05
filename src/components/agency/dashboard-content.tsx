import { CalendarClock, CalendarDays, ClipboardList, MapPin, UserRoundX, Video } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Notice } from "@/components/admin/notice";
import { SummaryTile } from "@/components/back-office/summary-tile";
import { jakartaDayOf } from "@/components/customer/booking-query";
import { getSlotLabels } from "@/components/customer/slot-labels";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { AgencyError, getMyAgency, type MyAgency } from "@/lib/agency/agency";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import { JobsError, listAgencyJobs, type AgencyJob } from "@/lib/jobs/jobs";
import { listLiveStreams, StreamError } from "@/lib/stream/streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { summarizeAgencyJobs } from "./dashboard-summary";
import { NoAgency } from "./no-agency";

const shownWaiting = 5;

// The agency's dashboard (T28): three numbers that lead to where the work is (jobs waiting for a cleaner,
// today's jobs, live streams now), then the next jobs that still need a cleaner. Read with the agency's
// own session; the live count is shown as unknown, not as 0, when it could not be read.
export async function DashboardContent() {
  const [t, locale] = await Promise.all([getTranslations("AgencyDashboardPage"), getLocale()]);

  let agency: MyAgency | null = null;
  let jobs: AgencyJob[] = [];
  let live: number | null = null;
  let failed = false;
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    agency = await getMyAgency(client);
    if (agency) {
      jobs = await listAgencyJobs(client);
      try {
        live = (await listLiveStreams(client)).length;
      } catch (error) {
        if (!(error instanceof StreamError)) throw error;
        console.error(error);
      }
    }
  } catch (error) {
    if (!(error instanceof AgencyError || error instanceof JobsError)) throw error;
    console.error(error);
    failed = true;
  }
  if (failed) {
    return (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }
  if (!agency) return <NoAgency title={t("noAgencyTitle")} body={t("noAgencyBody")} />;

  const now = new Date();
  const summary = summarizeAgencyJobs(jobs, now);
  const [services, areas, labels, tJobs] = await Promise.all([
    getCatalogServices(),
    getServiceAreas(),
    getSlotLabels(locale),
    getTranslations("BackOfficeJobs"),
  ]);
  const waiting = summary.waiting.slice(0, shownWaiting);

  return (
    <>
      <p className="text-sm font-medium text-ink-muted">{t("agency", { name: agency.name })}</p>
      <ul aria-label={t("stats.label")} className="grid gap-4 md:grid-cols-3 [&>li]:grid">
        <li>
          <SummaryTile
            id="waiting"
            label={t("stats.waiting")}
            value={summary.waiting.length}
            hint={t("stats.waitingBody")}
            href="/agency/orders"
            icon={UserRoundX}
            tone={summary.waiting.length > 0 ? "attention" : "default"}
          />
        </li>
        <li>
          <SummaryTile id="today" label={t("stats.today")} value={summary.today.length} hint={t("stats.todayBody")} href="/agency/orders" icon={CalendarClock} />
        </li>
        <li>
          <SummaryTile
            id="live"
            label={t("stats.live")}
            value={live}
            hint={live === null ? t("stats.liveUnknown") : t("stats.liveBody")}
            href="/agency/recordings"
            icon={Video}
          />
        </li>
      </ul>

      <section aria-labelledby="waiting-title" className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 id="waiting-title" className="font-display text-lg font-semibold text-ink">
            {t("waitingTitle")}
          </h2>
          <p className="max-w-prose text-sm text-ink-muted">{t("waitingDescription")}</p>
        </header>
        {waiting.length === 0 ? (
          <EmptyState icon={ClipboardList} title={t("waitingEmptyTitle")}>
            {t("waitingEmptyBody")}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {waiting.map((job) => (
              <li key={job.id} className="grid gap-1 px-4 py-3 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_minmax(0,12rem)] md:items-center md:gap-6 md:px-5">
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {tJobs("windowValue", { day: labels.day(jakartaDayOf(job.startsAt, now)), window: labels.window(job) })}
                </span>
                <span className="text-sm text-ink">{services.find((service) => service.id === job.serviceId)?.name[locale] ?? job.serviceId}</span>
                <span className="flex items-center gap-1.5 text-sm text-ink-muted">
                  <MapPin className="size-4 shrink-0" aria-hidden="true" />
                  {areas.find((area) => area.id === job.areaId)?.name[locale] ?? job.areaId}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {summary.waiting.length > shownWaiting ? (
            <span className="text-sm text-ink-muted">{t("waitingMore", { count: summary.waiting.length - shownWaiting })}</span>
          ) : null}
          <ButtonLink href="/agency/orders" icon={ClipboardList}>
            {t("toOrders")}
          </ButtonLink>
          <ButtonLink href="/agency/schedule" variant="secondary" icon={CalendarDays}>
            {t("toSchedule")}
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
