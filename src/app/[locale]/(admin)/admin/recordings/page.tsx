import type { Metadata } from "next";
import { CalendarClock, CircleAlert, CirclePlay, SearchX, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { Notice } from "@/components/admin/notice";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { adminRecordingState, parseRecordingParam, pastJobs } from "@/components/back-office/admin-console";
import { getAdminJobs } from "@/components/back-office/admin-data";
import { AdminRecordingPlayer } from "@/components/back-office/admin-recording-player";
import { RecordingsTable, type RecordingRow } from "@/components/back-office/recordings-table";
import { jakartaDayOf } from "@/components/customer/booking-query";
import { getSlotLabels, type SlotLabels } from "@/components/customer/slot-labels";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClientMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import { JobsError, type AdminJob } from "@/lib/jobs/jobs";
import { recordingLink, RecordingLinkError, type RecordingLink } from "@/lib/recordings/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminRecordingsPage");
  return { title: t("title") };
}

type SearchParams = PageProps<"/[locale]/admin/recordings">["searchParams"];

// Admins only (T5). Recording replay (T26): the jobs finished in the last 30 days with their
// recording's state (available until when, deleted after its 7 days, none). "Putar" opens
// ?recording=<id>, which plays it above the list. The link to the private file is made here on the
// server: admin's own session asks the database first (recordingLink, src/lib/recordings/link.ts),
// and an expired or deleted recording gets the deleted message and no player. The title is
// prerendered; the rest renders inside the page's own role check (a layout's check would not protect it).
export default function AdminRecordingsPage({ searchParams }: PageProps<"/[locale]/admin/recordings">) {
  const t = useTranslations("AdminRecordingsPage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["admin"]}>
          <RecordingsContent searchParams={searchParams} />
        </RoleGate>
      </Suspense>
    </>
  );
}

