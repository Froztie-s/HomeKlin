import { createClient } from "@supabase/supabase-js";
import { requireSupabaseConfig } from "./config";

// A Supabase client that acts as HomeKlin's server itself, with the secret key (row-level security does
// not apply). Only for requests that come from a service, not from a signed-in person: Midtrans' payment
// notification (T11). The database function it calls is granted to this key alone. The key is
// server-only (SUPABASE_SECRET_KEY, never NEXT_PUBLIC_), so it never reaches a browser.
// Source: https://supabase.com/docs/guides/api/api-keys ("Secret keys")
export function createSupabaseServiceClient() {
  const { url } = requireSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not set: the payment notification cannot update orders.");
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
