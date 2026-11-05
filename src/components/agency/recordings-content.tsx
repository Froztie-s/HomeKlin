import { CalendarClock, CircleAlert, CirclePlay, ShieldCheck, Video, VideoOff, X, type LucideIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { Notice } from "@/components/admin/notice";
import { jakartaDayOf } from "@/components/customer/booking-query";
import { getSlotLabels, type SlotLabels } from "@/components/customer/slot-labels";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import { JobsError, listAgencyJobs, type AgencyJob } from "@/lib/jobs/jobs";
import { recordingLink, RecordingLinkError, type RecordingLink } from "@/lib/recordings/link";
import { listLiveStreams, StreamError, type LiveStream } from "@/lib/stream/streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { AgencyRecordingPlayer } from "./agency-recording-player";
import { LiveTile } from "./live-tile";
import { backOfficeRecordingState, type BackOfficeRecordingState } from "./recording-state";
import { secondaryButton } from "./styles";

type SearchParams = Record<string, string | string[] | undefined>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cell = "px-4 py-3 align-top";
const headCell = "px-4 py-3 text-left text-xs font-semibold text-ink-muted";

const stateIcons: Record<BackOfficeRecordingState, { Icon: LucideIcon; tone: string }> = {
  available: { Icon: CalendarClock, tone: "text-ink" },
  expired: { Icon: ShieldCheck, tone: "text-ink-muted" },
  none: { Icon: VideoOff, tone: "text-ink-muted" },
};

// "Rekaman" (T29): the live streams of the agency's own cleaners (tiles, status polled every 10 s), and
// its finished jobs with their recordings: kept until when (with "Putar"), deleted after 7 days, or none.
// ?recording=<id> opens the player above the list; its link is made here on the server only after the
// database said this agency may see that recording (recordingLink), so another agency's id answers
// "not found" like an id that does not exist. Everything is read with the agency's own session.
export async function RecordingsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [t, locale, params] = await Promise.all([getTranslations("AgencyRecordingsPage"), getLocale(), searchParams]);

  let streams: LiveStream[];
  let jobs: AgencyJob[];
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    [streams, jobs] = await Promise.all([listLiveStreams(client), listAgencyJobs(client)]);
  } catch (error) {
    if (!(error instanceof StreamError || error instanceof JobsError)) throw error;
    console.error(error);
    return (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }

  const [services, areas, labels] = await Promise.all([getCatalogServices(), getServiceAreas(), getSlotLabels(locale)]);
  const serviceName = (id: string) => services.find((service) => service.id === id)?.name[locale];
  const areaName = (id: string) => areas.find((area) => area.id === id)?.name[locale];
  const now = new Date();
  const day = (iso: string) => labels.day({ date: jakartaDayOf(iso, now).date, relative: null });

  const finished = jobs
    .filter((job) => job.completedAt)
    .sort((a, b) => Date.parse(b.completedAt ?? "") - Date.parse(a.completedAt ?? ""))
    .map((job) => ({ ...job, state: backOfficeRecordingState(job, now.getTime()) }));

  const requested = typeof params.recording === "string" && uuidPattern.test(params.recording) ? params.recording.toLowerCase() : null;
  const playingJob = requested ? finished.find((job) => job.recordingId === requested) : undefined;
  const playerTitle = playingJob
    ? t("playerTitle", { service: serviceName(playingJob.serviceId) ?? t("serviceFallback"), day: day(playingJob.completedAt ?? playingJob.endsAt) })
    : t("playerFallbackTitle");

  return (
    <ClientMessages namespaces={["AgencyLiveStream", "AgencyRecordingPlayer"]}>
      <section aria-labelledby="live-title" className="flex flex-col gap-4">
        <header className="flex items-baseline justify-between gap-3">
          <h2 id="live-title" className="font-display text-lg font-semibold text-ink">
            {t("liveTitle")}
          </h2>
          <p className="text-sm text-ink-muted">{t("liveCount", { count: streams.length })}</p>
        </header>
        {streams.length === 0 ? (
          <EmptyState icon={Video} title={t("liveEmptyTitle")}>
            {t("liveEmptyBody")}
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {streams.map((stream) => (
              <LiveTile
                key={stream.orderId}
                stream={stream}
                serviceName={serviceName(stream.serviceId)}
                areaName={areaName(stream.areaId)}
                startedAt={labels.time(stream.startedAt)}
              />
            ))}
          </ul>
        )}
      </section>

      {requested ? (
        <section aria-labelledby="player-title" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 md:p-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="player-title" className="font-display text-lg font-semibold text-ink">
              {playerTitle}
            </h2>
            <Link href="/agency/recordings" className={secondaryButton}>
              <X className="size-4 shrink-0" aria-hidden="true" />
              {t("close")}
            </Link>
          </header>
          <Suspense
            fallback={
              <div aria-busy="true" className="flex aspect-video w-full items-center justify-center rounded-md bg-surface-sunken">
                <span className="text-sm text-ink-muted">{t("loading")}</span>
              </div>
            }
          >
            <Replay recordingId={requested} label={playerTitle} labels={labels} now={now} />
          </Suspense>
        </section>
      ) : null}

      <section aria-labelledby="recordings-title" className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 id="recordings-title" className="font-display text-lg font-semibold text-ink">
            {t("recordingsTitle")}
          </h2>
          <p className="max-w-prose text-sm text-ink-muted">{t("recordingsDescription")}</p>
        </header>
        {finished.length === 0 ? (
          <EmptyState icon={CirclePlay} title={t("recordingsEmptyTitle")}>
            {t("recordingsEmptyBody")}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t("recordingsCaption")}</caption>
              <thead className="bg-surface-sunken">
                <tr>
                  <th scope="col" className={headCell}>
                    {t("table.finished")}
                  </th>
                  <th scope="col" className={`${headCell} hidden md:table-cell`}>
                    {t("table.service")}
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
                {finished.map((job) => {
                  const at = job.completedAt ?? job.endsAt;
                  const service = serviceName(job.serviceId) ?? t("serviceFallback");
                  const cleaner = <span className={job.cleanerName ? "text-ink" : "text-ink-muted"}>{job.cleanerName ?? t("noCleaner")}</span>;
                  const what = (
                    <>
                      <span className="block font-semibold text-ink">{service}</span>
                      <span className="mt-0.5 block max-w-prose text-ink-muted">
                        {areaName(job.areaId) ?? job.areaId} · {job.address}
                      </span>
                    </>
                  );
                  const recording = (
                    <RecordingCell
                      state={job.state}
                      text={
                        job.state === "available" && job.recordingExpiresAt
                          ? t("available", { day: day(job.recordingExpiresAt), time: labels.time(job.recordingExpiresAt) })
                          : t(job.state === "expired" ? "expired" : "none")
                      }
                    >
                      {job.state === "available" && job.recordingId ? (
                        job.recordingId === requested ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-live">
                            <CirclePlay className="size-4 shrink-0" aria-hidden="true" />
                            {t("playing")}
                          </span>
                        ) : (
                          <Link
                            href={{ pathname: "/agency/recordings", query: { recording: job.recordingId } }}
                            aria-label={t("playFor", { service, day: day(at) })}
                            className={secondaryButton}
                          >
                            <CirclePlay className="size-4 shrink-0" aria-hidden="true" />
                            {t("play")}
                          </Link>
                        )
                      ) : null}
                    </RecordingCell>
                  );
                  return (
                    <tr key={job.id} data-job={job.id} className="transition-colors duration-150 ease-out-quart hover:bg-canvas">
                      <td className={`${cell} text-ink tabular-nums`}>
                        <span className="block font-semibold whitespace-nowrap">{t("finishedAt", { day: day(at), time: labels.time(at) })}</span>
                        <span className="mt-3 flex flex-col gap-2 md:hidden">
                          <span>{what}</span>
                          {cleaner}
                          {recording}
                        </span>
                      </td>
                      <td className={`${cell} hidden md:table-cell`}>
                        {what}
                        <span className="mt-1 block lg:hidden">{cleaner}</span>
                      </td>
                      <td className={`${cell} hidden lg:table-cell`}>{cleaner}</td>
                      <td className={`${cell} hidden md:table-cell`}>{recording}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ClientMessages>
  );
}

function RecordingCell({ state, text, children }: { state: BackOfficeRecordingState; text: string; children?: ReactNode }) {
  const { Icon, tone } = stateIcons[state];
  return (
    <span className="flex flex-col items-start gap-2">
      <span className={`flex items-start gap-1.5 ${tone}`}>
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{text}</span>
      </span>
      {children}
    </span>
  );
}

async function Replay({ recordingId, label, labels, now }: { recordingId: string; label: string; labels: SlotLabels; now: Date }) {
  const t = await getTranslations("AgencyRecordingsPage");
  let link: RecordingLink;
  try {
    const viewer = await createSupabaseServerClient({ writeCookies: false });
    link = await recordingLink(viewer, createSupabaseServiceClient(), recordingId);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof RecordingLinkError && error.reason === "recording_expired") {
      return <ReplayNotice icon={ShieldCheck} title={t("expiredTitle")} body={t("expiredBody")} />;
    }
    if (error instanceof RecordingLinkError && error.reason === "recording_not_found") {
      return <ReplayNotice icon={VideoOff} title={t("notFoundTitle")} body={t("notFoundBody")} />;
    }
    console.error("[agency] could not make the replay link:", error);
    return <ReplayNotice icon={CircleAlert} title={t("linkErrorTitle")} body={t("linkErrorBody")} />;
  }
  const until = link.availableUntil;
  return (
    <>
      <AgencyRecordingPlayer recordingId={recordingId} src={link.url} label={label} />
      <p className="flex items-start gap-2 text-sm text-ink">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
        <span>{t("available", { day: labels.day({ date: jakartaDayOf(until, now).date, relative: null }), time: labels.time(until) })}</span>
      </p>
    </>
  );
}

function ReplayNotice({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-surface-sunken px-4 py-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-ink-muted">{body}</p>
      </div>
    </div>
  );
}
