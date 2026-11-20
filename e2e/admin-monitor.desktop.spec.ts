import { expect, test, type Locator, type Page } from "@playwright/test";
import { adminClient } from "../tests/integration/test-project";
import { jakartaClock } from "./job-test-data";
import { createMonitorWorld, makeTestVideo, serveTestVideo, type MonitorWorld } from "./monitor-test-data";
import { signedInAs } from "./setup/auth-state";

// M1 on a desk: "Pemantauan langsung" as in the user's mock. One grid of cards: each live stream with
// its video, status chip (icon or dot plus a word), order number, cleaner, "service, area", agency and
// "Buka" (the video in full screen); each of today's jobs whose cleaner has not checked in yet, with
// "Belum check-in" and the start time, and no video or "Buka". The summary line counts what the page
// read. The spec makes its own agency, cleaners, jobs and streams (e2e/monitor-test-data.ts) and
// removes them at the end; other specs share the project, so their cards may appear as well.

test.describe.configure({ mode: "serial", timeout: 120_000 });

let data: MonitorWorld;
let video: Buffer;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  data = await createMonitorWorld("m1");
  video = await makeTestVideo(browser);
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  await data?.cleanup();
});

test.use(signedInAs.admin);

const grid = (page: Page, name = "Pekerjaan yang dipantau") => page.getByRole("list", { name });
const feed = (page: Page, id: string) => page.locator(`[data-feed="${id}"]`);

/** The numbers in the summary line, in order. */
async function summaryNumbers(summary: Locator): Promise<number[]> {
  return ((await summary.textContent()) ?? "").match(/\d+/g)?.map(Number) ?? [];
}

test("live cards show the order number, the status chip, the job and Buka", async ({ page }) => {
  await page.goto("/admin/monitor");
  await expect(page.getByRole("heading", { level: 1, name: "Pemantauan langsung" })).toBeVisible();

  for (const [job, status] of [
    [data.live.active, "Sedang berlangsung"],
    [data.live.weak, "Sinyal lemah"],
    [data.live.disconnected, "Terputus"],
  ] as const) {
    const card = grid(page).locator(`[data-feed="${job.id}"]`);
    const article = card.getByRole("article", { name: job.cleaner });
    await expect(article).toBeVisible();
    await expect(card).toContainText(job.code);
    expect(job.code).toMatch(/^HK-\d+$/);
    await expect(card).toContainText("Pembersihan Rutin, Jakarta Timur");
    await expect(card).toContainText(data.agencyName);
    await expect(card.getByRole("status")).toHaveText(status);
    // The chip carries an icon or the live dot beside its word, never colour alone.
    await expect(card.getByRole("status").locator("svg, [data-dot]")).toHaveCount(1);
    const open = card.getByRole("button", { name: `Buka siaran ${job.cleaner} dalam layar penuh` });
    await expect(open).toBeVisible();
    await expect(open).toHaveText("Buka");
    const box = await open.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
    await expect(card.locator("video")).toHaveCount(1);
  }

  // A disconnected stream's frame says so on a sunken panel; with no picture to enlarge, "Buka" opens
  // the order's page instead of sitting greyed out (2026-11-20, UX audit item 19).
  const disconnected = feed(page, data.live.disconnected.id);
  await expect(disconnected.getByText("Siaran terputus")).toBeVisible();
  await expect(disconnected.getByRole("button", { name: /^Buka/ })).toHaveCount(0);
  const openOrder = disconnected.getByRole("link", { name: `Lihat detail pesanan ${data.live.disconnected.code}` }).filter({ hasText: "Buka" });
  await expect(openOrder).toBeVisible();
  await expect(openOrder).toHaveAttribute("href", `/admin/orders/${data.live.disconnected.code}`);
});

test("a job of today whose cleaner has not checked in is a card with its start time and no Buka", async ({ page }) => {
  await page.goto("/admin/monitor");
  const card = grid(page).locator(`[data-waiting="${data.waiting.id}"]`);
  await expect(card.getByRole("article", { name: data.waiting.cleaner })).toBeVisible();
  await expect(card).toContainText("Belum check-in");
  await expect(card).toContainText(`Mulai pukul ${jakartaClock(data.waiting.startsAt)} WIB`);
  await expect(card).toContainText(data.waiting.code);
  await expect(card).toContainText("Pembersihan Rutin, Jakarta Timur");
  await expect(card).toContainText(data.agencyName);
  await expect(card.getByRole("button")).toHaveCount(0);
  await expect(card.locator("video")).toHaveCount(0);
  // Not a live region: nothing about it changes while the page is open.
  await expect(card.getByRole("status")).toHaveCount(0);

  // Today's job without a cleaner, and tomorrow's job with one, are not on the monitor.
  await expect(page.locator(`[data-waiting="${data.left.unassigned}"], [data-waiting="${data.left.tomorrow}"]`)).toHaveCount(0);
});

