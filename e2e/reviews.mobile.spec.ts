import { expect, test, type Browser, type Page } from "@playwright/test";
import { agencyMarks } from "./booking-test-data";
import { signInWithPassword } from "./order-test-data";
import { area, createReplayWorld, service, type ReplayWorld } from "./recording-test-data";
import type { StorageState } from "./setup/auth-state";

// T30 on a phone: the customer rates a finished job once, for the HomeKlin service and for the Petugas
// HomeKlin, with an optional comment; the order then shows the submitted review instead of the form,
// and the service on /services shows its rating and the latest reviews, without the customer's name
// and without any agency. Another customer cannot review the job. The spec makes its own customers and
// finished jobs (e2e/recording-test-data.ts, a throw-away agency in Jakarta Pusat) and removes them at
// the end; the reviews go with the orders.

test.describe.configure({ mode: "serial", timeout: 120_000 });

const agencyWording = /agensi|agency|mitra|partner/i;

let world: ReplayWorld;
let comment: string;
const sessions: { customer?: StorageState; other?: StorageState } = {};

async function signedIn(browser: Browser, baseURL: string | undefined, user: ReplayWorld["customer"]): Promise<StorageState> {
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  await signInWithPassword(await context.newPage(), user);
  const state = await context.storageState();
  await context.close();
  return state;
}

test.beforeAll(async ({ browser, baseURL }) => {
  world = await createReplayWorld("t30");
  comment = `Rapi dan tepat waktu, terima kasih ${world.orders.available.slice(0, 8)}`;
  sessions.customer = await signedIn(browser, baseURL, world.customer);
  sessions.other = await signedIn(browser, baseURL, world.other);
});

test.afterAll(async () => {
  await world?.cleanup();
});

const reviewRegion = (page: Page, name = "Ulasan") => page.getByRole("region", { name, exact: true });
const serviceCard = (page: Page, name = service.name) =>
  page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });

async function expectNoAgency(page: Page, path: string) {
  const marks = [...(await agencyMarks()), world.agency.id, world.agency.name];
  const served = await (await page.request.get(path)).text();
  for (const html of [await page.content(), served]) {
    expect(html, path).not.toMatch(agencyWording);
    for (const mark of marks) expect(html, path).not.toContain(mark);
  }
}

test.describe("the customer", () => {
  test.use({ storageState: async ({}, provide) => provide(sessions.customer) });

  test("rates a finished job once, and then sees the review they gave", async ({ page }) => {
    await page.goto(`/orders?order=${world.orders.available}`);
    const region = reviewRegion(page);
    await expect(region.getByRole("heading", { name: "Ulasan" })).toBeVisible();
    const submit = region.getByRole("button", { name: "Kirim ulasan" });

    // Without a rating for the service the form says what is missing.
    await submit.click();
    await expect(region.getByRole("alert")).toContainText("Pilih nilai untuk layanan");

    const serviceGroup = region.getByRole("radiogroup", { name: "Layanan HomeKlin" });
    await serviceGroup.getByRole("radio", { name: "5 dari 5 bintang" }).check();
    await expect(serviceGroup).toContainText("5 dari 5");
    const cleanerGroup = region.getByRole("radiogroup", { name: `Petugas HomeKlin, ${world.cleaners.withPhoto.name}` });
    await cleanerGroup.getByRole("radio", { name: "4 dari 5 bintang" }).check();
    await region.getByLabel("Komentar (opsional)").fill(comment);
    await submit.click();

    await expect(region.getByText("Terima kasih, ulasan Anda sudah tersimpan.")).toBeVisible();
    await expect(region.getByRole("button", { name: "Kirim ulasan" })).toHaveCount(0);
    await expect(region.getByRole("radio")).toHaveCount(0);
    await expect(region.getByText("Layanan HomeKlin: 5 dari 5 bintang")).toBeVisible();
    await expect(region.getByText(`Petugas HomeKlin: 4 dari 5 bintang`)).toBeVisible();
    await expect(region.getByText(comment)).toBeVisible();

    // It stays given: a reload shows the same review, and a second one is refused.
    await page.reload();
    await expect(reviewRegion(page).getByText(comment)).toBeVisible();
    const again = await world.customer.client.rpc("submit_review", { p_order: world.orders.available, p_service_rating: 1 });
    expect(again.error?.message).toBe("review_exists");
  });

  test("sees the rating and the latest reviews on the service, without names or agency", async ({ page }) => {
    const path = `/services?area=${area}`;
    await page.goto(path);
    const card = serviceCard(page);
    await expect(card.getByText(/^\d,\d$/)).toBeVisible();
    await expect(card.getByText(/\(\d+ ulasan\)/)).toBeVisible();
    await card.getByText("Lihat ulasan").click();
    const latest = card.getByRole("list", { name: `Ulasan terbaru ${service.name}` });
    await expect(latest.getByText(comment)).toBeVisible();
    await expect(latest).toContainText(`Petugas ${world.cleaners.withPhoto.name.split(" ")[0]}`);
    await expect(latest).not.toContainText(world.cleaners.withPhoto.name);
    // The reviewer is never named (the page's account chip names the signed-in customer, not the list).
    await expect(latest).not.toContainText("Uji Pelanggan");
    await expectNoAgency(page, path);
    await expectNoAgency(page, `/orders?order=${world.orders.available}`);
  });

  test("works in English", async ({ page }) => {
    await page.goto(`/en/orders?order=${world.orders.available}`);
    const region = reviewRegion(page, "Review");
    await expect(region.getByText("HomeKlin service: 5 out of 5 stars")).toBeVisible();
    await expect(region.getByText(comment)).toBeVisible();

    await page.goto(`/en/orders?order=${world.orders.none}`);
    const form = reviewRegion(page, "Review");
    await expect(form.getByRole("radiogroup", { name: "HomeKlin service" })).toBeVisible();
    await expect(form.getByRole("button", { name: "Send review" })).toBeVisible();

    await page.goto(`/en/services?area=${area}`);
    await expect(serviceCard(page, service.nameEn).getByText(/\(\d+ reviews?\)/)).toBeVisible();
  });

  test.describe("at 360 px", () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test("the review form, the given review and the services have no sideways scroll", async ({ page }) => {
      for (const path of [`/orders?order=${world.orders.none}`, `/orders?order=${world.orders.available}`, `/services?area=${area}`, `/en/orders?order=${world.orders.none}`]) {
        await page.goto(path);
        await expect(page.getByText(/Rp\s[\d.]+/).first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, path).toBeLessThanOrEqual(0);
      }
    });
  });
});

test.describe("another customer", () => {
  test.use({ storageState: async ({}, provide) => provide(sessions.other) });

  test("cannot see or review the job", async ({ page }) => {
    await page.goto(`/orders?order=${world.orders.none}`);
    await expect(page.getByText("Belum ada pesanan")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirim ulasan" })).toHaveCount(0);
    const attempt = await world.other.client.rpc("submit_review", { p_order: world.orders.none, p_service_rating: 1 });
    expect(attempt.error?.message).toBe("job_not_found");
  });
});
