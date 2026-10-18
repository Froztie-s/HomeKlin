import { expect, test } from "@playwright/test";

// On a narrow screen the back-office sidebar collapses into a top bar with a Menu button.
test.describe("back-office menu on a narrow screen", () => {
  test("hides the sections until Menu is opened", async ({ page }) => {
    await page.goto("/agency");
    const menu = page.getByRole("button", { name: "Menu" });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("navigation", { name: "Navigasi agensi" })).toBeHidden();

    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    const nav = page.getByRole("navigation", { name: "Navigasi agensi" });
    await expect(nav.getByRole("link")).toHaveCount(6);
    await expect(nav.getByRole("link", { name: "Dasbor" })).toHaveAttribute("aria-current", "page");
  });

  test("closes after choosing a section", async ({ page }) => {
    await page.goto("/agency");
    const menu = page.getByRole("button", { name: "Menu" });
    await menu.click();
    await page.getByRole("navigation", { name: "Navigasi agensi" }).getByRole("link", { name: "Jadwal" }).click();

    await expect(page).toHaveURL("/agency/schedule");
    await expect(page.getByRole("heading", { level: 1, name: "Jadwal" })).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("navigation", { name: "Navigasi agensi" })).toBeHidden();
  });

  test("closes with the Escape key and returns focus to the Menu button", async ({ page }) => {
    await page.goto("/admin");
    const menu = page.getByRole("button", { name: "Menu" });
    await menu.click();
    await expect(page.getByRole("navigation", { name: "Navigasi admin" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
  });

  test("gives the Menu button and every section a touch target of at least 44 px", async ({ page }) => {
    await page.goto("/admin");
    const menu = page.getByRole("button", { name: "Menu" });
    const menuBox = await menu.boundingBox();
    expect(menuBox?.height).toBeGreaterThanOrEqual(44);

    await menu.click();
    const links = page.getByRole("navigation", { name: "Navigasi admin" }).getByRole("link");
    await expect(links).toHaveCount(5);
    for (const link of await links.all()) {
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
});
