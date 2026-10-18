import { expect, test } from "@playwright/test";

test("home page shows the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/HomeKlin/);
  // T3: the h1 now states the page's task; the product name is the wordmark (mobile header or desktop top bar).
  await expect(
    page.getByRole("heading", { level: 1, name: "Pilih agensi kebersihan di area Anda" }),
  ).toBeVisible();
  await expect(page.getByText("HomeKlin", { exact: true }).filter({ visible: true }).first()).toBeVisible();
});
