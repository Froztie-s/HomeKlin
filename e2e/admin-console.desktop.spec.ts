import { expect, test, type Locator, type Page } from "@playwright/test";
import { adminClient, testProject } from "../tests/integration/test-project";
import { createConsoleWorld, type ConsoleWorld } from "./admin-console-test-data";
import { signedInAs } from "./setup/auth-state";

// T24-T26 on a desk: the admin dashboard counts today's jobs, the jobs in progress, today's jobs
// without a cleaner and the open tickets, and lists today's jobs and the latest open tickets; the live
// monitor shows every live feed at once, each with its video, cleaner, agency, service, area, status
// (polled) and start time; the recordings page lists past jobs and plays a recording still within its
// 7 days, while a deleted one says so with no player. Customers and agencies are refused all of it.
// The spec makes its own agency, cleaners, jobs, streams, recordings and ticket in the shared test
// project (e2e/admin-console-test-data.ts) and removes them at the end. Other specs and agents use the
// same project at the same time, so counts are checked as "at least what this spec made".
// The stand-in clip is 8 bytes, not a real video: the spec checks that each player has a signed link
// and that the link answers, not that the browser plays it.

test.describe.configure({ mode: "serial", timeout: 120_000 });

const signedLink = `${new URL(testProject.url).origin}/storage/v1/object/sign/recordings/`;

let data: ConsoleWorld;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  data = await createConsoleWorld("t24");
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  await data?.cleanup();
});

/** The number a dashboard tile shows. */
async function tileValue(tile: Locator): Promise<number> {
  return Number((await tile.locator("[data-value]").innerText()).trim());
}

async function expectPlayable(page: Page, video: Locator) {
  const src = (await video.getAttribute("src")) ?? "";
  expect(src.startsWith(signedLink)).toBe(true);
  expect((await page.request.get(src)).status()).toBe(200);
}

