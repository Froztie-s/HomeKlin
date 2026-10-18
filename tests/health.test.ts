import { describe, expect, it, vi } from "vitest";
import { checkHealth } from "@/lib/health";

const env = {
  supabaseUrl: "https://example.supabase.co",
  supabaseKey: "sb_publishable_test",
};

function fetchReturning(status: number) {
  return vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
}

describe("checkHealth", () => {
  it("reports ok when Supabase answers 2xx", async () => {
    const fetchFn = fetchReturning(200);

    const report = await checkHealth(env, fetchFn);

    expect(report).toEqual({ status: "ok", checks: { supabase: "ok" } });
  });

  it("calls the Supabase health endpoint with the key in the apikey header", async () => {
    const fetchFn = fetchReturning(200);

    await checkHealth({ ...env, supabaseUrl: "https://example.supabase.co/" }, fetchFn);

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://example.supabase.co/auth/v1/health");
    expect(new Headers(init?.headers).get("apikey")).toBe("sb_publishable_test");
  });

  it("reports unreachable when Supabase answers with an error status", async () => {
    const report = await checkHealth(env, fetchReturning(503));

    expect(report).toEqual({ status: "degraded", checks: { supabase: "unreachable" } });
  });

  it("reports unreachable when the request fails or times out", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("timed out", "TimeoutError"));

    const report = await checkHealth(env, fetchFn);

    expect(report).toEqual({ status: "degraded", checks: { supabase: "unreachable" } });
  });

  it("reports not_configured without calling Supabase when env vars are missing", async () => {
    const fetchFn = fetchReturning(200);

    const report = await checkHealth({ supabaseUrl: "", supabaseKey: undefined }, fetchFn);

    expect(report).toEqual({ status: "degraded", checks: { supabase: "not_configured" } });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
