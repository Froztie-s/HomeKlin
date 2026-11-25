import { ArrowLeft, Check, Circle, Info, SearchX, ShieldCheck, VideoOff, type LucideIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Notice } from "@/components/admin/notice";
import { jakartaDayOf } from "@/components/customer/booking-query";
import { getSlotLabels } from "@/components/customer/slot-labels";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClientMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";
import { AgencyError, getMyAgency } from "@/lib/agency/agency";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import { splitDuration } from "@/lib/catalog/customer-duration";
import { formatRupiah } from "@/lib/format";
import { jobProgress, JobsError, listAgencyCleaners, listAgencyJobs, type AgencyCleaner, type AgencyJob } from "@/lib/jobs/jobs";
import { listLiveStreams, StreamError, type LiveStream } from "@/lib/stream/streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAgencyDate } from "./agency-views";
import { Initials, JobStatus, Panel } from "./agency-ui";
import { AssignCleaner } from "./assign-cleaner";
import { LiveStatus } from "./live-status";
import { SignedVideo } from "./live-tile";
import { NoAgency } from "./no-agency";
import { RecordingPill } from "./past-content";
import { Replay } from "./recordings-content";
import { backOfficeRecordingState } from "./recording-state";
import { jakartaDateOf } from "./schedule-time";
import { textLink } from "./styles";

type SearchParams = Record<string, string | string[] | undefined>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Which list the page was opened from: its back link and its place in the menu. */
export type DetailFrom = "incoming" | "past";

const backHref = { incoming: "/agency/orders", past: "/agency/past" } as const;

type Read = { job: AgencyJob | null; cleaners: AgencyCleaner[]; stream: LiveStream | null } | "noAgency";

