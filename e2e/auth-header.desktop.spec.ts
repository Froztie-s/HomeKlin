import { expect, test, type Locator, type Page } from "@playwright/test";

// T5: "Masuk" ("Log in") joins bars that T4 measured to the pixel. Signed out is the widest case for
// the app bar (the signed-in chip is a 44 px avatar), so these checks run signed out, at every width
// where the bar changes, in both languages (English runs longer). Layout only, so it runs once, in the
// desktop project, with the widths set here.

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  expect(result).not.toBeNull();
  return result!;
}

async function expectNoHorizontalScroll(page: Page, width: number) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width);
}

/** The link sits on the wordmark's row, inside the screen, with a full 44 px target. */
async function expectInRow(link: Locator, wordmark: Locator, width: number) {
  const target = await box(link);
  const brand = await box(wordmark);
  expect(Math.abs(target.y + target.height / 2 - (brand.y + brand.height / 2))).toBeLessThan(2);
  expect(target.x).toBeGreaterThanOrEqual(brand.x + brand.width);
  expect(target.x + target.width).toBeLessThanOrEqual(width);
  expect(target.height).toBeGreaterThanOrEqual(44);
}

const appBar = [
  { path: "/home", label: "Masuk", home: "HomeKlin, ke beranda" },
  { path: "/en/home", label: "Log in", home: "HomeKlin, go to Home" },
];

for (const { path, label, home } of appBar) {
  for (const width of [360, 390, 1024, 1280]) {
    test(`the app bar on ${path} fits "${label}" on its one row at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      const banner = page.getByRole("banner");
      const signIn = banner.getByRole("link", { name: label, exact: true });
      await expect(signIn).toBeVisible();
      await expect(signIn).toHaveAttribute("href", path.startsWith("/en") ? "/en/login" : "/login");
      await expectInRow(signIn, banner.getByRole("link", { name: home }), width);
      expect((await box(banner)).height).toBeLessThanOrEqual(65);
      await expectNoHorizontalScroll(page, width);
    });
  }

  // Between 768 and 1023 px the five sections fill the bar; their "Akun" leads to sign-in instead.
  test(`the app bar on ${path} leaves "${label}" to the sections at 768 px`, async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(path);
    await expect(page.getByRole("banner").getByRole("link", { name: label, exact: true })).toBeHidden();
    expect((await box(page.getByRole("banner"))).height).toBeLessThanOrEqual(65);
    await expectNoHorizontalScroll(page, 768);
  });
}

const landing = [
  { path: "/", label: "Masuk", cta: "Pesan sekarang" },
  { path: "/en", label: "Log in", cta: "Book now" },
];

for (const { path, label, cta } of landing) {
  for (const width of [640, 1024, 1280]) {
    test(`the landing header at ${path} puts "${label}" before "${cta}" at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      const banner = page.getByRole("banner");
      const signIn = banner.getByRole("link", { name: label, exact: true });
      const button = banner.getByRole("link", { name: cta });
      await expect(signIn).toBeVisible();
      await expectInRow(signIn, banner.getByRole("link", { name: "HomeKlin" }), width);
      expect((await box(button)).x).toBeGreaterThanOrEqual((await box(signIn)).x + (await box(signIn)).width);
      await expectNoHorizontalScroll(page, width);
    });
  }

  test(`the landing header at ${path} keeps its 360 px row for the wordmark, language and "${cta}"`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(path);
    await expect(page.getByRole("banner").getByRole("link", { name: label, exact: true })).toBeHidden();
    await expectNoHorizontalScroll(page, 360);
  });
}
