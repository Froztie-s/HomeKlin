import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { attachRecording, recordingsBucket } from "../../src/lib/recordings/attach";
import { adminClient } from "../../tests/integration/test-project";
import { createJobWorld, sessionOf, type JobWorld } from "../job-test-data";
import { standInClip } from "../recording-test-data";
import type { StorageState } from "../setup/auth-state";

// T27, T28 and T29 review screenshots: the agency's dashboard, "Jadwal" (a week with windows in two
// areas, and the remove confirmation), "Petugas" (the list and the form with a photo preview), "Pesanan"
// with the assign control, and "Rekaman" with a live tile and a recording playing. Desktop at 1280 and
// 1440 px, and phones at 360 and 390 px to check nothing scrolls sideways; both languages. Saved to
// docs/screenshots/t27/ as <surface>-<lang>-<width>.png (phones also -fold.png, the first screen).
// A fictional agency, its cleaners, jobs and windows are made in the Supabase test project and deleted
// at the end (e2e/job-test-data.ts). The windows lie 22 to 24 days ahead, past every seeded window and
// past the 14 days customers see. Run with: npm run screenshots -- t27

const dir = "docs/screenshots/t27";
type Device = "phone" | "desktop";
const widths: Record<Device, number[]> = { phone: [360, 390], desktop: [1280, 1440] };
const heights: Record<number, number> = { 360: 780, 390: 844, 1280: 800, 1440: 900 };
const languages = [
  ["id", ""],
  ["en", "/en"],
] as const;
const day = 86_400_000;

test.describe.configure({ mode: "serial" });

let world: JobWorld;
let session: StorageState;
let recordingId = "";
let agencyId = "";

const jakartaDate = (offsetDays: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(Date.now() + offsetDays * day),
  );
const at = (offsetDays: number, time: string) => new Date(`${jakartaDate(offsetDays)}T${time}:00+07:00`).toISOString();

test.beforeAll(async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const admin = adminClient();
  world = await createJobWorld("t27s");
  const agency = await world.agency("Kilau Contoh");
  agencyId = agency.id;
  await admin.from("agency_areas").insert({ agency_id: agency.id, area_id: "jakarta-pusat" });

  const rina = await world.cleaner(agency.id, "Rina Wulandari");
  await admin.from("cleaners").update({ photo_url: "/images/cleaner-avatar.jpg" }).eq("user_id", rina.id);
  const sari = await world.cleaner(agency.id, "Sari Utami");
  await world.cleaner(agency.id, "Dewi Lestari");

  await world.job({ agencyId: agency.id, cleaner: null, startsIn: 150, address: "Jl. Kenanga Contoh No. 7, Cakung, Jakarta Timur" });
  await world.job({ agencyId: agency.id, cleaner: sari, startsIn: 26 * 60, address: "Jl. Cempaka Contoh No. 3, Matraman, Jakarta Timur" });
  const live = await world.job({ agencyId: agency.id, cleaner: rina, startsIn: -30, address: "Jl. Flamboyan Contoh No. 21, Duren Sawit, Jakarta Timur", checkedInMinutesAgo: 20 });
  await admin.from("stream_sessions").insert({ order_id: live.id, cleaner_id: rina.id, agency_id: agency.id, source: "demo", status: "active" });
  const finished = await world.job({ agencyId: agency.id, cleaner: sari, startsIn: -240, address: "Jl. Mawar Contoh No. 15, Pulo Gadung, Jakarta Timur", completedMinutesAgo: 60 });
  await world.job({ agencyId: agency.id, cleaner: rina, startsIn: -400, address: "Jl. Dahlia Contoh No. 30, Cipayung, Jakarta Timur", completedMinutesAgo: 200 });
  await admin.storage.from(recordingsBucket).upload(standInClip.path, standInClip.bytes, { contentType: "video/mp4", upsert: true });
  recordingId = (await attachRecording(admin, finished.id)).id;

  // Windows in week 3 of the schedule, in both areas; one partly booked (no order needs it).
  await admin.from("availability_slots").insert([
    { agency_id: agency.id, area_id: "jakarta-timur", starts_at: at(22, "08:10"), ends_at: at(22, "10:10"), capacity: 3, booked: 1 },
    { agency_id: agency.id, area_id: "jakarta-timur", starts_at: at(22, "13:10"), ends_at: at(22, "15:10"), capacity: 2, booked: 0 },
    { agency_id: agency.id, area_id: "jakarta-pusat", starts_at: at(22, "09:10"), ends_at: at(22, "11:10"), capacity: 1, booked: 1 },
    { agency_id: agency.id, area_id: "jakarta-pusat", starts_at: at(23, "08:10"), ends_at: at(23, "10:10"), capacity: 2, booked: 0 },
  ]);

  session = await sessionOf(browser, baseURL, agency.user);
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  await world?.cleanup();
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
    storageState: session,
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

async function shootAll(browser: Browser, name: string, path: string, prepare?: (page: Page, lang: "id" | "en") => Promise<void>) {
  for (const device of ["desktop", "phone"] as const) {
    const context = await newContext(browser, device);
    const page = await context.newPage();
    for (const [lang, prefix] of languages) {
      await page.goto(`${prefix}${path}`);
      await settle(page);
      if (prepare) await prepare(page, lang);
      for (const width of widths[device]) await shoot(page, `${name}-${lang}`, width, device === "phone");
    }
    await context.close();
  }
}

test("the dashboard and the schedule", async ({ browser }) => {
  test.setTimeout(300_000);
  await shootAll(browser, "agency-dashboard", "/agency");
  await shootAll(browser, "agency-schedule", "/agency/schedule?week=3");
  await shootAll(browser, "agency-schedule-confirm", "/agency/schedule?week=3&area=jakarta-timur", async (page, lang) => {
    await page.getByRole("button", { name: lang === "id" ? /^Hapus jendela/ : /^Remove slot/ }).first().click();
  });
});

test("the cleaners, with a photo chosen in the form", async ({ browser }) => {
  test.setTimeout(240_000);
  await shootAll(browser, "agency-cleaners", "/agency/cleaners", async (page, lang) => {
    await page.getByLabel(lang === "id" ? "Nama lengkap" : "Full name").fill("Ayu Pratiwi");
    await page.getByLabel("Email").fill("ayu.pratiwi@example.com");
    await page.getByLabel(lang === "id" ? "Foto (opsional)" : "Photo (optional)").setInputFiles("public/images/cleaner-avatar.jpg");
  });
});

test("the orders with the assign control, and the recordings", async ({ browser }) => {
  test.setTimeout(300_000);
  await shootAll(browser, "agency-orders", "/agency/orders");
  await shootAll(browser, "agency-recordings", `/agency/recordings?recording=${recordingId}`);
  expect(agencyId).not.toBe("");
});
