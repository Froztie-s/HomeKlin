import { defineConfig, devices } from "@playwright/test";

// Source: https://playwright.dev/docs/test-configuration and https://playwright.dev/docs/test-webserver
// Next.js recommends testing against a production build:
// node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md
const port = 3000;
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
  projects: [
    { name: "mobile", use: { ...devices["Pixel 9"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
