import { CircleAlert } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ClientMessages } from "@/i18n/client-messages";
import { formatJakartaTime } from "@/lib/catalog/slots-days";
import { StreamError, watchStream, type ViewerStream } from "@/lib/stream/streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { LiveViewer } from "./live-viewer";
import { LiveWaiting } from "./live-waiting";
import { RecordingNotice } from "./recording-notice";

type OrderLiveProps = {
  orderId: string;
  /** "details": a section of the order's details, with its own heading. "page": the whole of /orders/live. */
  variant: "details" | "page";
};

// "Tonton langsung" for the customer's own job in progress (T23, SPEC "Video access rules"). The viewer's
// own session asks the database first whether this customer may watch this job now (watchStream,
// src/lib/stream/streams.ts: their own job, with consent, checked in, not finished, with a live stream);
// only then does the server ask the stream source for a link, which works for 10 minutes. Anything else
// is "stream not found", which here means the cleaner has not started (or has stopped) the stream: the
// pages only show this section for the customer's own order, so it never says anything about another's.
// It renders behind <Suspense>, so the rest of the order shows at once.
export async function OrderLive({ orderId, variant }: OrderLiveProps) {
  const t = await getTranslations("LiveStream");
  const details = variant === "details";
  return (
    <section
      id="live"
      aria-labelledby={details ? "live-title" : undefined}
      aria-label={details ? undefined : t("title")}
      className={`flex scroll-mt-4 flex-col gap-3 ${details ? "border-t border-border p-5 md:p-6" : ""}`}
    >
      {details ? (
        <h3 id="live-title" className="font-display text-lg font-semibold text-ink">
          {t("title")}
        </h3>
      ) : null}
      <Suspense fallback={<LiveLoading />}>
        <LiveStream orderId={orderId} />
      </Suspense>
    </section>
  );
}

async function LiveStream({ orderId }: { orderId: string }) {
  let stream: ViewerStream;
  try {
    const viewer = await createSupabaseServerClient({ writeCookies: false });
    stream = await watchStream(viewer, createSupabaseServiceClient(), orderId);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof StreamError && error.reason === "stream_not_found") return <Waiting orderId={orderId} />;
    console.error("[stream] could not open the live view:", error);
    return <LiveUnavailable />;
  }
  if (stream.status === "ended") return <Waiting orderId={orderId} />;
  // The LiveKit source (T32) answers with a room token, which this view does not play yet.
  if (stream.view.kind !== "video") {
    console.error("[stream] the live view got a %s view, which it cannot play yet", stream.view.kind);
    return <LiveUnavailable />;
  }

  const locale = await getLocale();
  return (
    <ClientMessages namespaces={["LiveStream"]}>
      <LiveViewer
        orderId={orderId}
        src={stream.view.url}
        status={stream.status}
        cleanerName={stream.cleanerName}
        startedTime={formatJakartaTime(stream.startedAt, locale)}
      />
    </ClientMessages>
  );
}

function Waiting({ orderId }: { orderId: string }) {
  return (
    <ClientMessages namespaces={["LiveStream"]}>
      <LiveWaiting orderId={orderId} />
    </ClientMessages>
  );
}

async function LiveLoading() {
  const t = await getTranslations("LiveStream");
  return (
    <div role="status" className="flex aspect-video w-full items-center justify-center rounded-md bg-surface-sunken">
      <span className="text-sm text-ink-muted">{t("loading")}</span>
    </div>
  );
}

async function LiveUnavailable() {
  const t = await getTranslations("LiveStream");
  return (
    <RecordingNotice icon={CircleAlert} title={t("errorTitle")}>
      <p>{t("errorBody")}</p>
      {/* A plain link on purpose: a full page load asks for the stream again. */}
      <a
        href=""
        className="mt-3 inline-flex min-h-touch items-center justify-center rounded-full border border-border-control bg-surface px-5 text-sm font-semibold text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50"
      >
        {t("retry")}
      </a>
    </RecordingNotice>
  );
}
