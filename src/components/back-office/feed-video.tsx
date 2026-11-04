"use client";

import { CircleAlert, CircleStop, LoaderCircle, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";

// One feed's video on the admin monitor (T25): the short-lived link the server made for this admin
// (watchStream, src/lib/stream/streams.ts), played muted, looped and inline so a whole grid plays at
// once without sound. The link works for 10 minutes, so on the first error the tile asks
// GET /api/streams/<order id> for a fresh one, once. If that fails too it says so and offers "Coba
// lagi"; if the stream has ended meanwhile (404) it says that instead. With reduced motion the video
// does not start by itself: it shows its controls and admin presses play.

type Problem = "failed" | "ended";

type FeedVideoProps = {
  orderId: string;
  /** The signed link, or null when the server could not make one. */
  src: string | null;
  /** Why there is no link: the stream ended, or making the link failed. */
  initialProblem?: Problem;
  /** "Siaran langsung Rina Wulandari". */
  label: string;
};

function videoUrl(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("view" in body)) return null;
  const view = body.view;
  if (!view || typeof view !== "object" || !("kind" in view) || view.kind !== "video" || !("url" in view)) return null;
  return typeof view.url === "string" ? view.url : null;
}

export function FeedVideo({ orderId, src: firstSrc, initialProblem, label }: FeedVideoProps) {
  const t = useTranslations("AdminMonitorPage");
  const video = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState(firstSrc);
  // A new element for each fresh link, so the browser loads it even if the address is the same.
  const [load, setLoad] = useState(0);
  const [problem, setProblem] = useState<Problem | null>(initialProblem ?? (firstSrc ? null : "failed"));
  const [reloading, setReloading] = useState(false);
  const retriedOnItsOwn = useRef(false);

  async function reload() {
    setReloading(true);
    try {
      const response = await fetch(`/api/streams/${orderId}`, { cache: "no-store" });
      const url = response.ok ? videoUrl(await response.json()) : null;
      if (url) {
        setProblem(null);
        setSrc(url);
        setLoad((count) => count + 1);
      } else {
        setProblem(response.status === 404 ? "ended" : "failed");
      }
    } catch (error) {
      console.error("[monitor] could not fetch a fresh link for %s:", orderId, error);
      setProblem("failed");
    } finally {
      setReloading(false);
    }
  }

  function handleError() {
    if (retriedOnItsOwn.current) {
      setProblem("failed");
      return;
    }
    retriedOnItsOwn.current = true;
    void reload();
  }

  // An error that happened before the page came alive fired no React event: look for it once.
  const checkEarlyError = useEffectEvent(() => {
    if (video.current?.error) handleError();
  });
  useEffect(() => checkEarlyError(), []);

  // React sets `muted` as a property only, so it is set here as well before playing. With reduced
  // motion, or when the browser blocks autoplay, the video shows its controls and admin starts it.
  // The controls are set on the element, not through a prop, so React never takes them away again.
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.muted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.pause();
      element.controls = true;
      return;
    }
    element.play().catch(() => {
      element.controls = true;
    });
  }, [load]);

  const ended = problem === "ended";
  const failed = problem === "failed";

  // A problem covers the video area with a calm panel (never a black box), and the video element
  // stays underneath while it can still recover, so a fresh link swaps in without moving the tile.
  return (
    <div className="relative aspect-video overflow-hidden rounded-md bg-surface-sunken">
      {ended || !src ? null : (
        <video
          key={load}
          ref={video}
          src={src}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          aria-label={label}
          aria-hidden={failed || undefined}
          onError={handleError}
          className="size-full object-cover"
        >
          <p className="p-4 text-sm text-ink-muted">{t("unsupported")}</p>
        </video>
      )}
      <div aria-live="polite" className={ended || failed || reloading ? "absolute inset-0 flex flex-col items-center justify-center gap-1 bg-surface-sunken p-4 text-center" : "sr-only"}>
        {reloading ? (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            {t("retrying")}
          </p>
        ) : ended ? (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <CircleStop className="size-4 shrink-0" aria-hidden="true" />
            {t("ended")}
          </p>
        ) : failed ? (
          <>
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
              {t("failed")}
            </p>
            <button
              type="button"
              onClick={() => void reload()}
              className="inline-flex min-h-touch items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:bg-surface hover:text-brand-800 active:bg-brand-50"
            >
              <RotateCw className="size-4 shrink-0" aria-hidden="true" />
              {t("retry")}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
