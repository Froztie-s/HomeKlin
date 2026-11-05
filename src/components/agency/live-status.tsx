"use client";

import { CircleStop, SignalMedium, WifiOff, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { StreamStatus } from "@/lib/stream/streams";

// A live stream's status on the agency's "Rekaman" page (T29), kept current the way the admin monitor
// does it (src/components/back-office/feed-status.tsx): every 10 seconds it asks
// GET /api/streams/<order id>?status=1, which checks again that this agency may watch. A 404 means the
// stream has ended and polling stops; a failed poll keeps the last known status. A word with an icon or
// the calm breathing dot, never colour alone, in a status region so a change is announced once.

export const statusPollMilliseconds = 10_000;

const statuses: readonly StreamStatus[] = ["active", "weak", "disconnected", "ended"];

const styles: Record<Exclude<StreamStatus, "active">, { Icon: LucideIcon; pill: string }> = {
  weak: { Icon: SignalMedium, pill: "bg-warning-surface text-warning" },
  disconnected: { Icon: WifiOff, pill: "bg-danger-surface text-danger" },
  ended: { Icon: CircleStop, pill: "bg-surface-sunken text-ink-muted" },
};

const isStatus = (value: unknown): value is StreamStatus => typeof value === "string" && (statuses as readonly string[]).includes(value);

export function LiveStatus({ orderId, initial }: { orderId: string; initial: StreamStatus }) {
  const t = useTranslations("AgencyLiveStream");
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
        console.error("[agency] could not poll the stream status of %s:", orderId, error);
      }
    }, statusPollMilliseconds);
    return () => window.clearInterval(timer);
  }, [orderId, ended]);

  const label = t(`status.${status}`);
  if (status === "active") {
    return (
      <span role="status" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-live-surface px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-live">
        <span aria-hidden="true" className="size-2 animate-breathe rounded-full bg-live-dot" />
        {label}
      </span>
    );
  }
  const { Icon, pill } = styles[status];
  return (
    <span role="status" className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${pill}`}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
