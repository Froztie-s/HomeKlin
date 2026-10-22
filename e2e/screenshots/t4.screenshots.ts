import { expect, test, type Page } from "@playwright/test";

// T4 review screenshots: the language switch in every bar that carries it, and the English pages
// (English runs up to 30% longer than the Indonesian default, markdown/design.md), at two phone and
// two desktop widths, plus the tablet top bar and the back-office menu with the switch open.
// Saved to docs/screenshots/t4/:
//   <page>-<width>.png       the whole page, with fixed bars where they really sit (top and bottom)
//   <page>-<width>-fold.png  phones only: the first screen exactly as it opens
// Run with: npm run screenshots -- t4
type Surface = { name: string; path: string; widths?: number[]; menu?: boolean };

const surfaces: Surface[] = [
  { name: "landing-id", path: "/" },
  { name: "landing-en", path: "/en" },
  { name: "home-id", path: "/home" },
  { name: "home-en", path: "/en/home" },
  { name: "services-en", path: "/en/services" },
  { name: "agency-en", path: "/en/agency" },
  { name: "cleaner-en", path: "/en/cleaner", widths: [360] },
  { name: "home-tablet-id", path: "/home", widths: [768] },
  { name: "home-tablet-en", path: "/en/home", widths: [768] },
  { name: "agency-menu-en", path: "/en/agency", widths: [360], menu: true },
  { name: "not-found-en", path: "/en/agencies", widths: [360, 1280] },
];

const sizes: Record<number, { width: number; height: number; mobile: boolean }> = {
  360: { width: 360, height: 780, mobile: true },
  390: { width: 390, height: 844, mobile: true },
  768: { width: 768, height: 1024, mobile: true },
  1280: { width: 1280, height: 800, mobile: false },
  1440: { width: 1440, height: 900, mobile: false },
};

const dir = "docs/screenshots/t4";

// Lazy images only start loading near the viewport, so wait until every one has really loaded.
async function imagesLoaded(page: Page) {
  await page.waitForFunction(() =>
    [...document.images].every((img) => img.complete && img.naturalWidth > 0),
  );
}

for (const surface of surfaces) {
  for (const width of surface.widths ?? [360, 390, 1280, 1440]) {
    const size = sizes[width];
    test(`${surface.name} at ${width} px`, async ({ browser }) => {
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
      if (surface.menu) {
        await page.getByRole("button", { name: "Menu" }).click();
      }

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(size.width);

      if (size.mobile) {
        await page.waitForFunction(() =>
          [...document.images]
            .filter((img) => img.getBoundingClientRect().top < window.innerHeight)
            .every((img) => img.complete && img.naturalWidth > 0),
        );
        await page.screenshot({ path: `${dir}/${surface.name}-${width}-fold.png` });
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
      await page.screenshot({ path: `${dir}/${surface.name}-${width}.png` });
      await context.close();
    });
  }
}
