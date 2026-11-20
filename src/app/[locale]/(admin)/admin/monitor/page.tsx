import type { Metadata } from "next";
import { ChevronRight, ClockAlert, MonitorPlay, RefreshCw, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { cache, Suspense } from "react";
import { Notice } from "@/components/admin/notice";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import {
  filterMonitor,
  monitorCounts,
  parseMonitorFilters,
  waitingForCheckIn,
  type MonitorFilters,
  liveStreamsOnly,
  overdueJobs,
} from "@/components/back-office/admin-console";
import { CheckInTile, FeedTile } from "@/components/back-office/feed-tile";
import { MonitorFiltersForm } from "@/components/back-office/monitor-filters";
import { jakartaDayOf } from "@/components/customer/booking-query";
import { getSlotLabels } from "@/components/customer/slot-labels";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClientMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import { JobsError, listAdminJobs, type AdminJob } from "@/lib/jobs/jobs";
import { listLiveStreams, StreamError, type LiveStream } from "@/lib/stream/streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminMonitorPage");
  return { title: t("title") };
}

// Admins only (T5). The live monitor (T25; M1 after the user's mock "Admin-Live"): one grid of cards,
// as many columns of at least 300 px as fit (one on a phone). Each live stream is a card with its
// video; each of today's jobs whose cleaner has not checked in yet is a card too ("Belum check-in",
// H1). The summary line under the title counts them as the page read them. live_streams() and
// admin_jobs() answer admins (live_streams() also agencies, their own); this page's own role check
// keeps everyone else out, and each video link is made for this admin by stream_for_viewer()
// (src/components/back-office/feed-tile.tsx). The list is read when the page opens; "Perbarui daftar"
// reads it again, while each live card keeps its status current on its own.
// The filters (M2): "Semua / Terkendala" and the service area, as ?view= and ?area= in the address,
// so they work without JavaScript; the summary line counts what the filters leave.
// The title is prerendered; the summary, the filters, the refresh link and the cards render inside
// role checks (a layout's check would not protect them).
export default function AdminMonitorPage({ searchParams }: PageProps<"/[locale]/admin/monitor">) {
  const t = useTranslations("AdminMonitorPage");
  return (
    <>
      <PageHeader
        size="compact"
        title={t("title")}
        description={
          <Suspense fallback={null}>
            <RoleGate roles={["admin"]}>
              <MonitorSummary searchParams={searchParams} />
            </RoleGate>
          </Suspense>
        }
        action={
          <Suspense fallback={<GateFallback variant="action" />}>
            <RoleGate roles={["admin"]}>
              <MonitorActions searchParams={searchParams} />
            </RoleGate>
          </Suspense>
        }
      />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["admin"]}>
          <MonitorCards searchParams={searchParams} />
        </RoleGate>
      </Suspense>
    </>
  );
}

type SearchParams = PageProps<"/[locale]/admin/monitor">["searchParams"];

type MonitorData = {
  /** null when the streams could not be read. */
  streams: LiveStream[] | null;
  /** Today's jobs not checked in yet; null when the jobs could not be read. */
  waiting: AdminJob[] | null;
  /** Jobs checked in to but never checked out, hours past their window (overdueJobs); [] when unread. */
  overdue: AdminJob[];
};

// Both lists at once, read once per request: the summary and the cards share the result.
const readMonitor = cache(async (): Promise<MonitorData> => {
  const client = await createSupabaseServerClient({ writeCookies: false });
  const [streams, jobs] = await Promise.allSettled([listLiveStreams(client), listAdminJobs(client)]);
  // Only a failed read becomes a message; anything else (such as Next.js' own signals) goes on.
  for (const result of [streams, jobs]) {
    if (result.status === "rejected" && !(result.reason instanceof StreamError || result.reason instanceof JobsError)) throw result.reason;
    if (result.status === "rejected") console.error("[monitor] could not read the list:", result.reason);
  }
  const now = new Date();
  const overdue = jobs.status === "fulfilled" ? overdueJobs(jobs.value, now) : [];
  return {
    // A stream whose job is overdue for check-out is not live any more (2026-11-20).
    streams: streams.status === "fulfilled" ? liveStreamsOnly(streams.value, overdue) : null,
    waiting: jobs.status === "fulfilled" ? waitingForCheckIn(jobs.value, now) : null,
    overdue,
  };
});

/** The served areas (the filter's options) and the filters the address asks for. */
async function readFilters(searchParams: SearchParams): Promise<{ filters: MonitorFilters; areas: { id: string; name: string }[] }> {
  const [params, locale, all] = await Promise.all([searchParams, getLocale(), getServiceAreas()]);
  const areas = all.filter((area) => area.isServed).map((area) => ({ id: area.id, name: area.name[locale] }));
  return { filters: parseMonitorFilters(params, areas.map((area) => area.id)), areas };
}

/** The cards the filters leave: the streams and today's jobs not checked in yet. */
async function shownCards(searchParams: SearchParams) {
  const [{ streams, waiting, overdue }, { filters }] = await Promise.all([readMonitor(), readFilters(searchParams)]);
  const shown = filterMonitor({ streams: streams ?? [], waiting: waiting ?? [] }, filters);
  const area = filters.area;
  return { streams, waiting, filters, shown, overdue: area ? overdue.filter((job) => job.areaId === area) : overdue };
}

