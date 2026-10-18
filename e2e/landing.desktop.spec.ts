import { expect, test } from "@playwright/test";

// Hero discipline on desktop screens: the headline never takes more than two lines, and the header
// stays on one line, at every common desktop width.
for (const width of [1024, 1280, 1440]) {
  test(`keeps the hero headline to two lines and the header to one line at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    const lines = await page.getByRole("heading", { level: 1 }).evaluate((heading) => {
      const range = document.createRange();
      range.selectNodeContents(heading);
      return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
    });
    expect(lines).toBeLessThanOrEqual(2);

    const header = await page.getByRole("banner").boundingBox();
    expect(header?.height).toBeLessThanOrEqual(65);
    await expect(page.getByRole("navigation", { name: "Navigasi situs" }).getByRole("link")).toHaveCount(4);
  });
}
