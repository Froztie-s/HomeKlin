import { expect, test } from "@playwright/test";

// Supabase may be unconfigured (CI) or paused, so 503 is a valid answer here.
// What must hold everywhere: a JSON report, computed per request, never cached.
test("health endpoint returns an uncached JSON report", async ({ request }) => {
  const response = await request.get("/api/health");

  expect([200, 503]).toContain(response.status());
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.json();
  expect(["ok", "degraded"]).toContain(body.status);
  expect(["ok", "unreachable", "not_configured"]).toContain(body.checks.supabase);
});
