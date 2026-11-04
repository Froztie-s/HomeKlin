import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retentionDaysFromEnv } from "@/lib/recordings/retention";

// The daily cleanup endpoint (T16, src/app/api/cron/recordings/route.ts) with a stand-in cleanup: only
// a request carrying Vercel's CRON_SECRET starts it. And the retention setting.

const { deleteExpiredRecordings } = vi.hoisted(() => ({ deleteExpiredRecordings: vi.fn() }));
vi.mock("@/lib/recordings/retention", async (original) => ({
  ...(await original<typeof import("@/lib/recordings/retention")>()),
  deleteExpiredRecordings,
}));
vi.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: () => ({}) }));

const { GET } = await import("@/app/api/cron/recordings/route");

const call = async (authorization?: string) => {
  const headers = authorization ? { authorization } : undefined;
  const response = await GET(new Request("https://homeklin.test/api/cron/recordings", { headers }));
  return { status: response.status, body: await response.json() };
};

describe("GET /api/cron/recordings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "a-long-random-test-secret");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    deleteExpiredRecordings.mockResolvedValue({ deleted: 3 });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("runs the cleanup for Vercel's cron request", async () => {
    expect(await call("Bearer a-long-random-test-secret")).toEqual({ status: 200, body: { deleted: 3 } });
  });

  it.each([[undefined], ["Bearer wrong"], ["a-long-random-test-secret"]])("refuses %s", async (authorization) => {
    expect((await call(authorization)).status).toBe(401);
    expect(deleteExpiredRecordings).not.toHaveBeenCalled();
  });

  it("does not run without a secret, and asks to retry when the cleanup fails", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "a-long-random-test-secret");
    deleteExpiredRecordings.mockRejectedValue(new Error("storage down"));
    expect(await call("Bearer a-long-random-test-secret")).toEqual({ status: 503, body: { error: "unavailable" } });
  });
});

describe("retentionDaysFromEnv", () => {
  it("is 7 days unless set to a positive number", () => {
    expect(retentionDaysFromEnv(undefined)).toBe(7);
    expect(retentionDaysFromEnv("")).toBe(7);
    expect(retentionDaysFromEnv("0")).toBe(7);
    expect(retentionDaysFromEnv("abc")).toBe(7);
    expect(retentionDaysFromEnv("0.0007")).toBe(0.0007);
  });
});
