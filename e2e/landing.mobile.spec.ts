import { expect, test } from "@playwright/test";

// On phones the redesign stacks everything in one column (markdown/design.md, Layout): the sample job
// card sits below the hero photo instead of over it, and the desktop-only utility bar is hidden.
test.use({ viewport: { width: 360, height: 740 } });

test("stacks the sample job card under the hero photo on a 360 px phone", async ({ page }) => {
  await page.goto("/");
  const photo = await page.getByRole("img", { name: "Petugas kebersihan mengelap meja dapur" }).boundingBox();
  const card = await page.getByRole("group", { name: "Contoh pesanan berjalan" }).boundingBox();
  expect(photo).not.toBeNull();
  expect(card).not.toBeNull();
  expect(card!.y).toBeGreaterThanOrEqual(photo!.y + photo!.height);
  expect(card!.x).toBeGreaterThanOrEqual(0);
  expect(card!.x + card!.width).toBeLessThanOrEqual(360);
});

test("hides the utility bar and keeps the header to one 64 px row", async ({ page }) => {
  await page.goto("/");
  const header = await page.getByRole("banner").boundingBox();
  expect(header?.height).toBeLessThanOrEqual(65);
  await expect(page.getByRole("banner").getByRole("link", { name: "Pesan sekarang" })).toBeVisible();
});
