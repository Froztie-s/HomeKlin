import { expect, test, type Browser, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { adminClient } from "../../tests/integration/test-project";

// T7b review screenshots: admin's list of services and prices, the form that adds a service (empty and
// with its error state, in both languages) and the form that changes one, at the two desktop widths;
// plus the list and the form on a narrow screen, to show they stay usable without sideways scrolling.
// Saved to docs/screenshots/t7b/ as <surface>-<width>.png (the whole page, with the sidebar where it
// really sits) and, on phones, <surface>-<width>-fold.png (the first screen as it opens).
// Each device type signs in once through the form (Supabase limits sign-ins per address) and reuses that
// browser. The admin and the one extra service ("Cuci Gorden", switched off, so the customer pages and
// the other specs never see it) are fictional, made for this run in the Supabase test project, and
// deleted at the end. The seeded services are only read.
// Run with: npm run screenshots -- t7b

// One worker, so one admin and one extra service exist for the whole run (beforeAll runs per worker).
// Each test takes many full-page pictures, so it gets more than the default 30 seconds.
test.describe.configure({ mode: "serial", timeout: 120_000 });

const dir = "docs/screenshots/t7b";
type Device = "phone" | "desktop";
const widths: Record<Device, number[]> = { phone: [360, 390], desktop: [1280, 1440] };
const heights: Record<number, number> = { 360: 780, 390: 844, 1280: 800, 1440: 900 };

type Account = { email: string; password: string };
let account: Account;
let userId: string | undefined;
const serviceId = `uji-gorden-${randomUUID().slice(0, 6)}`;

test.beforeAll(async () => {
  const admin = adminClient();
  account = {
    email: `homeklin-shot-admin-${randomUUID().slice(0, 8)}@example.com`,
    password: randomBytes(18).toString("base64url"),
  };
  const { data, error } = await admin.auth.admin.createUser({
    ...account,
    email_confirm: true,
    user_metadata: { full_name: "Uji Admin" },
  });
  if (error || !data.user) throw new Error(`Could not create the admin screenshot user: ${error?.message}`);
  userId = data.user.id;
  const role = await admin.from("profiles").update({ role: "admin" }).eq("id", userId);
  if (role.error) throw new Error(`Could not make the screenshot user an admin: ${role.error.message}`);

  const service = await admin.from("services").insert({
    id: serviceId,
    category: "fabrics",
    name_id: "Cuci Gorden",
    name_en: "Curtain Wash",
    description_id: "Pelepasan, pencucian, dan pemasangan kembali gorden.",
    description_en: "Taking down, washing and rehanging curtains.",
    price_idr: 175000,
    duration_minutes: 150,
    is_active: false,
    sort_order: 999,
  });
  if (service.error) throw new Error(`Could not add the screenshot service: ${service.error.message}`);
});

test.afterAll(async () => {
  const admin = adminClient();
  await admin.from("services").delete().eq("id", serviceId);
  if (userId) await admin.auth.admin.deleteUser(userId);
});

async function signedInPage(browser: Browser, device: Device) {
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
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/admin");
  return { context, page };
}

/** Waits for the role check to finish, so the picture shows the page, not its loading state. */
async function ready(page: Page) {
  await expect(page.getByText(/^(Memuat…|Loading…)$/)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/** The first screen (phones) and the whole page at the current width; checks there is no sideways scroll. */
async function shoot(page: Page, name: string, width: number, mobile: boolean) {
  await page.setViewportSize({ width, height: heights[width] });
  await ready(page);
  await page.evaluate(() => document.fonts.ready);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, `${name} at ${width} px scrolls sideways`).toBeLessThanOrEqual(width);
  if (mobile) await page.screenshot({ path: `${dir}/${name}-${width}-fold.png` });

  // Grow the viewport to the page so fixed bars sit where a tall screen shows them (see t4).
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>('[class*="dvh"]')) {
      const { minHeight, maxHeight } = getComputedStyle(element);
      element.style.minHeight = minHeight;
      element.style.maxHeight = maxHeight;
    }
  });
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.max(pageHeight, heights[width]) });
  await page.screenshot({ path: `${dir}/${name}-${width}.png` });
  await page.setViewportSize({ width, height: heights[width] });
}

/** Sends the empty form, then takes the cursor out of the first field so the picture shows the resting error state. */
async function submitEmpty(page: Page, submit: string, errors: number) {
  await page.getByRole("button", { name: submit }).click();
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(errors);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

// Indonesian pages first: opening an English page remembers English (the language cookie), after which
// an address without /en opens in English too.
test("the list and the forms on a desktop", async ({ browser }) => {
  const { context, page } = await signedInPage(browser, "desktop");

  // The list as it looks right after saving the extra service (switched off).
  await page.goto(`/admin/services?saved=${serviceId}`);
  await expect(page.getByRole("status").filter({ hasText: "Perubahan pada Cuci Gorden disimpan." })).toBeVisible();
  for (const width of widths.desktop) await shoot(page, "list-id", width, false);

  await page.goto("/admin/services/new");
  for (const width of widths.desktop) await shoot(page, "new-id", width, false);
  await submitEmpty(page, "Simpan layanan", 8);
  for (const width of widths.desktop) await shoot(page, "new-errors-id", width, false);

  await page.goto(`/admin/services/edit?id=${serviceId}`);
  await expect(page.getByLabel("Harga (Rp)")).toHaveValue("175000");
  for (const width of widths.desktop) await shoot(page, "edit-id", width, false);

  await page.goto("/admin/services/edit?id=tidak-ada");
  await expect(page.getByRole("heading", { name: "Layanan tidak ditemukan" })).toBeVisible();
  await shoot(page, "edit-not-found-id", 1280, false);

  await page.goto("/en/admin/services");
  for (const width of widths.desktop) await shoot(page, "list-en", width, false);
  await page.goto("/en/admin/services/new");
  await submitEmpty(page, "Save service", 8);
  for (const width of widths.desktop) await shoot(page, "new-errors-en", width, false);
  await page.goto(`/en/admin/services/edit?id=${serviceId}`);
  for (const width of widths.desktop) await shoot(page, "edit-en", width, false);
  await context.close();
});

test("the list and the form on a narrow screen", async ({ browser }) => {
  const { context, page } = await signedInPage(browser, "phone");

  await page.goto("/admin/services");
  for (const width of widths.phone) await shoot(page, "list-id", width, true);
  await page.goto("/admin/services/new");
  await submitEmpty(page, "Simpan layanan", 8);
  await shoot(page, "new-errors-id", 390, true);

  await page.goto("/en/admin/services");
  await shoot(page, "list-en", 360, true);
  await page.goto(`/en/admin/services/edit?id=${serviceId}`);
  await shoot(page, "edit-en", 390, true);
  await context.close();
});
