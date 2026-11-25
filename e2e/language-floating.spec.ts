import { expect, test, type Page } from "@playwright/test";
import { signedInAs } from "./setup/auth-state";

// In the booking flow, which has no bar, the language switch floats at the bottom-left of the viewport,
// over the bottom edge, and moves up above the phone's booking bar while it shows
// (e2e/booking-flow.spec.ts). The rest of the customer app has it in the top bar
// (e2e/language-customer-bar.spec.ts). Runs on a phone and a desktop.
const paths = ["/services", "/en/services"];

test.use(signedInAs.customer);

function toggle(page: Page, path: string) {
  return page.getByRole("group", { name: path.startsWith("/en") ? "Language" : "Bahasa" });
}

for (const path of paths) {
  test(`shows one language switch at the bottom-left of ${path}`, async ({ page }) => {
    await page.goto(path);
    const group = toggle(page, path);
    await expect(group).toHaveCount(1);
    await expect(group).toBeVisible();
    // It is no longer in the app bar.
    await expect(page.getByRole("banner").getByRole("group", { name: /Bahasa|Language/ })).toHaveCount(0);

    const viewport = page.viewportSize()!;
    const box = (await group.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x).toBeLessThanOrEqual(viewport.width / 4);
    expect(box.y + box.height).toBeGreaterThan(viewport.height / 2);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

    // The current language is marked, and the other one is a 44 px link.
    const current = group.locator('[aria-current="true"]');
    await expect(current).toHaveText(path.startsWith("/en") ? /^EN/ : /^ID/);
    const other = (await group.getByRole("link").boundingBox())!;
    expect(other.width).toBeGreaterThanOrEqual(44);
    expect(other.height).toBeGreaterThanOrEqual(44);

    // It never covers the bottom bar (phones).
    const bar = page.getByRole("navigation", { name: path.startsWith("/en") ? "Main navigation" : "Navigasi utama" });
    const barBox = (await bar.count()) > 0 ? await bar.last().boundingBox() : null;
    if (barBox && barBox.y > viewport.height / 2) expect(box.y + box.height).toBeLessThanOrEqual(barBox.y);

    // At the end of the page, the last content ends above it. On a booking step a phone may show the
    // booking bar there, whose empty spacer ends the page: then no visible text or control may sit
    // under the switch instead.
    if (path.endsWith("/services")) {
      // Polled, scrolling again each time: the catalog streams in under the page's shell, and the
      // switch glides with the booking bar.
      await expect
        .poll(async () => {
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          const zone = (await group.boundingBox())!;
          return page.evaluate((box) => {
            const items = document.querySelectorAll("main :is(a, button, input, select, textarea, label, p, h1, h2, h3, li)");
            return [...items].filter((item) => {
              if (item.closest("[data-testid='booking-bar'], [aria-hidden='true'], [inert]")) return false;
              const r = item.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.left < box.x + box.width && box.x < r.right && r.top < box.y + box.height && box.y < r.bottom;
            }).length;
          }, zone);
        })
        .toBe(0);
    } else {
      // Polled, scrolling again each time: the content streams in under the page's shell.
      await expect
        .poll(async () => {
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          const after = (await group.boundingBox())!;
          const lastBottom = await page.evaluate(
            () => document.querySelector("main")!.lastElementChild!.getBoundingClientRect().bottom,
          );
          return lastBottom <= after.y;
        })
        .toBe(true);
    }
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

test("stays in place while the page scrolls", async ({ page }) => {
  await page.goto("/services");
  const group = toggle(page, "/services");
  const before = (await group.boundingBox())!;
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const after = (await group.boundingBox())!;
  expect(Math.round(after.y)).toBe(Math.round(before.y));
  expect(Math.round(after.x)).toBe(Math.round(before.x));
});
