import { expect, test, type Page } from "@playwright/test";

// T3b review screenshots: the landing page, the customer app and the back office after the redesign,
// at two phone widths and two desktop widths. Saved to docs/screenshots/t3b/:
//   <page>-<width>.png       the whole page, with fixed bars where they really sit (top and bottom)
//   <page>-<width>-fold.png  phones only: the first screen exactly as it opens
// Run with: npm run screenshots -- t3b
const surfaces = [
  { name: "landing", path: "/" },
  { name: "home", path: "/home" },
  { name: "services", path: "/services" },
  { name: "agency", path: "/agency" },
  { name: "admin-services", path: "/admin/services" },
];

const widths = [
  { width: 360, height: 780, mobile: true },
  { width: 390, height: 844, mobile: true },
  { width: 1280, height: 800, mobile: false },
  { width: 1440, height: 900, mobile: false },
];

const dir = "docs/screenshots/t3b";

// Lazy images only start loading near the viewport, so wait until every one has really loaded.
async function imagesLoaded(page: Page) {
  await page.waitForFunction(() =>
    [...document.images].every((img) => img.complete && img.naturalWidth > 0),
  );
}

for (const surface of surfaces) {
  for (const size of widths) {
    test(`${surface.name} at ${size.width} px`, async ({ browser }) => {
      // Reduced motion: the hero's entry animation is already finished when the picture is taken.
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: size.mobile ? 2 : 1,
        isMobile: size.mobile,
        hasTouch: size.mobile,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(surface.path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(size.width);

      if (size.mobile) {
        await page.waitForFunction(() =>
          [...document.images]
            .filter((img) => img.getBoundingClientRect().top < window.innerHeight)
            .every((img) => img.complete && img.naturalWidth > 0),
        );
        await page.screenshot({ path: `${dir}/${surface.name}-${size.width}-fold.png` });
      }

      // A plain full-page capture draws fixed bars where the first screen ends, over the content.
      // Growing the viewport to the page's height puts them where a tall screen would show them.
      // Sizes tied to the viewport height (the landing hero's 100dvh) keep their first-screen value,
      // or the hero would grow with the viewport and push everything else out of the picture.
      await page.evaluate(() => {
        for (const element of document.querySelectorAll<HTMLElement>('[class*="dvh"]')) {
          const { minHeight, maxHeight } = getComputedStyle(element);
          element.style.minHeight = minHeight;
          element.style.maxHeight = maxHeight;
        }
      });
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: size.width, height: Math.max(pageHeight, size.height) });
      await imagesLoaded(page);
      await page.screenshot({ path: `${dir}/${surface.name}-${size.width}.png` });
      await context.close();
    });
  }
}
