"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";
import { coveredBy, useFeedCard } from "./feed-card";

// "Buka" on a live card (M1): puts that card's <video> into full screen with the Fullscreen API, or
// on iPhone Safari, which has no element full screen, with the video's own full-screen player. It is a
// real button drawn as an underlined link, a full 44 px target.
// Since 2026-11-20 (UX audit item 19) it is never a greyed-out button: while the frame has no picture
// to enlarge (loading failed, the phone dropped, the job ended), "Buka" on a monitor card opens the
// order's page instead, where admin sees what happened and can act; on the order's page itself, which
// has nothing further to open, it is left out until the picture is back.

type WebKitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

const noChanges = () => () => {};
const canEnlarge = () => document.fullscreenEnabled || "webkitEnterFullscreen" in HTMLVideoElement.prototype;

const look =
  "inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-full px-1.5 text-sm font-semibold text-primary underline decoration-1 underline-offset-4 transition-colors duration-150 ease-out-quart hover:bg-sunken hover:decoration-2 active:bg-lime-wash";

type FeedOpenProps = {
  name: string;
  /** On a monitor card: the order's page, opened while there is no picture. */
  order?: { href: string; label: string };
};

export function FeedOpen({ name, order }: FeedOpenProps) {
  const t = useTranslations("AdminMonitorPage");
  const { video, status, showing } = useFeedCard();
  // Assumed on the server and in the first render, so the page hydrates as it was sent.
  const supported = useSyncExternalStore(noChanges, canEnlarge, () => true);
  const picture = showing && coveredBy(status) === null;

  if (!picture || !supported) {
    if (!order) return null;
    return (
      <Link href={order.href} aria-label={order.label} className={look}>
        {t("open")}
      </Link>
    );
  }

  function open() {
    const element: WebKitVideo | null = video;
    if (!element) return;
    if (element.requestFullscreen && document.fullscreenEnabled) {
      element.requestFullscreen().catch((error: unknown) => console.error("[monitor] could not open full screen:", error));
    } else {
      element.webkitEnterFullscreen?.();
    }
  }

  return (
    <button type="button" onClick={open} aria-label={t("openLabel", { name })} className={look}>
      {t("open")}
    </button>
  );
}
