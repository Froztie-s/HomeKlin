import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Source: https://playwright.dev/docs/test-configuration and https://playwright.dev/docs/test-webserver
// Next.js recommends testing against a production build:
// node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md

// Local runs read the test project's keys from .env; CI sets them from the repository secrets.
if (existsSync(".env")) process.loadEnvFile(".env");

// The suite signs up and signs in, so it must run against the test project, never the live one
// (markdown/SPEC.md, "Testing Strategy"). Missing keys fail the run instead of skipping it.
const testSupabaseUrl = process.env.TEST_SUPABASE_URL;
if (!testSupabaseUrl || !process.env.TEST_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("End-to-end tests need TEST_SUPABASE_URL and TEST_SUPABASE_PUBLISHABLE_KEY (see .env.example).");
}
if (testSupabaseUrl === process.env.NEXT_PUBLIC_SUPABASE_URL) {
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
  // Customer and cleaner pages are mobile-first; agency and admin pages are desktop-first.
  // `*.spec.ts` runs in both projects; `*.mobile.spec.ts` and `*.desktop.spec.ts` run only in theirs.
  projects: [
    { name: "mobile", use: { ...devices["Pixel 9"] }, testIgnore: /\.desktop\.spec\.ts$/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /\.mobile\.spec\.ts$/ },
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
