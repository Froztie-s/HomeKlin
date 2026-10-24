import { createClient } from "@supabase/supabase-js";
import { requireSupabaseConfig } from "./config";

// A Supabase client for public data (the catalog, T7): the publishable key and no session, so it reads
// no cookies and the page that uses it can stay prerendered. Row-level security still applies, as for
// any visitor who is not signed in.
// Source: https://supabase.com/docs/reference/javascript/initializing
export function createSupabasePublicClient() {
  const { url, publishableKey } = requireSupabaseConfig();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
