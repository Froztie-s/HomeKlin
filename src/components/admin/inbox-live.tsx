"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { LiveStatus } from "@/components/support/live-status";
import { useRealtime, type ChangeFilter } from "@/components/support/use-realtime";

type InboxLiveProps = {
  labels: { connected: string; connecting: string; offline: string; reload: string };
};

// Every new ticket, status change and message (T21): Realtime tells the inbox, which reads the list
// again from the server (router.refresh()), since the list's order, the customer's name and the message
// count come from the admin-only inbox function. Row-level security sends these rows to admins only.
// Changes that arrive together trigger one refresh.
const changes: ChangeFilter[] = [
  { event: "*", table: "support_tickets" },
  { event: "INSERT", table: "ticket_messages" },
];

export function InboxLive({ labels }: InboxLiveProps) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const state = useRealtime("inbox", changes, {
    onChange: () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    },
    onJoin: () => router.refresh(),
  });
  return <LiveStatus state={state} labels={labels} />;
}
