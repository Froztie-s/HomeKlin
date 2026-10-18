import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// Review screenshots, kept apart from the e2e suite so a normal test run never overwrites the
// evidence saved for an earlier task. Run one task's set with: npm run screenshots -- t3
export default defineConfig({
  ...base,
  testDir: "./e2e/screenshots",
  testMatch: "**/*.screenshots.ts",
  retries: 0,
  projects: [{ name: "screenshots", use: { ...devices["Desktop Chrome"] } }],
});
