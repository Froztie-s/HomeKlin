import { expect, test, type Page } from "@playwright/test";

// T8 review screenshots: the customer catalog on real data, at two phone and two desktop widths.
// /services with its free slots (closed, and with every free slot shown), with a type filter, the
// empty state of an area nobody serves (Jakarta Utara), a search with no match, the loading state,
// the English page; the customer home; and the landing page's services section.
// Saved to docs/screenshots/t8/:
//   <surface>-<width>.png       the whole page (or the section), with fixed bars where they really sit
//   <surface>-<width>-fold.png  phones only: the first screen exactly as it opens
// Run with: npm run screenshots -- t8
type Surface = {
  name: string;
  path: string;
  /** Open every <details> before the picture (the full list of free slots). */
  openDetails?: boolean;
  /** Only this element, for a section of a long page. */
  section?: string;
  /** Without JavaScript the streamed catalog keeps its loading placeholder: the loading state. */
  noScript?: boolean;
};

const surfaces: Surface[] = [
  { name: "services-id", path: "/services" },
  { name: "services-slots-id", path: "/services", openDetails: true },
  { name: "services-filter-id", path: "/services?area=jakarta-timur&type=fabrics" },
  { name: "services-empty-id", path: "/services?area=jakarta-utara" },
  { name: "services-nomatch-id", path: "/services?q=karpet%20mobil" },
  { name: "services-loading-id", path: "/services", noScript: true },
  { name: "services-en", path: "/en/services?area=jakarta-barat" },
  { name: "services-slots-en", path: "/en/services?area=jakarta-barat", openDetails: true },
  { name: "services-empty-en", path: "/en/services?area=jakarta-utara" },
  { name: "home-id", path: "/home" },
  { name: "home-en", path: "/en/home" },
  { name: "landing-services-id", path: "/", section: "#layanan" },
  { name: "landing-services-en", path: "/en", section: "#layanan" },
];

const sizes: Record<number, { width: number; height: number; mobile: boolean }> = {
  360: { width: 360, height: 780, mobile: true },
  390: { width: 390, height: 844, mobile: true },
  1280: { width: 1280, height: 800, mobile: false },
  1440: { width: 1440, height: 900, mobile: false },
};

const dir = "docs/screenshots/t8";

// Lazy images only start loading near the viewport, so wait until every one has really loaded.
async function imagesLoaded(page: Page, onlyFirstScreen = false) {
  await page.waitForFunction((firstScreen) => {
    return [...document.images]
      .filter((img) => !firstScreen || img.getBoundingClientRect().top < window.innerHeight)
      .every((img) => img.complete && img.naturalWidth > 0);
  }, onlyFirstScreen);
}

for (const surface of surfaces) {
  for (const width of [360, 390, 1280, 1440]) {
    const size = sizes[width];
    test(`${surface.name} at ${width} px`, async ({ browser }) => {
      // Reduced motion: no entry animation or pulse is caught halfway.
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: size.mobile ? 2 : 1,
        isMobile: size.mobile,
        hasTouch: size.mobile,
        reducedMotion: "reduce",
        javaScriptEnabled: !surface.noScript,
      });
      const page = await context.newPage();
      await page.goto(surface.path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (surface.noScript) {
        await expect(page.getByRole("status").first()).toBeVisible();
      } else if (surface.path.includes("services")) {
        // The catalog has streamed in: the area picker is there and no loading line is left.
        await expect(page.getByRole("combobox", { name: /^(Area layanan|Service area)$/ })).toBeVisible();
        await expect(page.getByText(/^(Memuat|Loading)/)).toHaveCount(0);
      }
      if (surface.openDetails) {
        for (const details of await page.locator("main details").all()) await details.locator("summary").click();
      }
      await page.evaluate(() => document.fonts.ready);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(size.width);

      if (surface.section) {
        const section = page.locator(surface.section);
        await section.scrollIntoViewIfNeeded();
        await page.setViewportSize({ width: size.width, height: Math.max(size.height, 2400) });
        await imagesLoaded(page);
        await section.screenshot({ path: `${dir}/${surface.name}-${width}.png` });
        await context.close();
        return;
      }

      if (size.mobile) {
        if (!surface.noScript) await imagesLoaded(page, true);
        await page.screenshot({ path: `${dir}/${surface.name}-${width}-fold.png` });
      }

      // A plain full-page capture draws fixed bars where the first screen ends, over the content.
      // Growing the viewport to the page's height puts them where a tall screen would show them.
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: size.width, height: Math.max(pageHeight, size.height) });
      if (!surface.noScript) await imagesLoaded(page);
      await page.screenshot({ path: `${dir}/${surface.name}-${width}.png` });
      await context.close();
    });
  }
}
