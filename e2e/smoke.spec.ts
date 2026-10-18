import { expect, test } from "@playwright/test";

test("landing page shows the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("HomeKlin");
  await expect(
    page.getByRole("heading", { level: 1, name: "Jasa kebersihan rumah yang bisa Anda tonton langsung" }),
  ).toBeVisible();
  await expect(page.getByRole("banner").getByText("HomeKlin", { exact: true })).toBeVisible();
});
