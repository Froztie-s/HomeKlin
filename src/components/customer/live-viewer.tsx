"use client";

import {
  CircleAlert,
  Clock,
  LoaderCircle,
  LogIn,
  Pause,
  Play,
  RotateCw,
  ShieldCheck,
  VideoOff,
  Signal,
  SignalLow,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { LiveIndicator } from "@/components/ui/live-indicator";
import { Link } from "@/i18n/navigation";
import { readStatusAnswer, readVideoLink, statusPollMs, type LiveStatus, type StatusAnswer } from "./live-status";
import { RecordingNotice } from "./recording-notice";

type LiveViewerProps = {
  orderId: string;
  /** The signed link the server made for this customer (src/lib/stream/streams.ts, watchStream). */
  src: string;
  status: LiveStatus;
  cleanerName: string | null;
  /** When the stream started, in Jakarta time ("10.05"), written on the server. */
  startedTime: string;
};

type Shown = LiveStatus | "ended" | "signedOut";

const chips: Record<LiveStatus, { Icon: LucideIcon; tone: string }> = {
  active: { Icon: Signal, tone: "bg-success-surface text-success" },
  weak: { Icon: SignalLow, tone: "bg-warning-surface text-warning" },
  disconnected: { Icon: WifiOff, tone: "bg-danger-surface text-danger" },
};

const outline =
  "inline-flex min-h-touch shrink-0 items-center justify-center gap-2 rounded-full border border-border-control bg-surface px-4 text-sm font-semibold text-ink transition-[background-color,transform] duration-150 ease-out-quart hover:bg-surface-sunken active:scale-[0.98] active:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60";

// The customer's live view of their own job (T23). The server checked this viewer and made a short-lived
// link before this rendered (./order-live.tsx); it plays muted, looped and inline, like a live feed,
// with a Jeda/Putar button (and no autoplay under reduced motion). About every 10 seconds it asks
// GET /api/streams/<order id>?status=1 for the stream's state, which the API answers only for a viewer
// still allowed to watch: a weak signal or a drop shows as a calm message over the picture, and a 404
// (the stream ended, or the job was finished) replaces the picture with "Siaran sudah berakhir" and
// drops the link. If the cleaner starts again, the view asks for a fresh link and carries on. When the
// video fails (the link runs out after 10 minutes), it asks for a fresh link once, then offers a reload.
export function LiveViewer({ orderId, src: firstSrc, status: firstStatus, cleanerName, startedTime }: LiveViewerProps) {
  const t = useTranslations("LiveStream");
  const video = useRef<HTMLVideoElement>(null);
  const [shown, setShown] = useState<Shown>(firstStatus);
  const [src, setSrc] = useState<string | null>(firstSrc);
  // A new player element for each fresh link, so the browser loads it even if the address is the same.
  const [load, setLoad] = useState(0);
  const [problem, setProblem] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [paused, setPaused] = useState(true);
  const retriedOnItsOwn = useRef(false);

  async function freshLink(): Promise<boolean> {
    setReloading(true);
    try {
      const response = await fetch(`/api/streams/${orderId}`, { cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      const url = response.ok ? readVideoLink(body) : null;
      if (url) {
        setProblem(false);
        setSrc(url);
        setLoad((count) => count + 1);
        return true;
      }
      const answer = readStatusAnswer(response.status, body);
      if (answer.kind === "gone" || answer.kind === "signedOut") apply(answer, shown);
      else setProblem(true);
      return false;
    } catch (error) {
      console.error("[stream] could not fetch a fresh link:", error);
      return false;
    } finally {
      setReloading(false);
    }
  }

  function apply(answer: StatusAnswer, current: Shown) {
    if (answer.kind === "gone") {
      setShown("ended");
      setSrc(null);
    } else if (answer.kind === "signedOut") {
      setShown("signedOut");
      setSrc(null);
    } else if (answer.kind === "live") {
      // Started again after it ended: it needs a new link.
      if (current === "ended" || current === "signedOut") {
        retriedOnItsOwn.current = false;
        void freshLink().then((ok) => {
          if (ok) setShown(answer.status);
        });
      } else {
        setShown(answer.status);
      }
    }
  }

  const onPolled = useEffectEvent((answer: StatusAnswer) => apply(answer, shown));

  useEffect(() => {
    let stopped = false;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const response = await fetch(`/api/streams/${orderId}?status=1`, { cache: "no-store" });
        const body: unknown = await response.json().catch(() => null);
        if (!stopped) onPolled(readStatusAnswer(response.status, body));
      } catch (error) {
        // Offline for a moment: keep showing what is there and ask again next round.
        console.warn("[stream] could not check the stream's state:", error);
      }
    }, statusPollMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [orderId]);

  // Muted is set on the element itself (React does not write the attribute in server HTML), and the
  // feed starts on its own unless the customer asked for less motion.
  const startPlaying = useEffectEvent(() => {
    const element = video.current;
    if (!element) return;
    element.muted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.play().catch((error: unknown) => console.warn("[stream] the browser did not start the video:", error));
  });
  useEffect(() => startPlaying(), [load, src]);

  function handleError() {
    if (retriedOnItsOwn.current) {
      setProblem(true);
      return;
    }
    retriedOnItsOwn.current = true;
    void freshLink();
  }

  // An error that happened before the page came alive fired no React event: look for it once.
  const checkEarlyError = useEffectEvent(() => {
    if (video.current?.error) handleError();
  });
  useEffect(() => checkEarlyError(), []);

  function togglePlay() {
    const element = video.current;
    if (!element) return;
    if (element.paused) element.play().catch((error: unknown) => console.warn("[stream] the video did not play:", error));
    else element.pause();
  }

  if (shown === "ended") {
    return (
      <div role="status">
        <RecordingNotice icon={VideoOff} title={t("endedTitle")}>
          <p>{t("endedBody")}</p>
          {/* A plain link on purpose: a full page load shows the finished job and its recording. */}
          <a href="" className={`${outline} mt-3`}>
            <RotateCw className="size-4 shrink-0" aria-hidden="true" />
            {t("retry")}
          </a>
        </RecordingNotice>
      </div>
    );
  }

  if (shown === "signedOut") {
    return (
      <div role="status">
        <RecordingNotice icon={LogIn} title={t("signedOutTitle")}>
          <p>{t("signedOutBody")}</p>
          <Link href="/login" className={`${outline} mt-3`}>
            {t("signIn")}
          </Link>
        </RecordingNotice>
      </div>
    );
  }

  const { Icon: StatusIcon, tone } = chips[shown];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-md bg-surface-sunken">
        {src ? (
          <video
            key={load}
            ref={video}
            src={src}
            muted
            loop
            playsInline
            preload="auto"
            aria-label={t("playerLabel")}
            onError={handleError}
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
            className="aspect-video w-full object-contain"
          >
            <p className="p-4 text-sm text-ink-muted">{t("unsupported")}</p>
          </video>
        ) : (
          <div className="aspect-video w-full" />
        )}
        {shown === "weak" ? (
          <div className="absolute inset-x-2 bottom-2 flex items-start gap-2.5 rounded-md bg-surface/95 px-3 py-2.5 shadow-card">
            <SignalLow className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div className="flex min-w-0 flex-col text-sm">
              <p className="font-semibold text-ink">{t("weakTitle")}</p>
              <p className="text-ink-muted">{t("weakBody")}</p>
            </div>
          </div>
        ) : null}
        {shown === "disconnected" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface/90 px-6 text-center">
            <LoaderCircle className="size-6 shrink-0 animate-spin text-brand-700" aria-hidden="true" />
            <p className="font-semibold text-ink">{t("disconnectedTitle")}</p>
            <p className="max-w-xs text-sm text-ink-muted">{t("disconnectedBody")}</p>
          </div>
        ) : null}
        {/* Last, so it stays readable over the messages above. */}
        <div className="pointer-events-none absolute top-2 left-2">
          <LiveIndicator label={t("liveBadge")} />
        </div>
      </div>

      <div aria-live="polite" className="empty:hidden">
        {reloading ? (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            {t("reloading")}
          </p>
        ) : problem ? (
          <div className="flex flex-col gap-3 rounded-md bg-warning-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2.5 text-sm font-medium text-ink">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span>{t("videoProblem")}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                retriedOnItsOwn.current = false;
                void freshLink();
              }}
              disabled={reloading}
              className={outline}
            >
              <RotateCw className="size-4 shrink-0" aria-hidden="true" />
              {t("reload")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="flex min-w-0 flex-col">
          {cleanerName ? <span className="text-base font-semibold text-ink">{cleanerName}</span> : null}
          <span className="text-sm text-ink-muted">{t("cleanerRole")}</span>
        </p>
        <p role="status" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${tone}`}>
          <StatusIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">{t("statusLabel")} </span>
          {t(`status.${shown}`)}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="flex items-center gap-2 text-sm text-ink">
          <Clock className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
          <span>{t("startedAt", { time: startedTime })}</span>
        </p>
        <button type="button" onClick={togglePlay} className={outline}>
          {paused ? <Play className="size-4 shrink-0" aria-hidden="true" /> : <Pause className="size-4 shrink-0" aria-hidden="true" />}
          {paused ? t("play") : t("pause")}
        </button>
      </div>

      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
        <span>{t("privacy")}</span>
      </p>
    </div>
  );
}
