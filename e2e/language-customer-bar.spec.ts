import { expect, test, type Page } from "@playwright/test";
import { signedInAs } from "./setup/auth-state";

// The customer pages' language switch sits in the top app bar on every page and at every width, as on
// the cleaner app (UX audit, 2026-11-18, item 3). Until then it floated at the bottom-left of the
// viewport and covered content, for example the live card's "Lihat pesanan" on /orders and the payment
// step. Runs on a phone and a desktop.
// The booking steps (/services, /pesan) have no bar: their switch floats (e2e/language-floating.spec.ts).
const paths = ["/home", "/support", "/orders", "/en/home", "/en/orders"];

test.use(signedInAs.customer);

function toggle(page: Page, path: string) {
  return page.getByRole("group", { name: path.startsWith("/en") ? "Language" : "Bahasa" });
}

for (const path of paths) {
  test(`shows one language switch, in the app bar of ${path}`, async ({ page }) => {
    await page.goto(path);
    const group = toggle(page, path);
    await expect(group).toHaveCount(1);
    await expect(page.getByRole("banner").getByRole("group", { name: /Bahasa|Language/ })).toBeVisible();

    // At the top of the page, inside the screen, not fixed over the content.
    const viewport = page.viewportSize()!;
    const box = (await group.boundingBox())!;
    expect(box.y).toBeLessThan(80);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(await group.evaluate((element) => getComputedStyle(element).position)).not.toBe("fixed");

    // The current language is marked, and the other one is a 44 px link.
    await expect(group.locator('[aria-current="true"]')).toHaveText(path.startsWith("/en") ? /^EN/ : /^ID/);
    const other = (await group.getByRole("link").boundingBox())!;
    expect(other.width).toBeGreaterThanOrEqual(44);
    expect(other.height).toBeGreaterThanOrEqual(44);

    // Nothing in the page sits under it: scrolled down on a phone, it leaves with the bar.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const after = await group.boundingBox();
    const scrolled = await page.evaluate(() => window.scrollY);
    if (scrolled > 100 && viewport.width < 768) expect(after === null || after.y + after.height <= 0).toBe(true);
  });
}

test("is reachable by keyboard and switches the language, keeping the page", async ({ page }) => {
  await page.goto("/services");
  const link = toggle(page, "/services").getByRole("link", { name: "EN English" });
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/en/services");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const group = toggle(page, "/en/services");
  await expect(group.locator('[aria-current="true"]')).toHaveText(/^EN/);
  await group.getByRole("link", { name: "ID Bahasa Indonesia" }).click();
  await expect(page).toHaveURL("/services");
});
