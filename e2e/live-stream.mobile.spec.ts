import { expect, request as apiRequest, test, type Browser, type Page } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUsers, testProject, type TestUser } from "../tests/integration/test-project";
import { agencyMarks } from "./booking-test-data";
import { createJobWorld, jakartaClock, seededAgencyId, sessionOf, type JobWorld } from "./job-test-data";
import { standInClip } from "./recording-test-data";
import type { StorageState } from "./setup/auth-state";

// T22 and T23 on a phone. The cleaner starts the stream of a job in progress from its card, sees it
// live with its state in words (Aktif, Sinyal lemah, Terputus), simulates a weak signal and a drop, and
// stops it. The customer of that job watches it on the order's details and on /orders/live?order=<id>:
// the video comes from a signed storage link made on the server, and the polled state shows over it.
// Another customer opening the same address, or asking the API, gets "not available", with no link in
// the page; signed out, the API answers 401. Check-out ends the stream.
// The spec makes its own cleaner, customers and job in the shared test project (e2e/job-test-data.ts)
// and removes them at the end. The library's stand-in clip (8 bytes, not a real video) is upserted and
// kept, because other specs share it; the spec checks the link answers, not that the browser plays it.

test.describe.configure({ mode: "serial", timeout: 120_000 });

const agencyWording = /agensi|agency|mitra|partner/i;
const libraryLink = `${new URL(testProject.url).origin}/storage/v1/object/sign/recordings/library/`;
const signedPath = "/storage/v1/object/sign/";
const address = "Jl. Uji Siaran No. 22, Cakung, Jakarta Timur";
const cleanerName = "Uji Petugas Siaran";
// Polling runs every 10 seconds; give a change two rounds to show.
const polled = { timeout: 25_000 };

let world: JobWorld;
let other: TestUser;
let job: { id: string };
const sessions: { cleaner?: StorageState; customer?: StorageState; other?: StorageState } = {};
// The cleaner keeps one tab open for the whole job, as on the phone: the card remembers the stream it
// started in this tab (src/components/cleaner/stream-memory.ts).
let cleanerTab: Page;

test.beforeAll(async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  world = await createJobWorld("t22");
  const agencyId = await seededAgencyId();
  const cleaner = await world.cleaner(agencyId, cleanerName);
  job = await world.job({ agencyId, cleaner, startsIn: -30, checkedInMinutesAgo: 20, address });
  other = await createTestUser("t22-other", { full_name: "Uji Pelanggan Lain" });
  const upload = await adminClient()
    .storage.from("recordings")
    .upload(standInClip.path, standInClip.bytes, { contentType: "video/mp4", upsert: true });
  if (upload.error) throw new Error(`Could not set up the stand-in clip: ${upload.error.message}`);
  sessions.cleaner = await sessionOf(browser, baseURL, cleaner);
  sessions.customer = await sessionOf(browser, baseURL, world.customer);
  sessions.other = await sessionOf(browser, baseURL, other);
  cleanerTab = await pageAs(browser, baseURL, "cleaner");
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  await cleanerTab?.context().close();
  // The stream session goes with the order (on delete cascade).
  await world?.cleanup();
  if (other) await deleteTestUsers([other]);
});

async function pageAs(browser: Browser, baseURL: string | undefined, who: keyof typeof sessions): Promise<Page> {
  const context = await browser.newContext({ baseURL, storageState: sessions[who], viewport: { width: 412, height: 915 } });
  return context.newPage();
}

async function settle(page: Page) {
  await expect(page.getByText(/^(Memuat…|Loading…)$/)).toHaveCount(0);
}

const cardOf = (page: Page) => page.getByRole("article").filter({ hasText: address });
const live = (page: Page, name = "Tonton langsung") => page.getByRole("region", { name });

async function streamStatus(): Promise<string | null> {
  const { data } = await adminClient().from("stream_sessions").select("status").eq("order_id", job.id).maybeSingle<{ status: string }>();
  return data?.status ?? null;
}

test("before the stream starts, the customer is told the cleaner has not started it", async ({ browser, baseURL }) => {
  const page = await pageAs(browser, baseURL, "customer");
  await page.goto(`/orders/live?order=${job.id}`);
  await settle(page);
  await expect(page.getByRole("heading", { level: 1, name: "Tonton langsung" })).toBeVisible();
  await expect(live(page).getByText("Petugas belum memulai siaran")).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  expect(await page.content()).not.toContain(signedPath);
  await page.context().close();
});