async function RecordingsContent({ searchParams }: { searchParams: SearchParams }) {
  const [t, locale, params] = await Promise.all([getTranslations("AdminRecordingsPage"), getLocale(), searchParams]);
  const selected = parseRecordingParam(params.recording);

  let jobs: AdminJob[];
  try {
    jobs = await getAdminJobs();
  } catch (error) {
    if (!(error instanceof JobsError)) throw error;
    console.error(error);
    return (
      <Notice tone="danger" title={t("listErrorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }

  const now = new Date();
  const [services, areas, labels] = await Promise.all([getCatalogServices(), getServiceAreas(), getSlotLabels(locale)]);
  const rows: RecordingRow[] = pastJobs(jobs, now).map((job) => ({
    ...job,
    serviceName: services.find((service) => service.id === job.serviceId)?.name[locale],
    areaName: areas.find((area) => area.id === job.areaId)?.name[locale],
    state: adminRecordingState(job, now),
  }));
  // Looked up in every paid job, not only the listed ones, so an old link still says what happened.
  const chosen = selected ? jobs.find((job) => job.recordingId === selected) : undefined;
  const chosenRow = chosen ? { ...chosen, serviceName: services.find((s) => s.id === chosen.serviceId)?.name[locale] } : undefined;

  return (
    <>
      {selected ? <PlayerPanel recordingId={selected} job={chosenRow} labels={labels} now={now} /> : null}
      {rows.length === 0 ? (
        <EmptyState icon={CirclePlay} title={t("emptyTitle")}>
          {t("emptyBody")}
        </EmptyState>
      ) : (
        <section aria-label={t("tableCaption")} className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">{t("summary", { count: rows.length })}</p>
          <RecordingsTable rows={rows} playing={chosen && adminRecordingState(chosen, now) === "available" ? selected : null} labels={labels} now={now} />
        </section>
      )}
    </>
  );
}

type PlayerPanelProps = {
  recordingId: string;
  /** The job the recording belongs to; undefined when no paid job has it (a wrong or removed id). */
  job: (AdminJob & { serviceName: string | undefined }) | undefined;
  labels: SlotLabels;
  now: Date;
};

// The recording chosen with ?recording=: the player (or why there is none) beside the job's facts.
async function PlayerPanel({ recordingId, job, labels, now }: PlayerPanelProps) {
  const t = await getTranslations("AdminRecordingsPage");
  const day = (iso: string) => labels.day({ date: jakartaDayOf(iso, now).date, relative: null });
  const state = job ? adminRecordingState(job, now) : null;
  const service = job?.serviceName ?? t("serviceFallback");
  const cleaner = job?.cleanerName ?? t("noCleaner");

  let player: ReactNode;
  if (!job || state === "none") {
    player = <PanelNotice icon={SearchX} title={t("noneTitle")} body={t("noneBody")} />;
  } else if (state === "expired") {
    player = <ExpiredNotice />;
  } else {
    player = (
      <Suspense fallback={<PlayerLoading />}>
        <SignedPlayer recordingId={recordingId} label={t("playerLabel", { service, cleaner })} labels={labels} now={now} />
      </Suspense>
    );
  }

  const finishedAt = job?.completedAt ?? null;

  return (
    <section aria-labelledby="player-title" className="rounded-xl border border-border bg-surface p-4 shadow-card md:p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 id="player-title" className="font-display text-lg font-semibold text-ink">
          {t("playerTitle")}
        </h2>
        <Link
          href="/admin/recordings"
          className="-mt-2 -mr-2 inline-flex min-h-touch shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-surface-sunken hover:text-ink active:bg-brand-50"
        >
          <X className="size-4 shrink-0" aria-hidden="true" />
          {t("close")}
        </Link>
      </div>
      <div className="mt-3 grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">{player}</div>
        {job ? (
          <dl className="grid content-start gap-3 text-sm lg:col-span-2">
            <Fact term={t("table.service")}>{service}</Fact>
            <Fact term={t("table.agency")}>{job.agencyName}</Fact>
            <Fact term={t("table.cleaner")}>{cleaner}</Fact>
            {finishedAt ? <Fact term={t("table.finished")}>{t("finishedAt", { day: day(finishedAt), time: labels.time(finishedAt) })}</Fact> : null}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-ink-muted">{term}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

async function SignedPlayer({ recordingId, label, labels, now }: { recordingId: string; label: string; labels: SlotLabels; now: Date }) {
  let link: RecordingLink;
  try {
    const viewer = await createSupabaseServerClient({ writeCookies: false });
    link = await recordingLink(viewer, createSupabaseServiceClient(), recordingId);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof RecordingLinkError && error.reason === "recording_expired") return <ExpiredNotice />;
    const t = await getTranslations("AdminRecordingsPage");
    if (error instanceof RecordingLinkError && error.reason === "recording_not_found") {
      return <PanelNotice icon={SearchX} title={t("noneTitle")} body={t("noneBody")} />;
    }
    console.error("[recordings] could not make the replay link:", error);
    return (
      <PanelNotice icon={CircleAlert} title={t("unavailableTitle")}>
        {/* A plain link on purpose: a full page load makes the link again. */}
        <a
          href=""
          className="mt-2 inline-flex min-h-touch items-center justify-center rounded-full border border-border-control bg-surface px-5 text-sm font-semibold text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50"
        >
          {t("retryPage")}
        </a>
      </PanelNotice>
    );
  }

  const t = await getTranslations("AdminRecordingsPage");
  const until = link.availableUntil;
  const day = labels.day({ date: jakartaDayOf(until, now).date, relative: null });
  return (
    <div className="flex flex-col gap-3">
      <ClientMessages namespaces={["AdminRecordingsPage"]}>
        <AdminRecordingPlayer recordingId={recordingId} src={link.url} label={label} />
      </ClientMessages>
      <p className="flex items-start gap-2 text-sm text-ink">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
        <span>{t("availableUntil", { day, time: labels.time(until) })}</span>
      </p>
      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
        <span>{t("privacy")}</span>
      </p>
    </div>
  );
}

function PanelNotice({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-surface-sunken px-4 py-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <p className="font-semibold text-ink">{title}</p>
        {body ? <p className="text-ink-muted">{body}</p> : null}
        {children}
      </div>
    </div>
  );
}

async function ExpiredNotice() {
  const t = await getTranslations("AdminRecordingsPage");
  return <PanelNotice icon={ShieldCheck} title={t("expiredTitle")} body={t("expiredBody")} />;
}

async function PlayerLoading() {
  const t = await getTranslations("AdminRecordingsPage");
  return (
    <div role="status" className="flex aspect-video w-full items-center justify-center rounded-md bg-surface-sunken">
      <span className="text-sm text-ink-muted">{t("loading")}</span>
    </div>
  );
}
