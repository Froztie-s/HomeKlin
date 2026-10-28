// The Supabase project the app talks to. Both values are public by design: the publishable key
// (sb_publishable_...) is safe in the browser, and row-level security decides what it may read.
// The secret key is for scripts and tests, and in the app only for Midtrans' payment notification
// (src/lib/supabase/service.ts), which has no signed-in user.
// Source: https://supabase.com/docs/guides/api/api-keys

export type SupabaseConfig = { url: string; publishableKey: string };

/** The project's URL and publishable key, or null when they are not set (for example in CI builds). */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && publishableKey ? { url, publishableKey } : null;
}

/** Supabase's session cookies: sb-<project ref>-auth-token, split into .0, .1 ... when large, and its PKCE code verifier. */
export function isSessionCookieName(name: string): boolean {
  return name.startsWith("sb-") && name.includes("-auth-token");
}

/** Like getSupabaseConfig, for code that cannot work without Supabase (signing in, reading a profile). */
export function requireSupabaseConfig(): SupabaseConfig {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return config;
}
