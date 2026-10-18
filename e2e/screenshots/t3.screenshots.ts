import { expect, test } from "@playwright/test";

// T3 review screenshots: each shell at two phone widths and two desktop widths.
// Saved to docs/screenshots/t3/:
//   <page>-<width>.png       the whole page, with fixed bars where they really sit (top and bottom)
//   <page>-<width>-fold.png  phones only: the first screen exactly as it opens
// Run with: npm run screenshots -- t3
const surfaces = [
  { name: "customer-home", path: "/" },
  { name: "cleaner", path: "/cleaner" },
  { name: "agency", path: "/agency" },
  { name: "admin", path: "/admin" },
];

const widths = [
  { width: 360, height: 780, mobile: true },
  { width: 390, height: 844, mobile: true },
  { width: 1280, height: 800, mobile: false },
  { width: 1440, height: 900, mobile: false },
];

const dir = "docs/screenshots/t3";

for (const surface of surfaces) {
  for (const size of widths) {
    test(`${surface.name} at ${size.width} px`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: size.mobile ? 2 : 1,
        isMobile: size.mobile,
        hasTouch: size.mobile,
      });
      const page = await context.newPage();
      await page.goto(surface.path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(size.width);

      if (size.mobile) {
        await page.screenshot({ path: `${dir}/${surface.name}-${size.width}-fold.png` });
      }

      // A plain full-page capture draws fixed bars where the first screen ends, over the content.
      // Growing the viewport to the page's height puts them where a tall screen would show them.
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: size.width, height: Math.max(pageHeight, size.height) });
      await page.screenshot({ path: `${dir}/${surface.name}-${size.width}.png` });
      await context.close();
    });
  }
}
