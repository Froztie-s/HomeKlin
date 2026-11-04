import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { recordingsBucket } from "../../src/lib/recordings/attach";
import { adminClient } from "../../tests/integration/test-project";
import { signInWithPassword } from "../order-test-data";
import { createReplayWorld, type ReplayWorld } from "../recording-test-data";

// T15 review screenshots: a finished job's details with its Petugas HomeKlin, progress and recording
// (player, until when it is kept, countdown), one whose recording was deleted after 7 days, one without
// a recording, and the order list saying until when each is kept. Two phone and two desktop widths, in
// both languages. Saved to docs/screenshots/t15/:
//   <surface>-<lang>-<width>.png       the whole page, with fixed bars where they really sit
//   <surface>-<lang>-<width>-fold.png  phones only: the first screen exactly as it opens
// The data comes from e2e/recording-test-data.ts and is removed at the end. So the player shows a real
// frame, the job's own copy of the stand-in clip is replaced by a 2-second clip the browser records
// from one of the site's photos (it is that job's file only; the library clip is not touched).
// Run with: npm run screenshots -- t15

const dir = "docs/screenshots/t15";
type Device = "phone" | "desktop";
const widths: Record<Device, number[]> = { phone: [360, 390], desktop: [1280, 1440] };
const heights: Record<number, number> = { 360: 780, 390: 844, 1280: 800, 1440: 900 };

test.describe.configure({ mode: "serial" });

let world: ReplayWorld;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  world = await createReplayWorld("t15-shots");
});

test.afterAll(async () => {
  await world?.cleanup();
});

/** Records a short webm clip of a site photo in the browser (MediaRecorder), as bytes. */
async function sampleClip(page: Page): Promise<Uint8Array> {
  await page.goto("/");
  const base64 = await page.evaluate(async () => {
    const image = new Image();
    image.src = "/images/hero-wiping-counter.jpg";
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas");
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
    const draw = () =>
      context.drawImage(image, (canvas.width - image.width * scale) / 2, (canvas.height - image.height * scale) / 2, image.width * scale, image.height * scale);
    draw();
    const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    recorder.start();
    const timer = setInterval(draw, 66);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    clearInterval(timer);
    recorder.stop();
    await done;
    const bytes = new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  });
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

async function newContext(browser: Browser, device: Device): Promise<BrowserContext> {
  const width = widths[device][0];
  const mobile = device === "phone";
  const context = await browser.newContext({
    viewport: { width, height: heights[width] },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await signInWithPassword(page, world.customer);
  await page.close();
  return context;
}

async function shoot(page: Page, name: string, width: number, mobile: boolean) {
  await page.setViewportSize({ width, height: heights[width] });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^(Memuat|Loading)/)).toHaveCount(0);
  const video = page.locator("video");
  if ((await video.count()) > 0) {
    // The first frame is on screen, and the player has no problem to report.
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThanOrEqual(2);
    await expect(page.getByRole("button", { name: /Muat ulang video|Reload video/ })).toHaveCount(0);
  }
  await page.evaluate(() => document.fonts.ready);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width);
  if (mobile) await page.screenshot({ path: `${dir}/${name}-${width}-fold.png` });
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.max(pageHeight, heights[width]) });
  await page.screenshot({ path: `${dir}/${name}-${width}.png` });
  await page.setViewportSize({ width, height: heights[width] });
}

const languages = [
  ["id", ""],
  ["en", "/en"],
] as const;

test("the replay, the expired and missing recordings, and the list", async ({ browser, page }) => {
  test.setTimeout(400_000);
  const clip = await sampleClip(page);
  const replaced = await adminClient()
    .storage.from(recordingsBucket)
    .upload(world.availableFile, clip, { contentType: "video/webm", upsert: true });
  expect(replaced.error).toBeNull();

  for (const device of ["phone", "desktop"] as const) {
    const context = await newContext(browser, device);
    const tab = await context.newPage();
    for (const [lang, prefix] of languages) {
      const surfaces: [string, string][] = [
        ["list", `${prefix}/orders`],
        ["details-recording", `${prefix}/orders?order=${world.orders.available}`],
        ["details-expired", `${prefix}/orders?order=${world.orders.expired}`],
        ["details-no-recording", `${prefix}/orders?order=${world.orders.none}`],
      ];
      for (const [name, path] of surfaces) {
        await tab.context().clearCookies({ name: "NEXT_LOCALE" });
        await tab.goto(path);
        for (const width of widths[device]) await shoot(tab, `${name}-${lang}`, width, device === "phone");
      }
    }
    await context.close();
  }
});