/** "6 pekerjaan sedang berlangsung. 2 terkendala." and, when there are any, "1 belum check-in." */
async function MonitorSummary({ searchParams }: { searchParams: SearchParams }) {
  const [t, { streams, shown, overdue }] = await Promise.all([getTranslations("AdminMonitorPage"), shownCards(searchParams)]);
  if (!streams) return null;
  const counts = monitorCounts(shown.streams, shown.waiting.length);
  return (
    <span data-testid="monitor-summary">
      {t("summary", counts)}
      {counts.waiting > 0 ? ` ${t("summaryWaiting", counts)}` : null}
      {overdue.length > 0 ? ` ${t("summaryOverdue", { count: overdue.length })}` : null}
    </span>
  );
}

/** The filters and the refresh link, right of the title from 640 px, under it on a phone. */
async function MonitorActions({ searchParams }: { searchParams: SearchParams }) {
  const { filters, areas } = await readFilters(searchParams);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <MonitorFiltersForm filters={filters} areas={areas} />
      <RefreshLink />
    </div>
  );
}

// A plain link on purpose: a full page load reads the list again (with the same filters, an empty
// href keeps the address) and makes fresh video links.
async function RefreshLink() {
  const t = await getTranslations("AdminMonitorPage");
  return (
    <a
      href=""
      className="inline-flex min-h-touch items-center gap-2 rounded-full border border-border-control bg-card px-4 text-sm font-semibold text-ink transition-colors duration-150 ease-out-quart hover:bg-sunken active:bg-lime-wash"
    >
      <RefreshCw className="size-4 shrink-0" aria-hidden="true" />
      {t("refresh")}
    </a>
  );
}

async function MonitorCards({ searchParams }: { searchParams: SearchParams }) {
  const [t, locale, { streams, waiting, shown, overdue }] = await Promise.all([
    getTranslations("AdminMonitorPage"),
    getLocale(),
    shownCards(searchParams),
  ]);

  const notices = (
    <>
      {streams ? null : (
        <Notice tone="danger" title={t("errorTitle")}>
          {t("errorBody")}
        </Notice>
      )}
      {waiting ? null : (
        <Notice tone="info" title={t("jobsErrorTitle")}>
          {t("jobsErrorBody")}
        </Notice>
      )}
    </>
  );

  const live = shown.streams;
  const late = shown.waiting;
  const anything = (streams?.length ?? 0) + (waiting?.length ?? 0) > 0;
  if (anything && live.length === 0 && late.length === 0) {
    // There are jobs, but none the filters leave: say so plainly and offer the way back.
    return (
      <>
        {notices}
        <EmptyState tone="forest" icon={SearchX} title={t("filteredEmptyTitle")}>
          {t("filteredEmptyBody")}{" "}
          <Link href="/admin/monitor" className="font-semibold text-primary underline underline-offset-4 hover:decoration-2">
            {t("filters.showAll")}
          </Link>
        </EmptyState>
        <OverdueList jobs={overdue} />
      </>
    );
  }
  if (live.length === 0 && late.length === 0) {
    return (
      <>
        {notices}
        {/* The wording is about jobs in progress, which holds even when the waiting list failed. */}
        {streams ? (
          <EmptyState tone="forest" icon={MonitorPlay} title={t("emptyTitle")}>
            {t("emptyBody")}
          </EmptyState>
        ) : null}
        <OverdueList jobs={overdue} />
      </>
    );
  }

  const [services, areas, labels] = await Promise.all([getCatalogServices(), getServiceAreas(), getSlotLabels(locale)]);
  const names = (job: { serviceId: string; areaId: string }) => ({
    serviceName: services.find((service) => service.id === job.serviceId)?.name[locale],
    areaName: areas.find((area) => area.id === job.areaId)?.name[locale],
  });

  return (
    <ClientMessages namespaces={["AdminMonitorPage"]}>
      {notices}
      <ul aria-label={t("gridLabel")} className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(75)),1fr))] gap-5">
        {live.map((stream) => (
          <FeedTile key={stream.sessionId} stream={stream} {...names(stream)} />
        ))}
        {late.map((job) => (
          <CheckInTile key={job.id} job={job} startsAt={labels.time(job.startsAt)} {...names(job)} />
        ))}
      </ul>
      <OverdueList jobs={overdue} />
    </ClientMessages>
  );
}

/**
 * "Belum check-out" (2026-11-20): jobs checked in to but never checked out, hours past their window,
 * as links to their order pages, where admin can call the cleaner.
 */
async function OverdueList({ jobs }: { jobs: AdminJob[] }) {
  if (jobs.length === 0) return null;
  const [t, locale] = await Promise.all([getTranslations("AdminMonitorPage"), getLocale()]);
  const labels = await getSlotLabels(locale);
  const now = new Date();
  return (
    <section aria-labelledby="monitor-overdue" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="monitor-overdue" className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
          <ClockAlert className="size-5 shrink-0 text-warning" aria-hidden="true" />
          {t("overdue.title", { count: jobs.length })}
        </h2>
        <p className="text-sm text-ink-muted">{t("overdue.body")}</p>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg bg-card">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link
              href={`/admin/orders/${job.orderCode}`}
              className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 ease-out-quart hover:bg-sunken/60 md:px-5"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                <span className="font-semibold text-ink">
                  {job.orderCode} · {job.cleanerName ?? t("cleanerFallback")}
                </span>
                <span className="text-ink-muted">
                  {t("overdue.ended", { day: labels.day(jakartaDayOf(job.endsAt, now)), time: labels.time(job.endsAt) })} · {job.agencyName}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-ink-muted transition-transform duration-150 ease-out-quart group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