test("the summary line counts the jobs in progress, those with trouble, and those not checked in", async ({ page }) => {
  await page.goto("/admin/monitor");
  const summary = page.getByTestId("monitor-summary");
  await expect(summary).toHaveText(/^\d+ pekerjaan sedang berlangsung\. \d+ terkendala\. \d+ belum check-in\.$/);
  // The cards carry the status they were read with, so the counts can be checked against them
  // whatever other specs have running at the same time.
  const live = await page.locator("[data-feed]:not([data-initial-status='ended'])").count();
  const troubled = await page.locator("[data-feed][data-initial-status='weak'], [data-feed][data-initial-status='disconnected']").count();
  const waiting = await page.locator("[data-waiting]").count();
  expect(await summaryNumbers(summary)).toEqual([live, troubled, waiting]);
  expect(live).toBeGreaterThanOrEqual(3);
  expect(troubled).toBeGreaterThanOrEqual(2);
  expect(waiting).toBeGreaterThanOrEqual(1);
  // "Perbarui daftar" reads the list again with a full page load.
  await expect(page.getByRole("link", { name: "Perbarui daftar" })).toHaveAttribute("href", "");
});

test("Buka puts that card's video into full screen", async ({ page }) => {
  await serveTestVideo(page, video);
  await page.goto("/admin/monitor");
  const card = feed(page, data.live.active.id);
  const player = card.locator("video");
  // The served test video plays, so the frame shows no problem panel.
  await expect.poll(() => player.evaluate((element: HTMLVideoElement) => element.readyState >= 2)).toBe(true);
  await card.getByRole("button", { name: /^Buka siaran/ }).click();
  await expect
    .poll(() => page.evaluate((id) => document.fullscreenElement === document.querySelector(`[data-feed="${id}"] video`), data.live.active.id))
    .toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
});

test("reads in English", async ({ page }) => {
  await page.goto("/en/admin/monitor");
  await expect(page.getByRole("heading", { level: 1, name: "Live monitoring" })).toBeVisible();
  await expect(page.getByTestId("monitor-summary")).toHaveText(
    /^\d+ jobs? in progress\. \d+ having trouble\. \d+ not checked in yet\.$/,
  );
  const live = grid(page, "Monitored jobs").locator(`[data-feed="${data.live.weak.id}"]`);
  await expect(live).toContainText("Regular Cleaning, East Jakarta");
  await expect(live.getByRole("status")).toHaveText("Weak signal");
  await expect(live.getByRole("button", { name: `Open ${data.live.weak.cleaner}'s stream in full screen` })).toHaveText("Open");
  await expect(feed(page, data.live.active.id).getByRole("status")).toHaveText("In progress");
  await expect(feed(page, data.live.disconnected.id).getByText("Stream disconnected")).toBeVisible();

  const waiting = page.locator(`[data-waiting="${data.waiting.id}"]`);
  await expect(waiting).toContainText("Not checked in");
  await expect(waiting).toContainText(`Starts at ${jakartaClock(data.waiting.startsAt)} WIB`);
  await expect(page.getByRole("link", { name: "Refresh list" })).toBeVisible();
});

