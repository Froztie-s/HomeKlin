import { expect, test, type Locator } from "@playwright/test";
import { signedInAs, signedOut } from "./setup/auth-state";

// T4 on a 360 px phone: the language switch fits the existing bars without a second row
// (markdown/design.md, Layout). The landing header keeps one 64 px row with the wordmark, a compact
// link to the other language and "Pesan sekarang"; the app bars carry the full ID | EN toggle; the
// back office puts it in its menu, under the sections.
// Public pages are checked signed out; the cleaner app and the back office by a signed-in user with
// their role (T5).
test.use({ viewport: { width: 360, height: 740 } });

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  expect(result).not.toBeNull();
  return result!;
}

/** Each box starts where the previous one ends (same row, left to right) and none leaves the screen. */
async function expectOneRow(locators: Locator[]) {
  const boxes = await Promise.all(locators.map(box));
  const middle = boxes[0].y + boxes[0].height / 2;
  for (const [index, current] of boxes.entries()) {
    expect(Math.abs(current.y + current.height / 2 - middle), `item ${index} on the same row`).toBeLessThan(2);
    expect(current.x, `item ${index} inside the screen`).toBeGreaterThanOrEqual(0);
    expect(current.x + current.width, `item ${index} inside the screen`).toBeLessThanOrEqual(360);
    if (index > 0) {
      const previous = boxes[index - 1];
      expect(current.x, `item ${index} after item ${index - 1}`).toBeGreaterThanOrEqual(previous.x + previous.width);
    }
  }
}

for (const { path, cta, other, group } of [
  { path: "/", cta: "Pesan sekarang", other: "EN English", group: "Bahasa" },
  { path: "/en", cta: "Book now", other: "ID Bahasa Indonesia", group: "Language" },
]) {
  test(`keeps the landing header at ${path} to one row with the wordmark, the language link and the CTA`, async ({
    page,
  }) => {
    await page.goto(path);
    const banner = page.getByRole("banner");
    expect((await box(banner)).height).toBeLessThanOrEqual(65);

    const language = banner.getByRole("group", { name: group }).getByRole("link", { name: other });
    await expectOneRow([
      banner.getByRole("link", { name: "HomeKlin" }),
      language,
      banner.getByRole("link", { name: cta }),
    ]);
    const target = await box(language);
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  });
}

for (const { path, group, role, session } of [
  { path: "/home", group: "Bahasa", role: null, session: signedOut },
  { path: "/en/home", group: "Language", role: null, session: signedOut },
  { path: "/cleaner", group: "Bahasa", role: "Petugas", session: signedInAs.cleaner },
  { path: "/en/cleaner", group: "Language", role: "Cleaner", session: signedInAs.cleaner },
]) {
  test.describe(`app bar on ${path}`, () => {
    test.use(session);

    test(`gives the app bar on ${path} the wordmark and the full language toggle`, async ({ page }) => {
      await page.goto(path);
      const banner = page.getByRole("banner");
      const toggle = banner.getByRole("group", { name: group });
      await expect(toggle.getByRole("link")).toHaveCount(1);
      await expect(toggle.locator('[aria-current="true"]')).toHaveCount(1);

      const row = [banner.getByText("HomeKlin", { exact: true })];
      if (role) row.push(banner.getByText(role, { exact: true }));
      row.push(toggle);
      await expectOneRow(row);

      const link = await box(toggle.getByRole("link"));
      expect(link.width).toBeGreaterThanOrEqual(44);
      expect(link.height).toBeGreaterThanOrEqual(44);
    });
  });
}

test.describe("back office", () => {
  test.use(signedInAs.agency);

  test("puts the back office's language switch in the menu, under the sections", async ({ page }) => {
    await page.goto("/agency");
    const menu = page.getByRole("button", { name: "Menu" });
    await expect(page.getByRole("group", { name: "Bahasa" })).toBeHidden();

    await menu.click();
    const sections = await box(page.getByRole("navigation", { name: "Navigasi agensi" }));
    const toggle = page.getByRole("group", { name: "Bahasa" });
    expect((await box(toggle)).y).toBeGreaterThanOrEqual(sections.y + sections.height);

    await toggle.getByRole("link", { name: "EN English" }).click();
    await expect(page).toHaveURL("/en/agency");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "false");

    await menu.click();
    await expect(page.getByRole("navigation", { name: "Agency navigation" }).getByRole("link")).toHaveText([
      "Dashboard",
      "Schedule",
      "Cleaners",
      "Orders",
      "Recordings",
    ]);
  });
});
