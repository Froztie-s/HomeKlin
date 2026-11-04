import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createConsoleWorld, type ConsoleWorld } from "../admin-console-test-data";
import { sessionOf } from "../job-test-data";
import type { StorageState } from "../setup/auth-state";

// T24-T26 review screenshots: the admin dashboard (tiles, today's jobs, latest open tickets), the live
// monitor with its feeds, and the recordings list, a recording playing and a deleted one. Desktop
// first (1280 and 1440 px); the phone widths (360 and 390 px) prove nothing scrolls sideways. Both
// languages. Saved to docs/screenshots/t24/:
//   <surface>-<lang>-<width>.png       the whole page
//   <surface>-<lang>-<width>-fold.png  phones only: the first screen exactly as it opens
// Fictional users, an agency, jobs, streams, recordings and a ticket are made for the run in the
// Supabase test project and deleted at the end (e2e/admin-console-test-data.ts). Other runs share the
// project, so the pages may show their data too. The stand-in clip is 8 bytes, not a real video, so
// each feed shows that it cannot play. Run with: npm run screenshots -- t24

const dir = "docs/screenshots/t24";
type Device = "phone" | "desktop";
const widths: Record<Device, number[]> = { phone: [360, 390], desktop: [1280, 1440] };
const heights: Record<number, number> = { 360: 780, 390: 844, 1280: 800, 1440: 900 };
const languages = [
  ["id", ""],
  ["en", "/en"],
] as const;

test.describe.configure({ mode: "serial" });

let data: ConsoleWorld;
let admin: StorageState;

test.beforeAll(async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  data = await createConsoleWorld("t24s");
  admin = await sessionOf(browser, baseURL, data.admin);
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  await data?.cleanup();
});

async function newContext(browser: Browser, device: Device): Promise<BrowserContext> {
  const width = widths[device][0];
  const mobile = device === "phone";
  return browser.newContext({
    viewport: { width, height: heights[width] },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: "reduce",
    storageState: admin,
  });
}

async function settle(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^(Memuat|Loading)/)).toHaveCount(0);
  // Each feed tries its link, then a fresh one, before it says it cannot play.
  await expect(page.getByText(/^(Memuat ulang|Reloading)/)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

async function shoot(page: Page, name: string, width: number, mobile: boolean) {
  await page.setViewportSize({ width, height: heights[width] });
  await settle(page);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, `${name} at ${width} px scrolls sideways`).toBeLessThanOrEqual(width);
  if (mobile) await page.screenshot({ path: `${dir}/${name}-${width}-fold.png` });
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.max(pageHeight, heights[width]) });
  await page.screenshot({ path: `${dir}/${name}-${width}.png` });
  await page.setViewportSize({ width, height: heights[width] });
}

async function shootAll(browser: Browser, name: string, path: string) {
  for (const device of ["phone", "desktop"] as const) {
    const context = await newContext(browser, device);
    const page = await context.newPage();
    for (const [lang, prefix] of languages) {
      await page.goto(`${prefix}${path}`);
      for (const width of widths[device]) await shoot(page, `${name}-${lang}`, width, device === "phone");
    }
    await context.close();
  }
}

test("the admin dashboard", async ({ browser }) => {
  test.setTimeout(240_000);
  await shootAll(browser, "admin-dashboard", "/admin");
});

test("the live monitor", async ({ browser }) => {
  test.setTimeout(240_000);
  await shootAll(browser, "admin-monitor", "/admin/monitor");
});

test("the recordings: the list, one playing and a deleted one", async ({ browser }) => {
  test.setTimeout(360_000);
  await shootAll(browser, "admin-recordings", "/admin/recordings");
  await shootAll(browser, "admin-recording-playing", `/admin/recordings?recording=${data.recorded.available.recordingId}`);
  await shootAll(browser, "admin-recording-deleted", `/admin/recordings?recording=${data.recorded.expired.recordingId}`);
});
