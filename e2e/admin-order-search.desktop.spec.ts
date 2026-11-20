import { expect, test } from "@playwright/test";
import { signedInAs } from "./setup/auth-state";

// Audit item 1: admin finds an order by its number from any admin page. The field sits in the dark
// sidebar under the role card; it reads "hk 1170" or "1170" as "HK-1170" and goes to the order's page,
// and an input that cannot be an order number shows an error under the field without leaving the page.
// The number used here is far beyond the sequence, so the order page answers with its not-found state.

test.use(signedInAs.admin);

const missing = "HK-9999999";

test("goes to the order's page from any admin page, whatever way the number is written", async ({ page }) => {
  await page.goto("/admin/services");
  const search = page.getByRole("complementary").getByRole("search", { name: "Cari nomor pesanan" });
  await search.getByLabel("Cari nomor pesanan").fill("  hk 9999999 ");
  await search.getByRole("button", { name: "Cari" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/orders/${missing}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Pesanan tidak ditemukan" })).toBeAttached();

  // The field starts empty on the next page; a bare number works too, and Enter sends it.
  const field = page.getByRole("complementary").getByLabel("Cari nomor pesanan");
  await expect(field).toHaveValue("");
  await field.fill("9999998");
  await field.press("Enter");
  await expect(page).toHaveURL(/\/admin\/orders\/HK-9999998$/);
});

test("shows an error under the field and stays on the page for an input that is not an order number", async ({ page }) => {
  await page.goto("/admin/faq");
  const search = page.getByRole("complementary").getByRole("search", { name: "Cari nomor pesanan" });
  const field = search.getByLabel("Cari nomor pesanan");
  await field.fill("HK-12");
  await field.press("Enter");
  await expect(search.getByRole("alert")).toContainText("Itu bukan nomor pesanan. Tulis seperti HK-1170 atau 1170.");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveValue("HK-12");
  await expect(page).toHaveURL(/\/admin\/faq$/);
});

test("works in English, keeping the language", async ({ page }) => {
  await page.goto("/en/admin/monitor");
  const field = page.getByRole("complementary").getByLabel("Find an order number");
  await field.fill("1170x");
  await field.press("Enter");
  await expect(page.getByRole("complementary").getByRole("alert")).toContainText("That is not an order number.");
  await field.fill("hk-9999999");
  await field.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/en/admin/orders/${missing}$`));
});
