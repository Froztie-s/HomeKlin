import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Source: https://playwright.dev/docs/test-configuration and https://playwright.dev/docs/test-webserver
// Next.js recommends testing against a production build:
// node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md

// Local runs read the test project's keys from .env; CI sets them from the repository secrets.
if (existsSync(".env")) process.loadEnvFile(".env");

// The suite signs up and signs in, so it must run against the test project, never the live one
// (markdown/SPEC.md, "Testing Strategy"). Missing keys fail the run instead of skipping it. The setup
// project also needs TEST_SUPABASE_SECRET_KEY to create its users (tests/integration/test-project.ts).
const testSupabaseUrl = process.env.TEST_SUPABASE_URL;
if (!testSupabaseUrl || !process.env.TEST_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("End-to-end tests need TEST_SUPABASE_URL and TEST_SUPABASE_PUBLISHABLE_KEY (see .env.example).");
}
// Hosts compared, so a trailing slash or different capitals cannot hide the same project.
const liveSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (liveSupabaseUrl && new URL(testSupabaseUrl).host.toLowerCase() === new URL(liveSupabaseUrl).host.toLowerCase()) {
  throw new Error("TEST_SUPABASE_URL is the live project's URL. End-to-end tests must use the test project.");
}

// PW_PORT lets two checkouts (git worktrees) run the suite at the same time on different ports.
const port = Number(process.env.PW_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    // Before the suite, "setup" signs in one test user per role and saves each session; after it,
    // "teardown" deletes those users (e2e/setup/). No project has a default storageState: a spec opens
    // protected pages with test.use(signedInAs.<role>) from e2e/setup/auth-state.ts, and every other
    // spec, such as the sign-in specs, starts signed out. Their own testDir keeps them out of the
    // device projects and lets another config reuse them.
    // Source: https://playwright.dev/docs/test-global-setup-teardown ("Option 1: Project Dependencies")
    { name: "setup", testDir: "./e2e/setup", testMatch: /auth\.setup\.ts$/, teardown: "teardown" },
    { name: "teardown", testDir: "./e2e/setup", testMatch: /auth\.teardown\.ts$/ },
    // Customer and cleaner pages are mobile-first; agency and admin pages are desktop-first.
    // `*.spec.ts` runs in both projects; `*.mobile.spec.ts` and `*.desktop.spec.ts` run only in theirs.
    {
      name: "mobile",
      use: { ...devices["Pixel 9"] },
      testIgnore: /\.desktop\.spec\.ts$/,
      dependencies: ["setup"],
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /\.mobile\.spec\.ts$/,
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    url: baseURL,
    // Always build and start a fresh server: a server already running on this port (`npm run dev`, or
    // another checkout's) could be talking to the live project.
    reuseExistingServer: false,
    timeout: 180_000,
    // The app under test talks to the separate Supabase test project, never the live one
    // (markdown/SPEC.md, "Testing Strategy"). NEXT_PUBLIC_ values are baked in at build time, which is
    // why they are set for this command (it builds, then starts). Playwright merges this over process.env.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: testSupabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.TEST_SUPABASE_PUBLISHABLE_KEY,
    },
  },
});
