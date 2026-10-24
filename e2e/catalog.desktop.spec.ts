import { expect, test } from "@playwright/test";

// T8 on a desktop screen: the customer catalog uses the width (markdown/design.md, Layout) instead of
// stretching the phone column: the area picker sits beside its free slots, the type filter fits one
// row under the search, and the services sit in two columns with their photo on top.
test.use({ viewport: { width: 1280, height: 800 } });

test("puts the area beside its free slots and the services in two columns", async ({ page }) => {
  await page.goto("/services");
  const area = await page.getByRole("combobox", { name: "Area layanan" }).boundingBox();
  const slots = await page.getByRole("heading", { level: 2, name: "Jadwal kosong di Jakarta Selatan" }).boundingBox();
  expect(area).not.toBeNull();
  expect(slots).not.toBeNull();
  expect(slots!.x).toBeGreaterThan(area!.x + area!.width);

  const search = await page.getByRole("searchbox", { name: "Cari layanan" }).boundingBox();
  const types = page.getByRole("group", { name: "Jenis layanan" }).getByRole("button");
  const firstType = await types.first().boundingBox();
  const lastType = await types.last().boundingBox();
  expect(firstType!.y).toBeGreaterThan(search!.y + search!.height);
  expect(Math.abs(lastType!.y - firstType!.y)).toBeLessThan(2);

  const cards = page.getByRole("list", { name: "Daftar harga" }).getByRole("listitem");
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
  expect(second!.x).toBeGreaterThan(first!.x + first!.width);

  // The photo spans the top of a wide card.
  const regular = cards.filter({ has: page.getByRole("heading", { name: "Pembersihan Rutin" }) });
  const card = await regular.boundingBox();
  const photo = await regular.getByRole("img").boundingBox();
  expect(photo!.width).toBeGreaterThan(card!.width * 0.9);
  expect(photo!.y).toBeLessThan(card!.y + 4);
});

test("keeps the keyboard on the area while the list follows the choice", async ({ page }) => {
  await page.goto("/services");
  const area = page.getByRole("combobox", { name: "Area layanan" });
  await area.focus();
  await area.selectOption("jakarta-pusat");
  await expect(page).toHaveURL("/services?area=jakarta-pusat");
  await expect(page.getByRole("heading", { level: 2, name: "Jadwal kosong di Jakarta Pusat" })).toBeVisible();
  await expect(area).toBeFocused();
});
