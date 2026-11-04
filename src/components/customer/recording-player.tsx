"use client";

import { CircleAlert, LoaderCircle, RotateCw, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { RecordingNotice } from "./recording-notice";

// The replay of a finished job (T15): the browser's own video player (keyboard and screen reader
// friendly), playing the short-lived link the server made for this customer (src/lib/recordings/link.ts).
// The link works for 10 minutes, so a customer who presses play later, or seeks after a long pause,
// can hit a link that has run out. On the first error the player asks the server for a fresh link
// (GET /api/recordings/<id>/link, which checks the viewer again) and carries on where it stopped. If it
// fails again, it says so and offers "Muat ulang video". If the 7 days have run out meanwhile (410), it
// shows that the recording was deleted, as the page does.

type Problem = "unplayable" | "failed" | "expired";

export function RecordingPlayer({ recordingId, src: firstSrc }: { recordingId: string; src: string }) {
  const t = useTranslations("Recording");
  const video = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState(firstSrc);
  // A new player element for each fresh link, so the browser loads it even if the address is the same.
  const [load, setLoad] = useState(0);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [reloading, setReloading] = useState(false);
  const retriedOnItsOwn = useRef(false);
  const resumeAt = useRef(0);

  async function reload() {
    resumeAt.current = video.current?.currentTime ?? 0;
    setReloading(true);
    try {
      const response = await fetch(`/api/recordings/${recordingId}/link`, { cache: "no-store" });
      const body: unknown = response.ok ? await response.json() : null;
      const url = body && typeof body === "object" && "url" in body && typeof body.url === "string" ? body.url : null;
      if (url) {
        setProblem(null);
        setSrc(url);
        setLoad((count) => count + 1);
      } else {
        setProblem(response.status === 410 ? "expired" : "failed");
      }
    } catch (error) {
      console.error("[recording] could not fetch a fresh link:", error);
      setProblem("failed");
    } finally {
      setReloading(false);
    }
  }

  function handleError() {
    if (retriedOnItsOwn.current) {
      setProblem("unplayable");
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

  function resume() {
    if (video.current && resumeAt.current > 0) video.current.currentTime = resumeAt.current;
    resumeAt.current = 0;
  }

  if (problem === "expired") {
    return (
      <RecordingNotice icon={ShieldCheck} title={t("expiredTitle")}>
        {t("expiredBody")}
      </RecordingNotice>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <video
        key={load}
        ref={video}
        src={src}
        controls
        playsInline
        preload="metadata"
        aria-label={t("playerLabel")}
        onError={handleError}
        onLoadedMetadata={resume}
        className="aspect-video w-full rounded-md bg-surface-sunken object-contain"
      >
        <p className="p-4 text-sm text-ink-muted">{t("unsupported")}</p>
      </video>
      <div aria-live="polite">
        {reloading ? (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            {t("reloading")}
          </p>
        ) : problem ? (
          <div className="flex flex-col gap-3 rounded-md bg-warning-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2.5 text-sm font-medium text-ink">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span>{t(problem)}</span>
            </p>
            <button
              type="button"
              onClick={() => void reload()}
              disabled={reloading}
              className="inline-flex min-h-touch shrink-0 items-center justify-center gap-2 rounded-full border border-border-control bg-surface px-5 text-sm font-semibold text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCw className="size-4 shrink-0" aria-hidden="true" />
              {t("reload")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