test("the cleaner starts the stream and its state shows in words", async () => {
  const page = cleanerTab;
  await page.goto("/cleaner");
  await settle(page);
  const card = cardOf(page);
  await card.getByRole("button", { name: "Mulai siaran" }).click();

  await expect(card.getByText("LIVE", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(card.getByRole("status").filter({ hasText: "Aktif" })).toBeVisible();
  await expect(card.getByText("Siaran sedang berjalan")).toBeVisible();
  expect(await streamStatus()).toBe("active");

  await card.getByRole("button", { name: "Sinyal lemah" }).click();
  await expect(card.getByRole("status").filter({ hasText: "Sinyal lemah" })).toBeVisible({ timeout: 15_000 });
  expect(await streamStatus()).toBe("weak");

  await card.getByRole("button", { name: "Terputus" }).click();
  await expect(card.getByRole("status").filter({ hasText: "Terputus" })).toBeVisible({ timeout: 15_000 });
  expect(await streamStatus()).toBe("disconnected");

  await card.getByRole("button", { name: "Sambung lagi" }).click();
  await expect(card.getByRole("status").filter({ hasText: "Aktif" })).toBeVisible({ timeout: 15_000 });
  await expect(card.getByRole("button", { name: "Sambung lagi" })).toHaveCount(0);
  expect(await streamStatus()).toBe("active");

  // After a reload the card still shows the stream as live.
  await page.reload();
  await settle(page);
  await expect(cardOf(page).getByText("LIVE", { exact: true })).toBeVisible();
});

test("the customer watches their own job, and the polled state changes when the cleaner's signal drops", async ({ browser, baseURL }) => {
  const customer = await pageAs(browser, baseURL, "customer");
  await customer.goto(`/orders?order=${job.id}`);
  await settle(customer);
  const section = live(customer);
  await expect(section.getByRole("heading", { name: "Tonton langsung" })).toBeVisible();
  const video = section.locator("video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveAttribute("playsinline", "");
  await expect(video).toHaveAttribute("loop", "");
  const src = (await video.getAttribute("src")) ?? "";
  expect(src.startsWith(libraryLink)).toBe(true);
  expect((await customer.request.get(src)).status()).toBe(200);
  await expect(section.getByText(cleanerName, { exact: true })).toBeVisible();
  await expect(section.getByText("Petugas HomeKlin", { exact: true })).toBeVisible();
  const { data } = await adminClient().from("stream_sessions").select("started_at").eq("order_id", job.id).single<{ started_at: string }>();
  await expect(section.getByText(`Mulai pukul ${jakartaClock(data!.started_at)} WIB`)).toBeVisible();
  await expect(section.getByRole("status").filter({ hasText: "Aktif" })).toBeVisible();

  const cleaner = cleanerTab;
  await cleaner.goto("/cleaner");
  await settle(cleaner);
  await cardOf(cleaner).getByRole("button", { name: "Sinyal lemah" }).click();
  await expect(cardOf(cleaner).getByRole("status").filter({ hasText: "Sinyal lemah" })).toBeVisible({ timeout: 15_000 });
  await expect(section.getByText("Sinyal petugas sedang lemah")).toBeVisible(polled);
  await expect(section.getByRole("status").filter({ hasText: "Sinyal lemah" })).toBeVisible();

  await cardOf(cleaner).getByRole("button", { name: "Terputus" }).click();
  await expect(section.getByText("Siaran terputus, menyambung kembali…")).toBeVisible(polled);

  await cardOf(cleaner).getByRole("button", { name: "Sambung lagi" }).click();
  await expect(section.getByRole("status").filter({ hasText: "Aktif" })).toBeVisible(polled);
  await expect(section.getByText("Siaran terputus, menyambung kembali…")).toHaveCount(0);

  // The dedicated address shows the same stream.
  await customer.goto(`/orders/live?order=${job.id}`);
  await settle(customer);
  const own = (await live(customer).locator("video").getAttribute("src")) ?? "";
  expect(own.startsWith(libraryLink)).toBe(true);
  await customer.context().close();
});

test("another customer opening the same address sees that it is not available, with no link", async ({ browser, baseURL }) => {
  const page = await pageAs(browser, baseURL, "other");
  const paths = [
    `/orders/live?order=${job.id}`,
    `/en/orders/live?order=${job.id}`,
    // A made-up id, and no id at all, say the same.
    "/orders/live?order=00000000-0000-4000-8000-000000000000",
    "/orders/live",
  ];
  for (const path of paths) {
    // An English page remembers the language; each address here speaks its own.
    await page.context().clearCookies({ name: "NEXT_LOCALE" });
    await page.goto(path);
    await settle(page);
    await expect(page.getByText(path.startsWith("/en") ? "Live view not available" : "Siaran tidak tersedia")).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);
    const served = await (await page.request.get(path)).text();
    for (const html of [await page.content(), served]) {
      expect(html).not.toContain(signedPath);
      expect(html).not.toContain(cleanerName);
      expect(html).not.toContain(address);
    }
  }

  // Asking the API directly is "not found", as for a job without a stream; there is no list of streams.
  expect((await page.request.get(`/api/streams/${job.id}`)).status()).toBe(404);
  expect((await page.request.get(`/api/streams/${job.id}?status=1`)).status()).toBe(404);
  expect((await page.request.get("/api/streams")).status()).toBe(404);
  await page.context().close();

  const signedOut = await apiRequest.newContext({ baseURL });
  expect((await signedOut.get(`/api/streams/${job.id}`)).status()).toBe(401);
  expect((await signedOut.get(`/api/streams/${job.id}?status=1`)).status()).toBe(401);
  await signedOut.dispose();
});

test("stopping the stream shows it ended, to the cleaner and to the customer", async ({ browser, baseURL }) => {
  const customer = await pageAs(browser, baseURL, "customer");
  await customer.goto(`/orders?order=${job.id}`);
  await settle(customer);
  await expect(live(customer).locator("video")).toHaveCount(1);

  const cleaner = cleanerTab;
  await cleaner.goto("/cleaner");
  await settle(cleaner);
  const card = cardOf(cleaner);
  await card.getByRole("button", { name: "Hentikan siaran" }).click();
  await expect(card.getByText("Siaran dihentikan. Anda dapat memulainya lagi.")).toBeVisible({ timeout: 15_000 });
  await expect(card.getByRole("button", { name: "Mulai siaran" })).toBeVisible();
  await expect(card.getByText("LIVE", { exact: true })).toHaveCount(0);
  expect(await streamStatus()).toBe("ended");

  await expect(live(customer).getByText("Siaran sudah berakhir")).toBeVisible(polled);
  await expect(live(customer).locator("video")).toHaveCount(0);
  expect((await customer.request.get(`/api/streams/${job.id}`)).status()).toBe(404);
  await customer.context().close();
});

test.describe("at 360 px in English", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("the cleaner and the customer read it in English, with no sideways scroll and no agency wording", async ({ browser, baseURL }) => {
    const cleaner = await browser.newContext({ baseURL, storageState: sessions.cleaner, viewport: { width: 360, height: 740 } });
    const cleanerPage = await cleaner.newPage();
    await cleanerPage.goto("/en/cleaner");
    await settle(cleanerPage);
    const card = cardOf(cleanerPage);
    await card.getByRole("button", { name: "Start stream" }).click();
    await expect(card.getByRole("status").filter({ hasText: "Active" })).toBeVisible({ timeout: 15_000 });
    await expect(card.getByRole("button", { name: "Weak signal" })).toBeVisible();
    expect(await cleanerPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    const customer = await browser.newContext({ baseURL, storageState: sessions.customer, viewport: { width: 360, height: 740 } });
    const page = await customer.newPage();
    const marks = [...(await agencyMarks())];
    for (const path of [`/en/orders/live?order=${job.id}`, `/en/orders?order=${job.id}`]) {
      await page.goto(path);
      await settle(page);
      const section = live(page, "Watch live");
      await expect(section.locator("video")).toHaveCount(1);
      await expect(section.getByText("HomeKlin cleaner", { exact: true })).toBeVisible();
      await expect(section.getByText(/^Started at \d{2}\.\d{2} WIB$/)).toBeVisible();
      await expect(section.getByRole("status").filter({ hasText: "Active" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
      expect(await page.evaluate(() => document.body.innerText)).not.toMatch(agencyWording);
      const html = await page.content();
      expect(html).not.toMatch(agencyWording);
      for (const mark of marks) expect(html).not.toContain(mark);
    }
    await customer.close();
    await cleaner.close();
  });
});

test("check-out ends the stream, and the customer is pointed to the recording", async ({ browser, baseURL }) => {
  const cleaner = await pageAs(browser, baseURL, "cleaner");
  await cleaner.goto("/cleaner");
  await settle(cleaner);
  const card = cardOf(cleaner);
  await card.getByRole("button", { name: "Check-out" }).click();
  await card.getByRole("button", { name: "Ya, check-out" }).click();
  await expect(
    cleaner.getByRole("region", { name: "Baru selesai" }).getByRole("article").filter({ hasText: address }),
  ).toContainText(/Selesai pukul/, { timeout: 20_000 });
  expect(await streamStatus()).toBe("ended");
  await cleaner.context().close();

  const customer = await pageAs(browser, baseURL, "customer");
  await customer.goto(`/orders/live?order=${job.id}`);
  await settle(customer);
  await expect(customer.getByText("Pekerjaan sudah selesai")).toBeVisible();
  await expect(customer.getByRole("link", { name: "Lihat rekaman" })).toHaveAttribute("href", `/orders?order=${job.id}#recording`);
  await expect(customer.locator("video")).toHaveCount(0);
  await customer.context().close();
});
