import { expect, test, type Browser, type Page } from "@playwright/test";
import { testProject } from "../tests/integration/test-project";
import { agencyMarks } from "./booking-test-data";
import { signInWithPassword } from "./order-test-data";
import { createReplayWorld, type ReplayWorld } from "./recording-test-data";
import type { StorageState } from "./setup/auth-state";

// T15 on a phone: a finished job's details show its Petugas HomeKlin and the job's progress, and replay
// the recording with "available until" and a countdown. A recording deleted after 7 days says so and
// has no player; a finished job without one says it has none. The list says until when a recording is
// kept. Another customer sees none of it, and the link to the file is never sent to them.
// The spec makes its own customers, cleaners and jobs (e2e/recording-test-data.ts): past windows of a
// throw-away agency in Jakarta Pusat that no other spec uses. Everything is removed at the end.
// The stand-in clip is 8 bytes, not a real video, so the spec checks that the player has the signed
// link and that the link answers, not that the browser plays it.

test.describe.configure({ mode: "serial", timeout: 120_000 });

const agencyWording = /agensi|agency|mitra|partner/i;
const signedLink = `${new URL(testProject.url).origin}/storage/v1/object/sign/recordings/jobs/`;

let world: ReplayWorld;
// Filled by beforeAll; the storageState fixture is also resolved for that hook, before they exist.
const sessions: { customer?: StorageState; other?: StorageState } = {};

async function signedIn(browser: Browser, baseURL: string | undefined, user: ReplayWorld["customer"]): Promise<StorageState> {
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  await signInWithPassword(await context.newPage(), user);
  const state = await context.storageState();
  await context.close();
  return state;
}

test.beforeAll(async ({ browser, baseURL }) => {
  world = await createReplayWorld("t15");
  sessions.customer = await signedIn(browser, baseURL, world.customer);
  sessions.other = await signedIn(browser, baseURL, world.other);
});

test.afterAll(async () => {
  await world?.cleanup();
});

const details = (page: Page, name = "Detail pesanan") => page.getByRole("region", { name });
const recording = (page: Page, name = "Rekaman") => page.getByRole("region", { name });
const rowOf = (page: Page, orderId: string, prefix = "") => page.locator(`a[href="${prefix}/orders?order=${orderId}"]`);

