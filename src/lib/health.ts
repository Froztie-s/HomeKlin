export type SupabaseCheck = "ok" | "unreachable" | "not_configured";

export type HealthReport = {
  status: "ok" | "degraded";
  checks: { supabase: SupabaseCheck };
};

type HealthEnv = {
  supabaseUrl: string | undefined;
  supabaseKey: string | undefined;
};

const TIMEOUT_MS = 5000;

export async function checkHealth(env: HealthEnv, fetchFn: typeof fetch = fetch): Promise<HealthReport> {
  const supabase = await checkSupabase(env, fetchFn);
  return { status: supabase === "ok" ? "ok" : "degraded", checks: { supabase } };
}

async function checkSupabase({ supabaseUrl, supabaseKey }: HealthEnv, fetchFn: typeof fetch): Promise<SupabaseCheck> {
  if (!supabaseUrl || !supabaseKey) return "not_configured";

  // Supabase does not document a health endpoint. /auth/v1/health is the Auth server's health
  // route (confirmed working against our project on 2026-10-18); keys go in the `apikey` header
  // (https://supabase.com/docs/guides/api/api-keys). A paused project fails this check.
  const url = new URL("/auth/v1/health", supabaseUrl);
  try {
    const response = await fetchFn(url.toString(), {
      headers: { apikey: supabaseKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    return response.ok ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}
