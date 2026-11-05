import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUsers, type TestUser } from "../../tests/integration/test-project";
import { signInWithPassword } from "../order-test-data";
import { createOwnerWorld, type OwnerWorld } from "../owner-test-data";
import { area, createReplayWorld, type ReplayWorld } from "../recording-test-data";

// T29b, T29c and T30 review screenshots. The owner pages at the two desktop widths (the numbers, the
// partner list with a suspend question open, the admin accounts with the form), and the reviews at the
// two phone widths (the form on a finished job, the review once given, a service card with its rating
// and latest reviews), in both languages. Saved to docs/screenshots/t29b/:
//   <surface>-<lang>-<width>.png       the whole page
//   <surface>-<lang>-<width>-fold.png  phones only: the first screen as it opens
// A throw-away owner, agency, customers and jobs (e2e/owner-test-data.ts, e2e/recording-test-data.ts)
// are removed at the end. Run with: npm run screenshots -- t29b

const dir = "docs/screenshots/t29b";
const heights: Record<number, number> = { 360: 780, 390: 844, 1280: 800, 1440: 900 };
const languages = [
  ["id", ""],
  ["en", "/en"],
] as const;

test.describe.configure({ mode: "serial" });

let owners: OwnerWorld;
let replay: ReplayWorld;
let owner: TestUser;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  owners = await createOwnerWorld("t29b-shots");
  replay = await createReplayWorld("t29b-shots");
  owner = await createTestUser("t29b-shots-owner", { full_name: "Uji Pemilik" });
  await adminClient().from("profiles").update({ role: "owner", full_name: "Uji Pemilik" }).eq("id", owner.id);
  const given = await replay.customer.client.rpc("submit_review", {
    p_order: replay.orders.available,
    p_service_rating: 5,
    p_cleaner_rating: 4,
    p_comment: "Rapi dan tepat waktu. Petugas menjelaskan apa saja yang sudah dibersihkan.",
  });
  expect(given.error).toBeNull();
});

test.afterAll(async () => {
  await deleteTestUsers([owner]);
  await owners?.cleanup();
  await replay?.cleanup();
});

async function signedInPage(browser: Browser, user: { email: string; password: string }, mobile: boolean): Promise<Page> {
  const width = mobile ? 360 : 1280;
  const context = await browser.newContext({
    viewport: { width, height: heights[width] },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await signInWithPassword(page, user);
  return page;
}

async function shoot(page: Page, name: string, width: number, mobile: boolean) {
  await page.setViewportSize({ width, height: heights[width] });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^(Memuat|Loading)/)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, `${name} at ${width}`).toBeLessThanOrEqual(width);
  if (mobile) await page.screenshot({ path: `${dir}/${name}-${width}-fold.png` });
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.max(pageHeight, heights[width]) });
  await page.screenshot({ path: `${dir}/${name}-${width}.png` });
  await page.setViewportSize({ width, height: heights[width] });
}

test("the owner pages", async ({ browser }) => {
  test.setTimeout(300_000);
  const page = await signedInPage(browser, owner, false);
  for (const [lang, prefix] of languages) {
    await page.goto(`${prefix}/owner`);
    await page.getByText(lang === "id" ? "Tampilkan sebagai tabel" : "Show as a table").click();
    for (const width of [1280, 1440]) await shoot(page, `owner-numbers-${lang}`, width, false);

    await page.goto(`${prefix}/owner/agencies`);
    const row = page.getByRole("row").filter({ hasText: owners.agency.name });
    await row.getByRole("button", { name: new RegExp(`^(Tangguhkan|Suspend) ${owners.agency.name}`) }).click();
    for (const width of [1280, 1440]) await shoot(page, `owner-agencies-${lang}`, width, false);

    await page.goto(`${prefix}/owner/admins`);
    for (const width of [1280, 1440]) await shoot(page, `owner-admins-${lang}`, width, false);
  }
  await page.context().close();
});

test("the reviews on a phone", async ({ browser }) => {
  test.setTimeout(300_000);
  const page = await signedInPage(browser, replay.customer, true);
  for (const [lang, prefix] of languages) {
    await page.context().clearCookies({ name: "NEXT_LOCALE" });
    await page.goto(`${prefix}/orders?order=${replay.orders.none}`);
    const group = page.getByRole("radiogroup", { name: lang === "id" ? "Layanan HomeKlin" : "HomeKlin service" });
    await group.getByRole("radio", { name: lang === "id" ? "4 dari 5 bintang" : "4 out of 5 stars" }).check();
    await page.getByRole("region", { name: lang === "id" ? "Ulasan" : "Review", exact: true }).scrollIntoViewIfNeeded();
    for (const width of [360, 390]) await shoot(page, `review-form-${lang}`, width, true);

    await page.goto(`${prefix}/orders?order=${replay.orders.available}`);
    for (const width of [360, 390]) await shoot(page, `review-given-${lang}`, width, true);

    await page.goto(`${prefix}/services?area=${area}`);
    await page.getByText(lang === "id" ? "Lihat ulasan" : "See reviews").first().click();
    for (const width of [360, 390]) await shoot(page, `services-rating-${lang}`, width, true);
  }
  await page.context().close();
});
