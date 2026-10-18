import { expect, test } from "@playwright/test";

// On a desktop screen the same customer sections move from the bottom bar into a top bar.
test.describe("customer navigation on desktop", () => {
  test("shows the sections in a top bar and marks the current page", async ({ page }) => {
    await page.goto("/home");
    const nav = page.getByRole("navigation", { name: "Navigasi utama" });
    await expect(nav).toBeVisible();

    const box = await nav.boundingBox();
    expect(box?.y).toBeLessThan(80);

    for (const label of ["Beranda", "Layanan", "Pesanan", "Bantuan", "Akun"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Beranda" })).toHaveAttribute("aria-current", "page");
  });

  test("navigates and moves the current marker", async ({ page }) => {
    await page.goto("/home");
    const nav = page.getByRole("navigation", { name: "Navigasi utama" });

    await nav.getByRole("link", { name: "Layanan", exact: true }).click();
    await expect(page).toHaveURL("/services");
    await expect(page.getByRole("heading", { level: 1, name: "Layanan" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Layanan", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Beranda" })).not.toHaveAttribute("aria-current");

    await nav.getByRole("link", { name: "Pesanan", exact: true }).click();
    await expect(page).toHaveURL("/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Pesanan" })).toBeVisible();
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  });

  test("takes the wordmark back to the booking home", async ({ page }) => {
    await page.goto("/orders");
    await page.getByRole("link", { name: "HomeKlin, ke beranda" }).click();
    await expect(page).toHaveURL("/home");
    await expect(page.getByRole("heading", { level: 1, name: "Pesan kebersihan rumah" })).toBeVisible();
  });
});
