import { expect, test } from "@playwright/test";

// markdown/PRODUCT.md: usable from 360 px wide with no horizontal scroll. Checked on every page that
// exists, in Indonesian and in English (English runs up to 30% longer, markdown/design.md).
test.use({ viewport: { width: 360, height: 740 } });

const indonesianPages = [
  "/",
  "/home",
  "/services",
  "/orders",
  "/support",
  "/account",
  "/cleaner",
  "/cleaner/account",
  "/agency",
  "/agency/schedule",
  "/agency/cleaners",
  "/agency/orders",
  "/agency/recordings",
  "/admin",
  "/admin/monitor",
  "/admin/tickets",
  "/admin/recordings",
  "/admin/services",
  "/admin/faq",
];

const pages = [...indonesianPages, ...indonesianPages.map((path) => (path === "/" ? "/en" : `/en${path}`))];

for (const path of pages) {
  test(`${path} has no horizontal scroll at 360 px`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
  });
}
