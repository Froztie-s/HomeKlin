import { expect, test, type Browser, type Page } from "@playwright/test";
import { createJobWorld, sessionOf, type JobWorld } from "../job-test-data";
import type { StorageState } from "../setup/auth-state";

// The customer's account menu (it replaced the account page), at two phone widths and two desktop
// widths, in both languages: the home with the menu closed, with the menu open, and the services page
// scrolled to its end. (The language switch floated at the bottom-left when these were first taken; it
// is in the app bar since 2026-11-18.) Saved to docs/screenshots/account-menu/<surface>-<lang>-<width>.png,
// viewport only. Fictional data in the Supabase test project, deleted at the end.
// Run with: npm run screenshots -- account-menu

const dir = "docs/screenshots/account-menu";
type Device = "phone" | "desktop";
const widths: Record<Device, number[]> = { phone: [360, 390], desktop: [1280, 1440] };
const heights: Record<number, number> = { 360: 740, 390: 844, 1280: 800, 1440: 900 };
const languages = [
  ["id", "", "Akun", "Navigasi utama"],
  ["en", "/en", "Account", "Main navigation"],
] as const;

test.describe.configure({ mode: "serial" });

let world: JobWorld;
let customer: StorageState;

test.beforeAll(async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  world = await createJobWorld("account-menu");
  customer = await sessionOf(browser, baseURL, world.customer);
});

test.afterAll(async () => {
  await world?.cleanup();
});

async function newPage(browser: Browser, device: Device) {
  const width = widths[device][0];
  const mobile = device === "phone";
  const context = await browser.newContext({
    viewport: { width, height: heights[width] },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: "reduce",
    storageState: customer,
  });
  return { context, page: await context.newPage() };
}

async function shoot(page: Page, name: string, width: number) {
  await page.setViewportSize({ width, height: heights[width] });
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({ path: `${dir}/${name}-${width}.png` });
}

for (const device of ["phone", "desktop"] as const) {
  test(`the account menu on a ${device}`, async ({ browser }) => {
    test.setTimeout(180_000);
    const { context, page } = await newPage(browser, device);
    for (const [lang, prefix, account, navName] of languages) {
      for (const width of widths[device]) {
        await page.setViewportSize({ width, height: heights[width] });
        await context.clearCookies({ name: "NEXT_LOCALE" });
        await page.goto(`${prefix}/home`);
        const button = page.getByRole("navigation", { name: navName }).getByRole("button", { name: account });
        await expect(button).toBeEnabled();
        await shoot(page, `home-closed-${lang}`, width);
        await button.click();
        await expect(page.getByRole("menu")).toBeVisible();
        await shoot(page, `home-menu-${lang}`, width);
        await page.keyboard.press("Escape");

        await page.goto(`${prefix}/services`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await shoot(page, `services-end-${lang}`, width);
      }
    }
    await context.close();
  });
}
