import { Building2, Clock } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { StreamError, watchStream, type LiveStream } from "@/lib/stream/streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { FeedStatus } from "./feed-status";
import { FeedVideo } from "./feed-video";

type FeedTileProps = {
  stream: LiveStream;
  /** The service's and the area's names in this language; undefined when no longer in the catalog. */
  serviceName: string | undefined;
  areaName: string | undefined;
  /** "09.12", the start in Jakarta time. */
  startedAt: string;
};

// One live job on the admin monitor (T25): the video, then who is cleaning, for which partner agency
// (admin may see it), the service and the area, the stream's status (kept current by FeedStatus) and
// since when it runs. Facts sit under the video, never burned over it (markdown/PRODUCT.md: calm, not
// CCTV). The link to the video is made on the server for this admin behind <Suspense>, so the tile's
// words show at once and each video arrives on its own. Needs the AdminMonitorPage client messages.
export async function FeedTile({ stream, serviceName, areaName, startedAt }: FeedTileProps) {
  const t = await getTranslations("AdminMonitorPage");
  const cleaner = stream.cleanerName ?? t("cleanerFallback");
  const titleId = `feed-${stream.orderId}`;

  return (
    <li data-feed={stream.orderId} className="min-w-0">
      <article aria-labelledby={titleId} className="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-card">
        <Suspense fallback={<VideoLoading label={t("loading")} />}>
          <SignedFeed orderId={stream.orderId} label={t("videoLabel", { name: cleaner })} />
        </Suspense>
        <div className="flex flex-col gap-1.5 px-1 pb-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <h3 id={titleId} className="min-w-0 font-semibold break-words text-ink">
              {cleaner}
            </h3>
            <FeedStatus orderId={stream.orderId} initial={stream.status} />
          </div>
          <p className="text-sm text-ink">
            {serviceName ?? t("serviceFallback")}
            {areaName ? <span className="text-ink-muted"> · {areaName}</span> : null}
          </p>
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <Building2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">{t("agency")}: </span>
            <span className="min-w-0 break-words">{stream.agencyName}</span>
          </p>
          <p className="flex items-center gap-1.5 text-xs text-ink-muted tabular-nums">
            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
            {t("startedAt", { time: startedAt })}
          </p>
        </div>
      </article>
    </li>
  );
}

// The viewer's own session asks the database whether this admin may watch (stream_for_viewer); only
// then does the server sign a link to the demo clip.
async function SignedFeed({ orderId, label }: { orderId: string; label: string }) {
  let src: string | null = null;
  let ended = false;
  try {
    const viewer = await createSupabaseServerClient({ writeCookies: false });
    const { view } = await watchStream(viewer, createSupabaseServiceClient(), orderId);
    // A LiveKit room (T32) is not played on the monitor yet: the tile says it cannot play.
    if (view.kind === "video") src = view.url;
  } catch (error) {
    unstable_rethrow(error);
    // Ended between the list and this link: check-out came first.
    ended = error instanceof StreamError && error.reason === "stream_not_found";
    if (!ended) console.error("[monitor] could not open the stream of %s:", orderId, error);
  }
  return <FeedVideo orderId={orderId} src={src} initialProblem={ended ? "ended" : undefined} label={label} />;
}

// Not a status region: the tile's one status is the stream's own (FeedStatus).
function VideoLoading({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="flex aspect-video w-full items-center justify-center rounded-md bg-surface-sunken">
      <span className="text-xs text-ink-muted">{label}</span>
    </div>
  );
}
