"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { recordingTimeLeft, timeLeftMessage } from "./recording-time";

// How long the recording is still kept, such as "6 hari 23 jam lagi" (T15), counting down once a
// minute while the page is open. The server renders it with its own clock (renderedAt), and the first
// render in the browser reuses that moment, so the two always match; from then on it follows the
// browser's clock. One shared timer serves every countdown on the page.

let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const notify of listeners) notify();
    }, 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const currentMinute = () => now;

export function RecordingCountdown({ expiresAt, renderedAt }: { expiresAt: string; renderedAt: number }) {
  const t = useTranslations("Recording");
  const moment = useSyncExternalStore(subscribe, currentMinute, () => renderedAt);
  const left = timeLeftMessage(recordingTimeLeft(expiresAt, moment));

  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800 tabular-nums">
      <Clock className="size-4 shrink-0" aria-hidden="true" />
      <span>{t(left.key, left.values)}</span>
    </span>
  );
}
