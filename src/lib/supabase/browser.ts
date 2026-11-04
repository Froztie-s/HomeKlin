"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// A Supabase client in the browser, signed in as the visitor through the session cookies (readable by
// the browser by the library's default, kept at Checkpoint 1 for exactly this). Only for Realtime
// subscriptions (T20, T21): row-level security decides which changes reach it, as for any other read.
// Reads and writes still go through the server. One client per tab.
// Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client ("Client-side")

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createBrowserClient(url, key);
  return client;
}
