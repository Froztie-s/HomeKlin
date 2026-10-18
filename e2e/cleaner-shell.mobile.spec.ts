import { expect, test } from "@playwright/test";

// Cleaners work one-handed on a phone: a minimal bottom bar with two items.
test.describe("cleaner bottom navigation", () => {
  test("sits at the bottom with two items and marks the current page", async ({ page }) => {
    await page.goto("/cleaner");
    const nav = page.getByRole("navigation", { name: "Navigasi petugas" });
    await expect(nav).toBeVisible();

    const box = await nav.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && Math.round(box.y + box.height)).toBe(viewport?.height);

    await expect(nav.getByRole("link")).toHaveCount(2);
    await expect(nav.getByRole("link", { name: "Pekerjaan" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: "Pekerjaan hari ini" })).toBeVisible();
  });

  test("navigates between jobs and account", async ({ page }) => {
    await page.goto("/cleaner");
    const nav = page.getByRole("navigation", { name: "Navigasi petugas" });

    await nav.getByRole("link", { name: "Akun" }).click();
    await expect(page).toHaveURL("/cleaner/account");
    await expect(page.getByRole("heading", { level: 1, name: "Akun" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Akun" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Pekerjaan" })).not.toHaveAttribute("aria-current");

    await nav.getByRole("link", { name: "Pekerjaan" }).click();
    await expect(page).toHaveURL("/cleaner");
    await expect(nav.getByRole("link", { name: "Pekerjaan" })).toHaveAttribute("aria-current", "page");
  });

  test("gives every item a touch target of at least 44 px", async ({ page }) => {
    await page.goto("/cleaner");
    const links = page.getByRole("navigation", { name: "Navigasi petugas" }).getByRole("link");
    for (const link of await links.all()) {
      const box = await link.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
});
