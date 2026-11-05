import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUsers, testProject, type TestUser } from "../../tests/integration/test-project";
import { createJobWorld, seededAgencyId, sessionOf, type JobWorld } from "../job-test-data";
import { standInClip } from "../recording-test-data";
import type { StorageState } from "../setup/auth-state";

// T22 and T23 review screenshots. The cleaner's job card in progress: stream off, live (Aktif, Sinyal
// lemah, Terputus) and stopped. The customer's live view on the order's details and on /orders/live in
// each state (active, weak, disconnected, waiting for the cleaner, ended), the order list's line for a
// job in progress, a finished job's pointer to its recording, and another customer's refusal. Two phone
// and two desktop widths, both languages. Saved to docs/screenshots/t22/:
//   <surface>-<lang>-<width>.png       the whole page
//   <surface>-<lang>-<width>-fold.png  phones only: the first screen, or the card scrolled into view
// The library's stand-in clip is 8 bytes and plays nothing, so for these pictures only the signed clip
// link is answered with a short calm picture drawn in the browser (a room-coloured gradient); the link
// itself is still made by the server for the right customer. Fictional users and jobs are made in the
// Supabase test project and deleted at the end. Run with: npm run screenshots -- t22

const dir = "docs/screenshots/t22";
type Device = "phone" | "desktop";
const widths: Record<Device, number[]> = { phone: [360, 390], desktop: [1280, 1440] };
const heights: Record<number, number> = { 360: 780, 390: 844, 1280: 800, 1440: 900 };
const languages = [
  ["id", ""],
  ["en", "/en"],
] as const;
const clipLinks = `${new URL(testProject.url).origin}/storage/v1/object/sign/recordings/library/**`;
const address = "Jl. Kenanga Contoh No. 7, RT 02/RW 04, Cakung, Jakarta Timur";

test.describe.configure({ mode: "serial" });

let world: JobWorld;
let other: TestUser;
let job: { id: string };
let finished: { id: string };
let feed: Buffer;
const sessions: Record<"cleaner" | "customer" | "other", StorageState> = {} as never;

test.beforeAll(async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  world = await createJobWorld("t22s");
  const agencyId = await seededAgencyId();
  const cleaner = await world.cleaner(agencyId, "Rina Wulandari");
  job = await world.job({ agencyId, cleaner, startsIn: -30, checkedInMinutesAgo: 22, address });
  finished = await world.job({ agencyId, cleaner, startsIn: -260, completedMinutesAgo: 40, address: "Jl. Dahlia Contoh No. 30, Cipayung, Jakarta Timur" });
  other = await createTestUser("t22s-other", { full_name: "Uji Pelanggan Lain" });
  await adminClient().storage.from("recordings").upload(standInClip.path, standInClip.bytes, { contentType: "video/mp4", upsert: true });
  sessions.cleaner = await sessionOf(browser, baseURL, cleaner);
  sessions.customer = await sessionOf(browser, baseURL, world.customer);
  sessions.other = await sessionOf(browser, baseURL, other);
  feed = await drawFeed(browser);
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  await world?.cleanup();
  if (other) await deleteTestUsers([other]);
});

/** Two seconds of a calm, room-coloured picture, recorded in the browser as WebM. */
async function drawFeed(browser: Browser): Promise<Buffer> {
  const page = await browser.newPage();
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext("2d")!;
    const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.start();
    for (let frame = 0; frame < 30; frame += 1) {
      const wall = context.createLinearGradient(0, 0, 0, 360);
      wall.addColorStop(0, "#e9efe9");
      wall.addColorStop(1, "#c9d8cf");
      context.fillStyle = wall;
      context.fillRect(0, 0, 640, 360);
      context.fillStyle = "#f7f4ea";
      context.fillRect(380, 50, 180, 140);
      context.fillStyle = "#a9bfb2";
      context.fillRect(0, 270, 640, 90);
      context.fillStyle = "#8aa597";
      context.fillRect(60 + frame, 200, 220, 80);
      await new Promise((resolve) => setTimeout(resolve, 66));
    }
    recorder.stop();
    await new Promise((resolve) => (recorder.onstop = resolve));
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  await page.close();
  return Buffer.from(bytes);
}

async function newContext(browser: Browser, device: Device, storageState: StorageState): Promise<BrowserContext> {
  const width = widths[device][0];
  const mobile = device === "phone";
  const context = await browser.newContext({
    viewport: { width, height: heights[width] },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: "reduce",
    storageState,
  });
  await context.route(clipLinks, (route) => route.fulfill({ status: 200, body: feed, contentType: "video/webm" }));
  return context;
}

async function settle(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^(Memuat|Loading)/)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  // Let a video show its first picture.
  await page.evaluate(async () => {
    const videos = [...document.querySelectorAll("video")];
    await Promise.all(
      videos.map((video) =>
        video.readyState >= 2 ? null : new Promise((resolve) => {
          video.addEventListener("loadeddata", resolve, { once: true });
          setTimeout(resolve, 5_000);
        }),
      ),
    );
  });
}

