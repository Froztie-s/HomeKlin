import { expect, test } from "@playwright/test";

// Hero discipline on desktop screens (markdown/design.md, Typography): the headline takes at most three
// lines, and the header is the 44 px utility bar plus one 64 px row, at every common desktop width.
for (const width of [1024, 1280, 1440]) {
  test(`keeps the hero headline to three lines and the header to one row at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    // Count visual rows, not distinct box tops: the serif accent words are a different, larger font,
    // so their boxes start a little higher than the grotesk on the same row. A box opens a new row
    // only when its vertical middle sits below the row above.
    const lines = await page.getByRole("heading", { level: 1 }).evaluate((heading) => {
      const range = document.createRange();
      range.selectNodeContents(heading);
      const rects = [...range.getClientRects()].filter((rect) => rect.width > 0).sort((a, b) => a.top - b.top);
      let rows = 0;
      let rowBottom = Number.NEGATIVE_INFINITY;
      for (const rect of rects) {
        if ((rect.top + rect.bottom) / 2 > rowBottom) {
          rows += 1;
          rowBottom = rect.bottom;
        } else {
          rowBottom = Math.max(rowBottom, rect.bottom);
        }
      }
      return rows;
    });
    expect(lines).toBeLessThanOrEqual(3);

    const header = await page.getByRole("banner").boundingBox();
    expect(header?.height).toBeLessThanOrEqual(44 + 65);
    await expect(page.getByRole("navigation", { name: "Navigasi situs" }).getByRole("link")).toHaveCount(4);
  });

  test(`floats the sample job card over the hero photo at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const photo = await page.getByRole("img", { name: "Petugas kebersihan mengelap meja dapur" }).boundingBox();
    const card = await page.getByRole("group", { name: "Contoh pesanan berjalan" }).boundingBox();
    expect(photo).not.toBeNull();
    expect(card).not.toBeNull();
    // The card overlaps the photo's left edge and sits in its lower half, clear of the cleaner's face.
    expect(card!.x).toBeLessThan(photo!.x);
    expect(card!.x + card!.width).toBeGreaterThan(photo!.x);
    expect(card!.y).toBeGreaterThan(photo!.y + photo!.height / 2 - card!.height);
    expect(card!.y + card!.height).toBeLessThanOrEqual(photo!.y + photo!.height);
  });
}