test.describe("admin", () => {
  test.use(signedInAs.admin);

  test("the dashboard counts today's jobs, the jobs in progress, the jobs waiting for a cleaner and the open tickets", async ({ page }) => {
    await page.goto("/admin");
    const summary = page.getByRole("region", { name: "Ringkasan" });

    const today = summary.locator('[data-tile="today"]');
    await expect(today).toContainText("Pekerjaan hari ini");
    expect(await tileValue(today)).toBeGreaterThanOrEqual(3);
    await expect(today).toHaveAttribute("href", "#today-jobs");

    const inProgress = summary.locator('[data-tile="inProgress"]');
    await expect(inProgress).toContainText("Sedang berlangsung");
    expect(await tileValue(inProgress)).toBeGreaterThanOrEqual(2);
    await expect(inProgress).toHaveAttribute("href", "/admin/monitor");

    const waiting = summary.locator('[data-tile="waiting"]');
    await expect(waiting).toContainText("Menunggu petugas");
    expect(await tileValue(waiting)).toBeGreaterThanOrEqual(1);

    const tickets = summary.locator('[data-tile="tickets"]');
    await expect(tickets).toContainText("Tiket terbuka");
    expect(await tileValue(tickets)).toBeGreaterThanOrEqual(1);
    await expect(tickets).toContainText(/\d+ mendesak/);
    await expect(tickets).toHaveAttribute("href", "/admin/tickets");
  });

  test("the dashboard lists today's jobs with their check-in status and links the latest open tickets", async ({ page }) => {
    await page.goto("/admin");
    const table = page.getByRole("table", { name: "Pekerjaan hari ini" });
    await expect(table.locator(`tr[data-job="${data.live.first}"]`)).toContainText(/Check-in pukul \d{2}\.\d{2}/);
    await expect(table.locator(`tr[data-job="${data.live.first}"]`)).toContainText(data.agencyName);
    await expect(table.locator(`tr[data-job="${data.live.second}"]`)).toContainText(data.cleaners.second);
    await expect(table.locator(`tr[data-job="${data.waiting}"]`)).toContainText("Belum ada petugas");

    const tickets = page.getByRole("region", { name: "Tiket terbuka terbaru" });
    const link = tickets.locator(`a[href="/admin/tickets?ticket=${data.ticket.id}"]`);
    await expect(link).toContainText(data.ticket.question);
    await expect(link).toContainText("Mendesak");
    await expect(link).toContainText("Uji Pelanggan Pekerjaan");
    await expect(tickets.getByRole("link", { name: "Lihat semua tiket" })).toHaveAttribute("href", "/admin/tickets");
  });

  test("the live monitor shows every live feed at once, with a video that plays, and polls each status", async ({ page }) => {
    await page.goto("/admin/monitor");
    const grid = page.getByRole("list", { name: "Siaran langsung" });
    const first = grid.locator(`[data-feed="${data.live.first}"]`);
    const second = grid.locator(`[data-feed="${data.live.second}"]`);

    for (const [feed, cleaner, status] of [
      [first, data.cleaners.first, "Aktif"],
      [second, data.cleaners.second, "Sinyal lemah"],
    ] as const) {
      await expect(feed).toContainText(cleaner);
      await expect(feed).toContainText(data.agencyName);
      await expect(feed).toContainText("Pembersihan Rutin");
      await expect(feed).toContainText("Jakarta Timur");
      await expect(feed).toContainText(/Mulai pukul \d{2}\.\d{2} WIB/);
      await expect(feed.getByRole("status")).toContainText(status);
      const video = feed.locator("video");
      await expect(video).toHaveCount(1);
      // Muted, looped and inline, so a grid of them plays on any browser without sound.
      expect(await video.evaluate((element: HTMLVideoElement) => [element.muted, element.loop, element.playsInline])).toEqual([true, true, true]);
      await expectPlayable(page, video);
    }

    // The page itself carries the names and the signed links, so the refusals below are not vacuous.
    const served = await (await page.request.get("/admin/monitor")).text();
    expect(served).toContain(data.cleaners.first);
    expect(served).toContain(data.agencyName);
    expect(served).toContain("/storage/v1/object/sign/");

    // The cleaner's phone loses its connection: the tile says so within one poll (every 10 s).
    await adminClient().from("stream_sessions").update({ status: "disconnected" }).eq("order_id", data.live.second);
    await expect(second.getByRole("status")).toContainText("Terputus", { timeout: 25_000 });
  });

  test("the recordings page lists past jobs, plays one still within its 7 days and refuses a deleted one", async ({ page }) => {
    await page.goto("/admin/recordings");
    const table = page.getByRole("table", { name: "Pekerjaan selesai" });
    const available = table.locator(`tr[data-job="${data.recorded.available.orderId}"]`);
    const expired = table.locator(`tr[data-job="${data.recorded.expired.orderId}"]`);
    await expect(available).toContainText(/Tersedia sampai \S+, \d{1,2} \S+, \d{2}\.\d{2} WIB/);
    await expect(available).toContainText(data.agencyName);
    await expect(available).toContainText(data.cleaners.recorded);
    await expect(expired).toContainText("Sudah dihapus");
    await expect(expired.getByRole("link")).toHaveCount(0);
    await expect(page.locator("video")).toHaveCount(0);

    await available.getByRole("link", { name: /Putar/ }).click();
    await expect(page).toHaveURL(`/admin/recordings?recording=${data.recorded.available.recordingId}`);
    const player = page.getByRole("region", { name: "Rekaman pekerjaan" });
    const video = player.locator("video");
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute("controls", "");
    await expectPlayable(page, video);
    await expect(player.getByText(/^Tersedia sampai \S+, \d{1,2} \S+, \d{2}\.\d{2} WIB$/)).toBeVisible();

    await page.goto(`/admin/recordings?recording=${data.recorded.expired.recordingId}`);
    await expect(page.getByRole("region", { name: "Rekaman pekerjaan" }).getByText("Rekaman sudah dihapus")).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);
    expect(await page.content()).not.toContain("/storage/v1/object/sign/");
    expect((await page.request.get(`/api/recordings/${data.recorded.expired.recordingId}/link`)).status()).toBe(410);
  });

  test("reads in English", async ({ page }) => {
    await page.goto("/en/admin");
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary.locator('[data-tile="inProgress"]')).toContainText("In progress");
    await expect(summary.locator('[data-tile="tickets"]')).toHaveAttribute("href", "/en/admin/tickets");
    await expect(page.getByRole("region", { name: "Latest open tickets" }).locator(`a[href="/en/admin/tickets?ticket=${data.ticket.id}"]`)).toContainText(
      "Urgent",
    );

    await page.goto("/en/admin/monitor");
    const feed = page.getByRole("list", { name: "Live streams" }).locator(`[data-feed="${data.live.first}"]`);
    await expect(feed).toContainText("Regular Cleaning");
    await expect(feed).toContainText(/Started at \d{2}\.\d{2} WIB/);
    await expect(feed.getByRole("status")).toContainText("Active");

    await page.goto(`/en/admin/recordings?recording=${data.recorded.available.recordingId}`);
    await expect(page.getByRole("region", { name: "Job recording" }).locator("video")).toHaveCount(1);
    await expect(page.getByRole("table", { name: "Finished jobs" }).locator(`tr[data-job="${data.recorded.expired.orderId}"]`)).toContainText("Deleted");
  });
});

for (const role of ["customer", "agency"] as const) {
  test.describe(`a signed-in ${role}`, () => {
    test.use(signedInAs[role]);

    test("is refused the live monitor and the recordings, and never gets a feed or a link", async ({ page }) => {
      const home = role === "customer" ? "/home" : "/agency";
      for (const path of ["/admin/monitor", `/admin/recordings?recording=${data.recorded.available.recordingId}`]) {
        // Not even the HTML that comes before the redirect holds a feed, a name or a link.
        const served = await (await page.request.get(path)).text();
        expect(served).not.toContain("/storage/v1/object/sign/");
        expect(served).not.toContain(data.cleaners.first);
        expect(served).not.toContain(data.agencyName);

        await page.goto(path);
        await expect(page).toHaveURL(home);
        await expect(page.locator("video")).toHaveCount(0);
      }
    });
  });
}