test.describe("the customer", () => {
  test.use({ storageState: async ({}, provide) => provide(sessions.customer) });

  test("replays their own recording, with until when it is kept and a countdown", async ({ page, request }) => {
    await page.goto(`/orders?order=${world.orders.available}`);
    const section = recording(page);
    await expect(section.getByRole("heading", { name: "Rekaman" })).toBeVisible();

    const video = section.locator("video");
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute("controls", "");
    await expect(video).toHaveAttribute("playsinline", "");
    await expect(video).toHaveAttribute("preload", "metadata");
    const src = (await video.getAttribute("src")) ?? "";
    expect(src.startsWith(`${signedLink}${world.orders.available}.`)).toBe(true);
    // The link plays: storage answers it, without any sign-in.
    const file = await request.get(src);
    expect(file.status()).toBe(200);

    await expect(section.getByText(/^Tersedia sampai \S+, \d{1,2} \S+, \d{2}\.\d{2} WIB$/)).toBeVisible();
    // Attached a moment ago, so the 7 days have only just started.
    await expect(section.getByText(/^(7 hari|6 hari 23 jam) lagi$/)).toBeVisible();
    await expect(section.getByText("Hanya Anda dan tim HomeKlin yang dapat memutar rekaman ini.", { exact: false })).toBeVisible();
  });

  test("sees the Petugas HomeKlin by name and photo, and the finished job's progress in words", async ({ page }) => {
    await page.goto(`/orders?order=${world.orders.available}`);
    const job = page.getByRole("region", { name: "Petugas HomeKlin" });
    await expect(job.getByText(world.cleaners.withPhoto.name, { exact: true })).toBeVisible();
    await expect(job.getByRole("img", { name: `Foto ${world.cleaners.withPhoto.name}` })).toBeVisible();
    const steps = job.getByRole("list", { name: "Perkembangan pekerjaan" }).getByRole("listitem");
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0)).toContainText("Petugas ditugaskan");
    await expect(steps.nth(1)).toContainText(/Check-in di alamat Anda pukul \d{2}\.\d{2} WIB/);
    await expect(steps.nth(2)).toContainText(/Selesai pukul \d{2}\.\d{2} WIB/);
    await expect(details(page).getByText("Pekerjaan ini sudah selesai.")).toBeVisible();
    // The reminder of what happens after payment has done its job.
    await expect(page.getByText("Setelah pembayaran")).toHaveCount(0);
  });

  test("sees that an expired recording was deleted after 7 days, with no player", async ({ page }) => {
    await page.goto(`/orders?order=${world.orders.expired}`);
    const section = recording(page);
    await expect(section.getByText("Rekaman sudah dihapus")).toBeVisible();
    await expect(section.getByText("Demi privasi Anda, rekaman dihapus otomatis 7 hari setelah pekerjaan selesai.")).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);
    expect(await page.content()).not.toContain("/storage/v1/object/sign/");

    // The cleaner without a photo is shown by initials.
    const job = page.getByRole("region", { name: "Petugas HomeKlin" });
    await expect(job.getByText(world.cleaners.withoutPhoto.name, { exact: true })).toBeVisible();
    await expect(job.getByText("SU", { exact: true })).toBeVisible();
  });

  test("sees that a finished job without a recording has none", async ({ page }) => {
    await page.goto(`/orders?order=${world.orders.none}`);
    await expect(recording(page).getByText("Rekaman tidak tersedia")).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);
  });

  test("the list says until when each recording is kept", async ({ page }) => {
    await page.goto("/orders");
    await expect(rowOf(page, world.orders.available)).toContainText(/Rekaman tersedia sampai \S+, \d{1,2} \S+, \d{2}\.\d{2} WIB/);
    await expect(rowOf(page, world.orders.expired)).toContainText("Rekaman sudah dihapus");
    await expect(rowOf(page, world.orders.none)).toContainText("Rekaman tidak tersedia");
    await expect(page.locator("video")).toHaveCount(0);
  });

  test("works in English", async ({ page }) => {
    await page.goto(`/en/orders?order=${world.orders.available}`);
    const section = recording(page, "Recording");
    await expect(section.locator("video")).toHaveCount(1);
    await expect(section.getByText(/^Available until \S+, \d{1,2} \S+, \d{2}\.\d{2} WIB$/)).toBeVisible();
    await expect(section.getByText(/^(7 days|6 days 23 hours) left$/)).toBeVisible();
    const job = page.getByRole("region", { name: "HomeKlin cleaner" });
    await expect(job.getByRole("list", { name: "Job progress" })).toContainText(/Finished at \d{2}\.\d{2} WIB/);

    await page.goto(`/en/orders?order=${world.orders.expired}`);
    await expect(recording(page, "Recording").getByText("The recording has been deleted")).toBeVisible();
    await expect(page.getByText("For your privacy, recordings are deleted automatically 7 days after the job ends.")).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);

    await page.goto("/en/orders");
    await expect(rowOf(page, world.orders.available, "/en")).toContainText(/Recording available until/);
    await expect(rowOf(page, world.orders.expired, "/en")).toContainText("Recording deleted");
  });

  test.describe("at 360 px", () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test("the list and the details have no sideways scroll and name no agency, in both languages", async ({ page }) => {
      const marks = [...(await agencyMarks()), world.agency.id, world.agency.name];
      for (const prefix of ["", "/en"]) {
        const paths = ["/orders", ...Object.values(world.orders).map((id) => `/orders?order=${id}`)];
        for (const path of paths.map((path) => `${prefix}${path}`)) {
          await page.context().clearCookies({ name: "NEXT_LOCALE" });
          await page.goto(path);
          await expect(page.getByText(/Rp\s[\d.]+/).first()).toBeVisible();
          await expect(page.getByText(/^(Memuat|Loading)/)).toHaveCount(0);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow, path).toBeLessThanOrEqual(0);

          const served = await (await page.request.get(path)).text();
          for (const html of [await page.content(), served]) {
            expect(html).not.toMatch(agencyWording);
            for (const mark of marks) expect(html).not.toContain(mark);
          }
          expect(await page.evaluate(() => document.body.innerText)).not.toMatch(agencyWording);
        }
      }
    });
  });
});

test.describe("another customer", () => {
  test.use({ storageState: async ({}, provide) => provide(sessions.other) });

  test("sees neither recording, nor the job, nor a link to the file", async ({ page }) => {
    for (const id of Object.values(world.orders)) {
      await page.goto(`/orders?order=${id}`);
      await expect(page.getByText("Belum ada pesanan")).toBeVisible();
      await expect(page.locator("video")).toHaveCount(0);
      const served = await (await page.request.get(`/orders?order=${id}`)).text();
      for (const html of [await page.content(), served]) {
        expect(html).not.toContain("/storage/v1/object/sign/");
        expect(html).not.toContain(world.cleaners.withPhoto.name);
        expect(html).not.toContain(world.recordings.available);
      }
    }
    // Nor does asking for the link directly help: it is "not found", as if there were no recording.
    for (const id of Object.values(world.recordings)) {
      expect((await page.request.get(`/api/recordings/${id}/link`)).status()).toBe(404);
    }
  });
});
