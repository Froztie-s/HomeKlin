import { expect, test } from "@playwright/test";
import { signedInAs } from "./setup/auth-state";

// Audit item 1 on a phone: below 1024 px the order search sits at the top of the admin menu. The shell
// draws the search twice (sidebar from 1024 px, menu below), and exactly one copy is ever shown. The field
// is found by its role, not by getByLabel: the search form is named by the same label, so getByLabel
// matches the form as well as the input.

test.use({ ...signedInAs.admin, viewport: { width: 360, height: 780 } });

test("finds an order from the menu at 360 px, without sideways scrolling", async ({ page }) => {
  await page.goto("/admin/services");
  const header = page.locator("header").first();
  await header.getByRole("button", { name: "Menu" }).click();
  // The sidebar's copy is hidden on a phone, so only the menu's search is in the page.
  await expect(page.getByRole("search", { name: "Cari nomor pesanan" })).toHaveCount(1);
  const field = header.getByRole("search", { name: "Cari nomor pesanan" }).getByRole("textbox", { name: "Cari nomor pesanan" });
  await expect(field).toBeVisible();
  expect((await field.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await field.fill("abc");
  await header.getByRole("button", { name: "Cari" }).click();
  await expect(header.getByRole("alert")).toContainText("Itu bukan nomor pesanan.");
  await expect(page).toHaveURL(/\/admin\/services$/);

  await field.fill("9999999");
  await header.getByRole("button", { name: "Cari" }).click();
  await expect(page).toHaveURL(/\/admin\/orders\/HK-9999999$/);
});