async function shoot(page: Page, name: string, width: number, mobile: boolean, focus?: Locator) {
  await page.setViewportSize({ width, height: heights[width] });
  await settle(page);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, `${name} at ${width} px scrolls sideways`).toBeLessThanOrEqual(width);
  if (mobile) {
    if (focus) await focus.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: `${dir}/${name}-${width}-fold.png` });
  }
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.max(pageHeight, heights[width]) });
  await page.screenshot({ path: `${dir}/${name}-${width}.png` });
  await page.setViewportSize({ width, height: heights[width] });
}

async function shootWidths(page: Page, device: Device, name: string, focus?: Locator) {
  for (const width of widths[device]) await shoot(page, name, width, device === "phone", focus);
}

async function setStream(status: "active" | "weak" | "disconnected" | "ended") {
  const { error } = await adminClient()
    .from("stream_sessions")
    .update({ status, ended_at: status === "ended" ? new Date().toISOString() : null })
    .eq("order_id", job.id);
  if (error) throw new Error(`Could not set the stream: ${error.message}`);
}

test("the cleaner's stream controls in every state", async ({ browser }) => {
  test.setTimeout(300_000);
  for (const device of ["phone", "desktop"] as const) {
    const context = await newContext(browser, device, sessions.cleaner);
    const page = await context.newPage();
    for (const [lang, prefix] of languages) {
      await page.goto(`${prefix}/cleaner`);
      await settle(page);
      const card = page.getByRole("article").filter({ hasText: address });
      const stream = card.getByRole("region");
      const press = async (id: string, en: string) => card.getByRole("button", { name: lang === "id" ? id : en }).click();
      await shootWidths(page, device, `cleaner-off-${lang}`, stream);
      await press("Mulai siaran", "Start stream");
      await expect(card.getByText("LIVE", { exact: true })).toBeVisible({ timeout: 15_000 });
      await shootWidths(page, device, `cleaner-active-${lang}`, stream);
      await press("Sinyal lemah", "Weak signal");
      await expect(card.getByRole("button", { name: lang === "id" ? "Sambung lagi" : "Reconnect" })).toBeVisible({ timeout: 15_000 });
      await shootWidths(page, device, `cleaner-weak-${lang}`, stream);
      await press("Terputus", "Disconnected");
      await expect(card.getByRole("status").filter({ hasText: lang === "id" ? "Terputus" : "Disconnected" })).toBeVisible({ timeout: 15_000 });
      await shootWidths(page, device, `cleaner-disconnected-${lang}`, stream);
      await press("Hentikan siaran", "Stop stream");
      await expect(card.getByRole("button", { name: lang === "id" ? "Mulai siaran" : "Start stream" })).toBeVisible({ timeout: 15_000 });
      await shootWidths(page, device, `cleaner-stopped-${lang}`, stream);
    }
    await context.close();
  }
});

test("the customer's live view in every state", async ({ browser }) => {
  test.setTimeout(400_000);
  for (const device of ["phone", "desktop"] as const) {
    const context = await newContext(browser, device, sessions.customer);
    const page = await context.newPage();
    for (const [lang, prefix] of languages) {
      const liveRegion = page.getByRole("region", { name: lang === "id" ? "Tonton langsung" : "Watch live" });
      for (const status of ["active", "weak", "disconnected"] as const) {
        await setStream(status);
        await page.goto(`${prefix}/orders?order=${job.id}`);
        await shootWidths(page, device, `details-${status}-${lang}`, liveRegion);
      }
      await setStream("active");
      await page.goto(`${prefix}/orders/live?order=${job.id}`);
      await shootWidths(page, device, `live-page-active-${lang}`);

      // Ended while the customer watches: the next poll replaces the picture.
      await setStream("ended");
      await expect(page.getByText(lang === "id" ? "Siaran sudah berakhir" : "The stream has ended")).toBeVisible({ timeout: 25_000 });
      await shootWidths(page, device, `live-page-ended-${lang}`);

      // Opened while there is no stream: waiting for the cleaner.
      await page.goto(`${prefix}/orders?order=${job.id}`);
      await shootWidths(page, device, `details-waiting-${lang}`, liveRegion);

      await page.goto(`${prefix}/orders/live?order=${finished.id}`);
      await shootWidths(page, device, `live-page-finished-${lang}`);

      await page.goto(`${prefix}/orders`);
      await shootWidths(page, device, `list-${lang}`);
    }
    await context.close();
  }
});

test("another customer is refused", async ({ browser }) => {
  test.setTimeout(180_000);
  for (const device of ["phone", "desktop"] as const) {
    const context = await newContext(browser, device, sessions.other);
    const page = await context.newPage();
    for (const [lang, prefix] of languages) {
      await page.goto(`${prefix}/orders/live?order=${job.id}`);
      await shootWidths(page, device, `live-page-refused-${lang}`);
    }
    await context.close();
  }
});
