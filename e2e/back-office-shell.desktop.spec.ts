import { expect, test } from "@playwright/test";
import { signedInAs } from "./setup/auth-state";

// Agency and admin pages are desktop-first: a sidebar on the left, always visible.
// Each shell is opened by a signed-in user with its role (T5).
const shells = [
  {
    name: "agency" as const,
    root: "/agency",
    navLabel: "Navigasi agensi",
    items: [
      { label: "Dasbor", path: "/agency" },
      { label: "Jadwal", path: "/agency/schedule" },
      { label: "Petugas", path: "/agency/cleaners" },
      { label: "Pesanan", path: "/agency/orders" },
      { label: "Rekaman", path: "/agency/recordings" },
    ],
  },
  {
    name: "admin" as const,
    root: "/admin",
    navLabel: "Navigasi admin",
    items: [
      { label: "Dasbor", path: "/admin" },
      { label: "Monitor Langsung", path: "/admin/monitor" },
      { label: "Tiket", path: "/admin/tickets" },
      { label: "Rekaman", path: "/admin/recordings" },
      { label: "Layanan & Harga", path: "/admin/services" },
      { label: "FAQ", path: "/admin/faq" },
    ],
  },
];

for (const shell of shells) {
  test.describe(`${shell.name} sidebar`, () => {
    test.use(signedInAs[shell.name]);

    test("is a full-height sidebar on the left with every section", async ({ page }) => {
      await page.goto(shell.root);
      const nav = page.getByRole("navigation", { name: shell.navLabel });
      await expect(nav).toBeVisible();

      const box = await nav.boundingBox();
      expect(box?.x).toBeLessThan(40);
      await expect(nav.getByRole("link")).toHaveCount(shell.items.length);
      await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
    });

    test("navigates to every section and moves the current marker", async ({ page }) => {
      await page.goto(shell.root);
      const nav = page.getByRole("navigation", { name: shell.navLabel });
      await expect(nav.getByRole("link", { name: "Dasbor" })).toHaveAttribute("aria-current", "page");

      for (const { label, path } of [...shell.items.slice(1), shell.items[0]]) {
        await nav.getByRole("link", { name: label, exact: true }).click();
        await expect(page).toHaveURL(path);
        await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
        await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute(
          "aria-current",
          "page",
        );
        await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      }
    });
  });
}
