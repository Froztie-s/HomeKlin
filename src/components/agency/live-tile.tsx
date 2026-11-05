import { Clock } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { StreamError, watchStream, type LiveStream } from "@/lib/stream/streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { LiveStatus } from "./live-status";
import { LiveVideo } from "./live-video";

type LiveTileProps = {
  stream: LiveStream;
  serviceName: string | undefined;
  areaName: string | undefined;
  /** "09.12", the start in Jakarta time. */
  startedAt: string;
};

// One of the agency's own live jobs (T29): the video, then who is cleaning, the service and area, the
// stream's status (kept current by LiveStatus) and since when. Facts sit under the video, never over it
// (markdown/PRODUCT.md: calm, not CCTV). The link is made on the server behind <Suspense>, after the
// database has said this agency may watch (watchStream); listLiveStreams already lists only its own.
// Needs the AgencyLiveStream client messages.
export async function LiveTile({ stream, serviceName, areaName, startedAt }: LiveTileProps) {
  const t = await getTranslations("AgencyLiveStream");
  const cleaner = stream.cleanerName ?? t("cleanerFallback");
  const titleId = `live-${stream.orderId}`;
  return (
    <li data-stream={stream.orderId} className="min-w-0">
      <article aria-labelledby={titleId} className="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-card">
        <Suspense
          fallback={
            <div aria-busy="true" className="flex aspect-video w-full items-center justify-center rounded-md bg-surface-sunken">
              <span className="text-xs text-ink-muted">{t("loading")}</span>
            </div>
          }
        >
          <SignedVideo orderId={stream.orderId} label={t("videoLabel", { name: cleaner })} />
        </Suspense>
        <div className="flex flex-col gap-1.5 px-1 pb-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <h3 id={titleId} className="min-w-0 font-semibold break-words text-ink">
              {cleaner}
            </h3>
            <LiveStatus orderId={stream.orderId} initial={stream.status} />
          </div>
          <p className="text-sm text-ink">
            {serviceName ?? t("serviceFallback")}
            {areaName ? <span className="text-ink-muted"> · {areaName}</span> : null}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-ink-muted tabular-nums">
            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
            {t("started", { time: startedAt })}
          </p>
        </div>
      </article>
    </li>
  );
}

async function SignedVideo({ orderId, label }: { orderId: string; label: string }) {
  let src: string | null = null;
  let ended = false;
  try {
    const viewer = await createSupabaseServerClient({ writeCookies: false });
    const { view } = await watchStream(viewer, createSupabaseServiceClient(), orderId);
    // A LiveKit room (T32) is not played here yet: the tile says it cannot play.
    if (view.kind === "video") src = view.url;
  } catch (error) {
    unstable_rethrow(error);
    ended = error instanceof StreamError && error.reason === "stream_not_found";
    if (!ended) console.error("[agency] could not open the stream of %s:", orderId, error);
  }
  return <LiveVideo orderId={orderId} src={src} initialProblem={ended ? "ended" : undefined} label={label} />;
}
