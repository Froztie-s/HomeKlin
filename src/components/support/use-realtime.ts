"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// A Supabase Realtime subscription for the help chat and the ticket inbox (T20, T21). The browser
// client is signed in as the visitor, and Realtime applies row-level security to every change, so a
// customer only ever receives their own tickets' rows and an admin every ticket's
// (supabase/migrations/20261104120000_support.sql).
// Each time the channel is (re)joined, `onJoin` runs: a change made between the server's render and the
// subscription, or while the connection was down, is not replayed by Realtime, so the caller reads the
// server's list again (router.refresh()). Effects stop when Next.js hides the page (Activity), so a
// hidden page holds no channel.
// Source: https://supabase.com/docs/guides/realtime/postgres-changes

export type LiveState = "connecting" | "connected" | "offline";

/** One kind of change to listen for, e.g. INSERT on ticket_messages for one ticket. */
export type ChangeFilter = {
  event: "INSERT" | "UPDATE" | "*";
  table: "ticket_messages" | "support_tickets";
  /** A Realtime filter such as "ticket_id=eq.<id>"; none for every row the user may read. */
  filter?: string;
};

export type Change = { table: string; eventType: string; new: unknown };

type Handlers = {
  onChange: (change: Change) => void;
  /** Runs on every successful (re)join. */
  onJoin: () => void;
};

// Baked in at build time, so the server's render and the browser's agree.
const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

/**
 * Listens for `changes` while the component is shown. `topic` names the subscription and must change
 * whenever `changes` does (it is the effect's only dependency); the handlers may change freely.
 */
export function useRealtime(topic: string, changes: readonly ChangeFilter[], handlers: Handlers): LiveState {
  const [state, setState] = useState<LiveState>(configured ? "connecting" : "offline");
  // The latest handlers and filters, so a re-render (new closures) does not resubscribe.
  const latest = useRef({ changes, handlers });
  useEffect(() => {
    latest.current = { changes, handlers };
  });

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let stopped = false;
    let channel: RealtimeChannel | null = null;

    async function join(supabase: SupabaseClient) {
      // The channel must join with the visitor's own token: joined without it (as an anonymous visitor),
      // row-level security lets nothing through. The client's own token hand-over can come after the
      // join, so the session's token is set first (as tests/integration/support.test.ts does).
      const { data } = await supabase.auth.getSession();
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      if (stopped) return;
      // A unique topic per mount, so Strict Mode's second mount never meets the first one's channel.
      const joined = supabase.channel(`${topic}:${crypto.randomUUID()}`);
      for (const { event, table, filter } of latest.current.changes) {
        joined.on(
          "postgres_changes",
          { event, schema: "public", table, ...(filter ? { filter } : {}) },
          (payload) => latest.current.handlers.onChange({ table: payload.table, eventType: payload.eventType, new: payload.new }),
        );
      }
      joined.subscribe((status) => {
        if (stopped) return;
        if (status === "SUBSCRIBED") {
          setState("connected");
          latest.current.handlers.onJoin();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setState("offline");
        }
      });
      channel = joined;
    }

    join(client).catch((error: unknown) => {
      console.error(error);
      if (!stopped) setState("offline");
    });
    return () => {
      stopped = true;
      if (channel) void client.removeChannel(channel);
    };
  }, [topic]);

  return state;
}
