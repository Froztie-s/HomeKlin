import { Clock } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { AdminJob } from "@/lib/jobs/jobs";
import { StreamError, watchStream, type LiveStream } from "@/lib/stream/streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { FeedCard } from "./feed-card";
import { FeedOpen } from "./feed-open";
import { FeedStatus } from "./feed-status";
import { FeedVideo } from "./feed-video";
import { StatusPill } from "./status-pill";

/** The service's and the area's names in this language; undefined when no longer in the catalog. */
type Names = { serviceName: string | undefined; areaName: string | undefined };

// The cards of the admin live monitor (T25, redesigned in M1 after the user's mock "Admin-Live"): a
// white card with a 16:9 frame, then a row with the status chip and the order number, then who is
// cleaning, the service and area, and the partner agency (admin may see it). Facts sit under the frame,
// never burned over the video (markdown/PRODUCT.md: calm, not CCTV). Needs the AdminMonitorPage client
// messages.

/**
 * One live job: the video, its status (kept current by FeedStatus, which the frame follows) and "Buka".
 * The link to the video is made on the server for this admin behind <Suspense>, so the card's words
 * show at once and each video arrives on its own.
 */
export async function FeedTile({ stream, serviceName, areaName }: { stream: LiveStream } & Names) {
  const t = await getTranslations("AdminMonitorPage");
  const cleaner = stream.cleanerName ?? t("cleanerFallback");
  const titleId = `feed-${stream.orderId}`;

  return (
    <li data-feed={stream.orderId} data-initial-status={stream.status} className="min-w-0">
      <FeedCard initial={stream.status}>
        <Card
          titleId={titleId}
          frame={
            <Suspense fallback={<VideoLoading label={t("loading")} />}>
              <SignedFeed orderId={stream.orderId} label={t("videoLabel", { name: cleaner })} />
            </Suspense>
          }
          chip={<FeedStatus orderId={stream.orderId} />}
          orderCode={stream.orderCode}
          cleaner={cleaner}
          service={serviceName ?? t("serviceFallback")}
          areaName={areaName}
          agencyName={stream.agencyName}
          action={<FeedOpen name={cleaner} order={{ href: `/admin/orders/${stream.orderCode}`, label: t("orderLink", { code: stream.orderCode }) }} />}
          labels={{ orderLink: t("orderLink", { code: stream.orderCode }), agency: t("agency") }}
        />
      </FeedCard>
    </li>
  );
}

/**
 * One of today's jobs whose cleaner has not checked in yet (M1, H1): a sunken frame with a clock and
 * the start time, the "Belum check-in" chip, and no video and no "Buka". Nothing on it changes while the
 * page is open, so it has no live region.
 */
export async function CheckInTile({ job, serviceName, areaName, startsAt }: { job: AdminJob; startsAt: string } & Names) {
  const t = await getTranslations("AdminMonitorPage");
  const cleaner = job.cleanerName ?? t("cleanerFallback");
  const titleId = `waiting-${job.id}`;

  return (
    <li data-waiting={job.id} className="min-w-0">
      <Card
        titleId={titleId}
        frame={
          <div className="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-md bg-sunken p-4 text-center">
            <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-full bg-card text-primary">
              <Clock className="size-5" />
            </span>
            <p className="text-sm font-semibold text-ink tabular-nums">{t("startsAt", { time: startsAt })}</p>
          </div>
        }
        chip={<StatusPill Icon={Clock} pill="bg-sunken text-ink" label={t("waiting")} />}
        orderCode={job.orderCode}
        cleaner={cleaner}
        service={serviceName ?? t("serviceFallback")}
        areaName={areaName}
        agencyName={job.agencyName}
        labels={{ orderLink: t("orderLink", { code: job.orderCode }), agency: t("agency") }}
      />
    </li>
  );
}

type CardProps = {
  titleId: string;
  frame: ReactNode;
  chip: ReactNode;
  orderCode: string;
  cleaner: string;
  service: string;
  areaName: string | undefined;
  agencyName: string;
  action?: ReactNode;
  /** The words a screen reader hears for the order link and before the agency. */
  labels: { orderLink: string; agency: string };
};

// The values of the mock: a white lg card with 12 px padding and 12 px between its parts; the rows
// inset 4 px; "service, area" and the agency in muted text under the cleaner's name.
function Card({ titleId, frame, chip, orderCode, cleaner, service, areaName, agencyName, action, labels }: CardProps) {
  return (
    <article aria-labelledby={titleId} className="flex h-full flex-col gap-3 rounded-lg bg-card p-3">
      {frame}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        {chip}
        {/* The order number opens the order's detail page (D1); "Buka" stays the full-screen video. A
            full 44 px target that keeps the row's height (the negative margin). */}
        <Link
          href={`/admin/orders/${orderCode}`}
          aria-label={labels.orderLink}
          className="-my-2.5 inline-flex min-h-touch items-center rounded-full px-1.5 text-xs text-ink-muted underline decoration-1 underline-offset-4 transition-colors duration-150 ease-out-quart hover:bg-sunken hover:text-ink hover:decoration-2 active:bg-lime-wash"
        >
          {orderCode}
        </Link>
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 px-1 pb-1">
        <div className="flex min-w-0 flex-col leading-snug">
          <h2 id={titleId} className="text-sm font-semibold break-words text-ink">
            {cleaner}
          </h2>
          <p className="text-sm break-words text-ink-muted">{areaName ? `${service}, ${areaName}` : service}</p>
          <p className="text-xs break-words text-ink-muted">
            <span className="sr-only">{labels.agency}: </span>
            {agencyName}
          </p>
        </div>
        {action}
      </div>
    </article>
  );
}

// The viewer's own session asks the database whether this admin may watch (stream_for_viewer); only
// then does the server sign a link to the demo clip. Also the order detail page's video (D1).
export async function SignedFeed({ orderId, label }: { orderId: string; label: string }) {
  let src: string | null = null;
  let ended = false;
  try {
    const viewer = await createSupabaseServerClient({ writeCookies: false });
    const { view } = await watchStream(viewer, createSupabaseServiceClient(), orderId);
    // A LiveKit room (T32) is not played on the monitor yet: the card says it cannot play.
    if (view.kind === "video") src = view.url;
  } catch (error) {
    unstable_rethrow(error);
    // Ended between the list and this link: check-out came first.
    ended = error instanceof StreamError && error.reason === "stream_not_found";
    if (!ended) console.error("[monitor] could not open the stream of %s:", orderId, error);
  }
  return <FeedVideo orderId={orderId} src={src} initialProblem={ended ? "ended" : undefined} label={label} />;
}

// The frame as it waits for its link: the mock's pale green frame with the white video circle. Not a
// status region: the card's one status is the stream's own (FeedStatus).
export function VideoLoading({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-md bg-frame">
      <span className="text-xs text-ink-muted">{label}</span>
    </div>
  );
}
