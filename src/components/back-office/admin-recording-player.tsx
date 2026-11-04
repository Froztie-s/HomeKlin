"use client";

import { CircleAlert, LoaderCircle, RotateCw, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";

// Admin's replay of a finished job (T26): the browser's own video player (keyboard and screen reader
// friendly) with the short-lived link the server made for this admin (recordingLink,
// src/lib/recordings/link.ts). The link works for 10 minutes; on the first error the player asks
// GET /api/recordings/<id>/link for a fresh one (which checks the viewer again) and carries on where it
// stopped. If that fails too it says so and offers "Muat ulang video"; if the 7 days ran out meanwhile
// (410) it shows that the recording was deleted, as the page does. Needs the AdminRecordingsPage messages.

type Problem = "unplayable" | "failed" | "expired";

export function AdminRecordingPlayer({ recordingId, src: firstSrc, label }: { recordingId: string; src: string; label: string }) {
  const t = useTranslations("AdminRecordingsPage");
  const video = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState(firstSrc);
  // A new element for each fresh link, so the browser loads it even if the address is the same.
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
      console.error("[recordings] could not fetch a fresh link for %s:", recordingId, error);
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
      <div className="flex items-start gap-3 rounded-md bg-surface-sunken px-4 py-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-1 text-sm">
          <p className="font-semibold text-ink">{t("expiredTitle")}</p>
          <p className="text-ink-muted">{t("expiredBody")}</p>
        </div>
      </div>
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
        aria-label={label}
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-warning-surface py-2 pr-2 pl-4">
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
