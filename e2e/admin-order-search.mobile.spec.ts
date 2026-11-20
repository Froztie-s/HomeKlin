import { expect, test } from "@playwright/test";
import { signedInAs } from "./setup/auth-state";

// Audit item 1 on a phone: below 1024 px the order search sits at the top of the admin menu.

test.use({ ...signedInAs.admin, viewport: { width: 360, height: 780 } });

test("finds an order from the menu at 360 px, without sideways scrolling", async ({ page }) => {
  await page.goto("/admin/services");
  const header = page.locator("header").first();
  await header.getByRole("button", { name: "Menu" }).click();
  const field = header.getByLabel("Cari nomor pesanan");
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
