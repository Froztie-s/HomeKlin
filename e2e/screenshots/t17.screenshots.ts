import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createJobWorld, seededAgencyId, sessionOf, type JobWorld } from "../job-test-data";
import type { StorageState } from "../setup/auth-state";

// T17 and T18 review screenshots: the cleaner's job list with every state (ready to check in, not open
// yet, check-in time passed, in progress, finished, a later day), its empty state, a refused location and
// the check-out confirm step; the agency's orders and admin's "Pekerjaan hari ini" with each status.
// Two phone and two desktop widths, both languages. Saved to docs/screenshots/t17/:
//   <surface>-<lang>-<width>.png       the whole page, with fixed bars where they really sit
//   <surface>-<lang>-<width>-fold.png  phones only: the first screen exactly as it opens
// Fictional users, an agency and paid jobs are made for the run in the Supabase test project and deleted
// at the end (e2e/job-test-data.ts). Run with: npm run screenshots -- t17

const dir = "docs/screenshots/t17";
type Device = "phone" | "desktop";
const widths: Record<Device, number[]> = { phone: [360, 390], desktop: [1280, 1440] };
const heights: Record<number, number> = { 360: 780, 390: 844, 1280: 800, 1440: 900 };
const languages = [
  ["id", ""],
  ["en", "/en"],
] as const;

test.describe.configure({ mode: "serial" });

let world: JobWorld;
const sessions: Record<"cleaner" | "idle" | "agency" | "admin", StorageState> = {} as never;
const address = {
  open: "Jl. Kenanga Contoh No. 7, RT 02/RW 04, Cakung, Jakarta Timur",
  started: "Jl. Flamboyan Contoh No. 21, Duren Sawit, Jakarta Timur",
};

test.beforeAll(async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  world = await createJobWorld("t17s");
  const seeded = await seededAgencyId();
  const cleaner = await world.cleaner(seeded, "Uji Petugas Foto");
  const idle = await world.cleaner(seeded, "Uji Petugas Kosong");
  await world.job({ agencyId: seeded, cleaner, startsIn: 5, address: address.open });
  await world.job({ agencyId: seeded, cleaner, startsIn: -40, address: address.started, checkedInMinutesAgo: 25 });
  await world.job({ agencyId: seeded, cleaner, startsIn: 100, address: "Jl. Cempaka Contoh No. 3, Matraman, Jakarta Timur" });
  await world.job({ agencyId: seeded, cleaner, startsIn: -200, address: "Jl. Mawar Contoh No. 15, Pulo Gadung, Jakarta Timur" });
  await world.job({ agencyId: seeded, cleaner, startsIn: 26 * 60, address: "Jl. Anggrek Contoh No. 9, Jatinegara, Jakarta Timur" });
  await world.job({ agencyId: seeded, cleaner, startsIn: -150, address: "Jl. Dahlia Contoh No. 30, Cipayung, Jakarta Timur", completedMinutesAgo: 20 });

  const agency = await world.agency("Uji Agensi Foto");
  const own = await world.cleaner(agency.id, "Uji Petugas Agensi");
  await world.job({ agencyId: agency.id, cleaner: null, startsIn: 90, address: "Jl. Teratai Contoh No. 2, Cakung, Jakarta Timur" });
  await world.job({ agencyId: agency.id, cleaner: own, startsIn: 60, address: "Jl. Melur Contoh No. 4, Cakung, Jakarta Timur" });
  await world.job({ agencyId: agency.id, cleaner: own, startsIn: -30, address: "Jl. Kamboja Contoh No. 6, Cakung, Jakarta Timur", checkedInMinutesAgo: 20 });
  await world.job({ agencyId: agency.id, cleaner: own, startsIn: -180, address: "Jl. Seroja Contoh No. 8, Cakung, Jakarta Timur", completedMinutesAgo: 30 });
  await world.job({ agencyId: agency.id, cleaner: own, startsIn: 27 * 60, address: "Jl. Bougenville Contoh No. 10, Cakung, Jakarta Timur" });

  sessions.cleaner = await sessionOf(browser, baseURL, cleaner);
  sessions.idle = await sessionOf(browser, baseURL, idle);
  sessions.agency = await sessionOf(browser, baseURL, agency.user);
  sessions.admin = await sessionOf(browser, baseURL, await world.admin("Uji Admin Foto"));
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  await world?.cleanup();
});

async function newContext(browser: Browser, device: Device, storageState: StorageState): Promise<BrowserContext> {
  const width = widths[device][0];
  const mobile = device === "phone";
  return browser.newContext({
    viewport: { width, height: heights[width] },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: "reduce",
    storageState,
  });
}

async function settle(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^(Memuat|Loading)/)).toHaveCount(0);
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

async function shootAll(browser: Browser, name: string, path: string, storageState: StorageState) {
  for (const device of ["phone", "desktop"] as const) {
    const context = await newContext(browser, device, storageState);
    const page = await context.newPage();
    for (const [lang, prefix] of languages) {
      await page.goto(`${prefix}${path}`);
      for (const width of widths[device]) await shoot(page, `${name}-${lang}`, width, device === "phone");
    }
    await context.close();
  }
}

test("the cleaner's job list and its empty state", async ({ browser }) => {
  test.setTimeout(240_000);
  await shootAll(browser, "cleaner-jobs", "/cleaner", sessions.cleaner);
  await shootAll(browser, "cleaner-empty", "/cleaner", sessions.idle);
});

test("a refused location and the check-out confirm step, on phones", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await newContext(browser, "phone", sessions.cleaner);
  const page = await context.newPage();
  for (const [lang, prefix] of languages) {
    await page.goto(`${prefix}/cleaner`);
    await settle(page);
    const open = page.getByRole("article").filter({ hasText: address.open });
    await open.getByRole("button", { name: "Check-in" }).click();
    await expect(open.getByRole("alert")).not.toBeEmpty({ timeout: 20_000 });
    await open.scrollIntoViewIfNeeded();
    for (const width of widths.phone) {
      await page.setViewportSize({ width, height: heights[width] });
      await open.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${dir}/cleaner-location-denied-${lang}-${width}-fold.png` });
    }

    const started = page.getByRole("article").filter({ hasText: address.started });
    await started.getByRole("button", { name: "Check-out" }).click();
    await expect(started.getByRole("group")).toBeVisible();
    for (const width of widths.phone) {
      await page.setViewportSize({ width, height: heights[width] });
      await started.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${dir}/cleaner-check-out-confirm-${lang}-${width}-fold.png` });
    }
  }
  await context.close();
});

test("the agency's orders and admin's jobs of today", async ({ browser }) => {
  test.setTimeout(240_000);
  await shootAll(browser, "agency-orders", "/agency/orders", sessions.agency);
  await shootAll(browser, "admin-dashboard", "/admin", sessions.admin);
});