// One job of the agency (D2, after the mocks Partner-Job and Partner-Job-Done): its order number, what,
// when and where, the agency's fee ("perkiraan" until check-out, B4) and the customer's note (B7), who
// cleans it (or the assign control while nobody has), how far it has got, and its live view while
// under way or its recording once finished. ?order=<id> names it; agency_jobs() lists this agency's
// jobs only, so another agency's id (or any unknown one) answers "not found" like an id that does not
// exist. The video link is made on the server only after the database said this agency may watch
// (SignedVideo, Replay). Everything is read with the agency's own session.
export async function JobDetail({ searchParams, from }: { searchParams: Promise<SearchParams>; from: DetailFrom }) {
  const [t, locale, params] = await Promise.all([getTranslations("AgencyJobPage"), getLocale(), searchParams]);
  const requested = typeof params.order === "string" && uuidPattern.test(params.order) ? params.order.toLowerCase() : null;

  const back = (
    <Link href={backHref[from]} className={`${textLink} self-start text-sm`}>
      <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
      {t(`back.${from}`)}
    </Link>
  );

  let data: Read;
  try {
    data = await readJob(requested);
  } catch (error) {
    // Only a failed read becomes a message; anything else (such as Next.js' own signals) goes on.
    if (!(error instanceof JobsError || error instanceof AgencyError)) throw error;
    console.error(error);
    return (
      <>
        {back}
        <PageHeader size="compact" title={t("title")} />
        <Notice tone="danger" title={t("errorTitle")}>
          {t("errorBody")}
        </Notice>
      </>
    );
  }
  if (data === "noAgency") {
    return (
      <>
        <PageHeader size="compact" title={t("title")} />
        <NoAgency title={t("noAgencyTitle")} body={t("noAgencyBody")} />
      </>
    );
  }
  const { job, stream } = data;
  if (!job) {
    return (
      <>
        {back}
        <PageHeader size="compact" title={t("title")} />
        <EmptyState tone="forest" icon={SearchX} title={t("notFoundTitle")}>
          {t("notFoundBody")}
        </EmptyState>
      </>
    );
  }

  const [services, areas, labels] = await Promise.all([getCatalogServices(), getServiceAreas(), getSlotLabels(locale)]);
  const service = services.find((candidate) => candidate.id === job.serviceId);
  const serviceName = service?.name[locale] ?? t("serviceFallback");
  const area = areas.find((candidate) => candidate.id === job.areaId)?.name[locale] ?? job.areaId;
  const progress = jobProgress(job, new Date());
  const date = formatAgencyDate(jakartaDateOf(job.startsAt), locale, "long");
  const window = labels.window(job);
  const when = t("whenValue", { date, window });
  const duration = service ? splitDuration(service.durationMinutes) : null;
  const choices = data.cleaners.map((cleaner) => ({ id: cleaner.id, fullName: cleaner.fullName }));

  const feeAmount = formatRupiah(job.agencyFeeIdr, locale);
  const facts: { term: string; value: string; wide?: boolean; muted?: boolean }[] = [
    { term: t("facts.service"), value: serviceName },
    { term: t("facts.when"), value: when },
    ...(duration ? [{ term: t("facts.duration"), value: t("durationValue", duration) }] : []),
    { term: t("facts.area"), value: area },
    { term: t("facts.address"), value: job.address },
    { term: t("facts.fee"), value: job.agencyFeeFinal ? feeAmount : t("feeEstimate", { fee: feeAmount }) },
    job.customerNote
      ? { term: t("facts.note"), value: job.customerNote, wide: true }
      : { term: t("facts.note"), value: t("noNote"), wide: true, muted: true },
  ];

  return (
    <ClientMessages namespaces={["AgencyLiveStream", "AgencyRecordingPlayer", "AgencyOrdersPage"]}>
      {back}
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-title font-semibold text-ink">{serviceName}</h1>
          <JobStatus progress={progress} label={t(`status.${progress}`)} />
        </div>
        <p className="text-sm text-ink-muted tabular-nums">{t("subtitleCode", { code: job.orderCode, when })}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_--spacing(75)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel id="facts-title" title={t("factsTitle")}>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {facts.map((fact) => (
                <div key={fact.term} className={`flex min-w-0 flex-col gap-0.5 ${fact.wide ? "sm:col-span-2" : ""}`}>
                  <dt className="text-xs font-medium text-ink-muted">{fact.term}</dt>
                  <dd className={`text-sm break-words whitespace-pre-line tabular-nums ${fact.muted ? "text-ink-muted" : "text-ink"}`}>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Video job={job} stream={stream} serviceName={serviceName} />
        </div>

        <aside aria-label={t("asideLabel")} className="flex min-w-0 flex-col gap-6">
          <Panel id="cleaner-title" title={t("cleanerTitle")}>
            {job.cleanerName ? (
              <div className="flex items-center gap-3">
                <Initials name={job.cleanerName} size="md" />
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold text-ink">{job.cleanerName}</span>
                  <span className="text-sm text-ink-muted">{t("ownCleaner")}</span>
                </span>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">{t("noCleaner")}</p>
            )}
            {/* Until check-in the agency may still choose or change the cleaner; the database checks it too. */}
            {!job.checkedInAt && !job.completedAt ? <AssignCleaner orderId={job.id} cleaners={choices} cleanerId={job.cleanerId} /> : null}
          </Panel>
          <Panel id="steps-title" title={t("stepsTitle")}>
            <ol className="flex flex-col gap-3.5">
              <Step
                done={job.cleanerName !== null}
                label={t("steps.assigned")}
                value={job.cleanerName ? (job.assignedAt ? labels.time(job.assignedAt) : t("steps.yes")) : t("steps.notYet")}
              />
              <Step done={job.checkedInAt !== null} label={t("steps.checkedIn")} value={job.checkedInAt ? labels.time(job.checkedInAt) : t("steps.notYet")} />
              <Step done={job.completedAt !== null} label={t("steps.completed")} value={job.completedAt ? labels.time(job.completedAt) : t("steps.notYet")} />
            </ol>
          </Panel>
        </aside>
      </div>
    </ClientMessages>
  );

  async function readJob(id: string | null): Promise<Read> {
    const client = await createSupabaseServerClient({ writeCookies: false });
    if (!(await getMyAgency(client))) return "noAgency";
    const [jobs, cleaners] = await Promise.all([listAgencyJobs(client), listAgencyCleaners(client)]);
    const found = id ? (jobs.find((candidate) => candidate.id === id) ?? null) : null;
    if (!found) return { job: null, cleaners, stream: null };
    const stream =
      found.checkedInAt && !found.completedAt
        ? await listLiveStreams(client)
            .then((streams) => streams.find((candidate) => candidate.orderId === found.id) ?? null)
            .catch((error: unknown) => {
              if (!(error instanceof StreamError)) throw error;
              console.error(error);
              return null;
            })
        : null;
    return { job: found, cleaners, stream };
  }
}

function Step({ done, label, value }: { done: boolean; label: string; value: string }) {
  const Icon: LucideIcon = done ? Check : Circle;
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <Icon className={`size-4.5 shrink-0 ${done ? "text-mint" : "text-border-control"}`} aria-hidden="true" />
      <span className={`flex-1 ${done ? "font-semibold text-ink" : "text-ink"}`}>{label}</span>
      <span className="text-xs text-ink-muted tabular-nums">{value}</span>
    </li>
  );
}

// The live view while the job is under way, or the recording once it is finished. Before check-in
// there is nothing to watch yet, and the panel says when there will be.
async function Video({ job, stream, serviceName }: { job: AgencyJob; stream: LiveStream | null; serviceName: string }) {
  const [t, locale] = await Promise.all([getTranslations("AgencyJobPage"), getLocale()]);
  const labels = await getSlotLabels(locale);
  const now = new Date();
  const cleaner = job.cleanerName ?? t("noCleaner");

  if (job.completedAt) {
    const state = backOfficeRecordingState(job, now.getTime());
    const day = labels.day({ date: jakartaDayOf(job.completedAt, now).date, relative: null });
    return (
      <Panel id="video-title" title={t("recordingTitle")} action={<RecordingPill job={job} now={now.getTime()} />}>
        {state === "available" && job.recordingId ? (
          <Suspense
            fallback={
              <div aria-busy="true" className="flex aspect-video w-full items-center justify-center rounded-md bg-frame">
                <span className="text-sm text-ink-muted">{t("loading")}</span>
              </div>
            }
          >
            <Replay recordingId={job.recordingId} label={t("recordingLabel", { service: serviceName, day })} labels={labels} now={now} />
          </Suspense>
        ) : (
          <Quiet icon={state === "expired" ? ShieldCheck : VideoOff} text={t(state === "expired" ? "recordingExpired" : "recordingNone")} />
        )}
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("recordingKept")}
        </p>
      </Panel>
    );
  }

  if (job.checkedInAt && stream) {
    return (
      <Panel id="video-title" title={t("liveTitle")} action={<LiveStatus orderId={job.id} initial={stream.status} />}>
        <Suspense
          fallback={
            <div aria-busy="true" className="flex aspect-video w-full items-center justify-center rounded-md bg-frame">
              <span className="text-sm text-ink-muted">{t("loading")}</span>
            </div>
          }
        >
          <SignedVideo orderId={job.id} label={t("liveLabel", { name: cleaner })} />
        </Suspense>
        <p className="text-sm text-ink tabular-nums">{t("liveSince", { time: labels.time(job.checkedInAt) })}</p>
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("recordingAfter")}
        </p>
      </Panel>
    );
  }

  return (
    <Panel id="video-title" title={t("liveTitle")}>
      <Quiet icon={VideoOff} text={t(job.checkedInAt ? "liveNone" : "liveLater")} />
    </Panel>
  );
}

function Quiet({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-sunken px-4 py-3 text-sm text-ink">
      <Icon className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}