// M2: the filters are query parameters of one plain GET form, so they work without JavaScript and
// combine; the summary line counts what they leave.
test.describe("filters", () => {
  test("Terkendala keeps the troubled streams only, and the summary counts what is shown", async ({ page }) => {
    await page.goto("/admin/monitor");
    const toggle = page.getByRole("group", { name: "Tampilkan" });
    await expect(toggle.getByRole("button", { name: "Semua" })).toHaveAttribute("aria-pressed", "true");
    await toggle.getByRole("button", { name: "Terkendala" }).click();
    await expect(page).toHaveURL(/[?&]view=troubled/);
    await expect(page.getByRole("group", { name: "Tampilkan" }).getByRole("button", { name: "Terkendala" })).toHaveAttribute("aria-pressed", "true");

    await expect(feed(page, data.live.weak.id)).toBeVisible();
    await expect(feed(page, data.live.disconnected.id)).toBeVisible();
    await expect(feed(page, data.live.active.id)).toHaveCount(0);
    await expect(page.locator("[data-waiting]")).toHaveCount(0);
    // Every card left has trouble.
    await expect(page.locator("[data-feed][data-initial-status='active']")).toHaveCount(0);

    const shown = await page.locator("[data-feed]").count();
    expect(await summaryNumbers(page.getByTestId("monitor-summary"))).toEqual([shown, shown]);
    await expect(page.getByTestId("monitor-summary")).not.toContainText("belum check-in");
  });

  test("the area select keeps that area's cards and combines with the toggle", async ({ page }) => {
    await page.goto("/admin/monitor");
    const area = page.getByLabel("Area layanan");
    await expect(area).toHaveValue("");
    await expect(area.locator("option").first()).toHaveText("Semua area");
    await area.selectOption({ label: "Jakarta Timur" });
    await expect(page).toHaveURL(/[?&]area=jakarta-timur/);
    await expect(page.getByLabel("Area layanan")).toHaveValue("jakarta-timur");
    for (const id of [data.live.active.id, data.live.weak.id, data.live.disconnected.id]) await expect(feed(page, id)).toBeVisible();
    await expect(page.locator(`[data-waiting="${data.waiting.id}"]`)).toBeVisible();
    // Every card left is in Jakarta Timur.
    for (const card of await page.locator("[data-feed], [data-waiting]").all()) await expect(card).toContainText("Jakarta Timur");

    // The toggle keeps the area.
    await page.getByRole("group", { name: "Tampilkan" }).getByRole("button", { name: "Terkendala" }).click();
    await expect(page).toHaveURL(/view=troubled/);
    await expect(page).toHaveURL(/area=jakarta-timur/);
    await expect(feed(page, data.live.weak.id)).toBeVisible();
    await expect(feed(page, data.live.active.id)).toHaveCount(0);
  });

  test("a filter that leaves nothing says so plainly, with the way back", async ({ page }) => {
    // A served area without a troubled stream: the select's areas, less those where a weak or
    // disconnected stream runs now (the test project's demo data and other specs have some).
    await page.goto("/admin/monitor");
    const areas = (await page.getByLabel("Area layanan").locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))).filter(Boolean);
    const { data: troubled, error } = await adminClient()
      .from("stream_sessions")
      .select("orders!inner(area_id)")
      .in("status", ["weak", "disconnected"]);
    if (error) throw new Error(`Could not read the streams: ${error.message}`);
    const busy = new Set((troubled as unknown as { orders: { area_id: string } }[]).map((row) => row.orders.area_id));
    const quiet = areas.find((area) => !busy.has(area));
    expect(quiet, "a served area with no troubled stream").toBeDefined();
    await page.goto(`/admin/monitor?view=troubled&area=${quiet}`);
    await expect(feed(page, data.live.weak.id)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Tidak ada pekerjaan yang cocok" })).toBeVisible();
    await expect(page.getByTestId("monitor-summary")).toHaveText("0 pekerjaan sedang berlangsung. 0 terkendala.");
    await page.getByRole("link", { name: "Tampilkan semua pekerjaan" }).click();
    await expect(page).toHaveURL("/admin/monitor");
    await expect(feed(page, data.live.active.id)).toBeVisible();
  });

  test("an unknown filter value shows everything instead of failing", async ({ page }) => {
    await page.goto("/admin/monitor?view=everything&area=atlantis");
    await expect(feed(page, data.live.active.id)).toBeVisible();
    await expect(page.getByLabel("Area layanan")).toHaveValue("");
  });

  // The role-checked part of the page streams in behind <Suspense>, which needs JavaScript to show,
  // so a browser without it cannot be tested here; the form itself is checked to be a plain GET form
  // whose fields name the query parameters, which is what lets the filters work as links and reloads.
  test("the filters are a plain GET form of the address's parameters", async ({ page }) => {
    await page.goto("/admin/monitor?view=troubled&area=jakarta-timur");
    const form = page.getByRole("form", { name: "Filter pemantauan" });
    await expect(form).toHaveAttribute("method", "get");
    await expect(form).toHaveAttribute("action", "/admin/monitor");
    const toggle = form.getByRole("group", { name: "Tampilkan" });
    for (const [name, value] of [["Semua", "all"], ["Terkendala", "troubled"]] as const) {
      const button = toggle.getByRole("button", { name });
      await expect(button).toHaveAttribute("type", "submit");
      await expect(button).toHaveAttribute("name", "view");
      await expect(button).toHaveAttribute("value", value);
    }
    await expect(form.locator('input[type="hidden"][name="view"]')).toHaveValue("troubled");
    await expect(form.getByLabel("Area layanan")).toHaveAttribute("name", "area");
    await expect(form.getByLabel("Area layanan")).toHaveValue("jakarta-timur");
    // Without JavaScript a changed select is sent with this button.
    await expect(form.locator("noscript")).toHaveCount(1);
  });

  test("reads in English", async ({ page }) => {
    await page.goto("/en/admin/monitor?view=troubled");
    const toggle = page.getByRole("group", { name: "Show" });
    await expect(toggle.getByRole("button", { name: "Having trouble" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Service area").locator("option").first()).toHaveText("All areas");
  });
});

test("the order number on a card opens the order's detail page", async ({ page }) => {
  await page.goto("/admin/monitor");
  const link = feed(page, data.live.active.id).getByRole("link", { name: `Lihat detail pesanan ${data.live.active.code}` });
  await expect(link).toHaveText(data.live.active.code);
  const box = await link.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await link.click();
  await expect(page).toHaveURL(`/admin/orders/${data.live.active.code}`);
  await expect(page.getByRole("heading", { level: 1, name: "Pembersihan Rutin" })).toBeVisible();
});
