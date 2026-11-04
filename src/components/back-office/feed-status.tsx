"use client";

import { CircleStop, SignalMedium, WifiOff, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { StreamStatus } from "@/lib/stream/streams";

// A live feed's status on the admin monitor (T25), kept current: every 10 seconds the tile asks
// GET /api/streams/<order id>?status=1 (which checks the viewer again) and shows what the cleaner's
// phone last reported. A 404 means the stream has ended (check-out) and polling stops. A failed poll
// keeps the last known status; the next one tries again. The badge is a word with an icon or the calm
// breathing dot, never colour alone, and a polite live region, so a change is announced once.

export const statusPollMilliseconds = 10_000;

const statuses: readonly StreamStatus[] = ["active", "weak", "disconnected", "ended"];

const styles: Record<Exclude<StreamStatus, "active">, { Icon: LucideIcon; pill: string }> = {
  weak: { Icon: SignalMedium, pill: "bg-warning-surface text-warning" },
  disconnected: { Icon: WifiOff, pill: "bg-danger-surface text-danger" },
  ended: { Icon: CircleStop, pill: "bg-surface-sunken text-ink-muted" },
};

function isStatus(value: unknown): value is StreamStatus {
  return typeof value === "string" && (statuses as readonly string[]).includes(value);
}

export function FeedStatus({ orderId, initial }: { orderId: string; initial: StreamStatus }) {
  const t = useTranslations("AdminMonitorPage");
  const [status, setStatus] = useState(initial);
  const ended = status === "ended";

  useEffect(() => {
    if (ended) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/streams/${orderId}?status=1`, { cache: "no-store" });
        if (response.status === 404) {
          setStatus("ended");
          return;
        }
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (body && typeof body === "object" && "status" in body && isStatus(body.status)) setStatus(body.status);
      } catch (error) {
        console.error("[monitor] could not poll the stream status of %s:", orderId, error);
      }
    }, statusPollMilliseconds);
    return () => window.clearInterval(timer);
  }, [orderId, ended]);

  const label = t(`status.${status}`);
  return (
    <span role="status" className="shrink-0">
      {status === "active" ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-live-surface px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-live">
          <span aria-hidden="true" className="size-2 animate-breathe rounded-full bg-live-dot" />
          {label}
        </span>
      ) : (
        <StatusPill {...styles[status]} label={label} />
      )}
    </span>
  );
}

function StatusPill({ Icon, pill, label }: { Icon: LucideIcon; pill: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${pill}`}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
