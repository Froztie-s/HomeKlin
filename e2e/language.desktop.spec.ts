import { expect, test } from "@playwright/test";

// T4 on desktop screens: the landing page's switch sits in the dark utility bar next to "Bantuan", and
// the back office has it in the sidebar, under the sections (markdown/design.md, Layout).
test("puts the landing page's language switch in the utility bar, beside Bantuan", async ({ page }) => {
  await page.goto("/");
  const group = page.getByRole("group", { name: "Bahasa" });
  await expect(group).toHaveCount(1);
  const help = await page.getByRole("banner").getByRole("link", { name: "Bantuan" }).boundingBox();
  const box = await group.boundingBox();
  expect(help).not.toBeNull();
  expect(box).not.toBeNull();
  // Same 44 px bar, to the right of the help link, inside the viewport.
  expect(Math.abs(box!.y + box!.height / 2 - (help!.y + help!.height / 2))).toBeLessThan(2);
  expect(box!.x).toBeGreaterThan(help!.x);
  expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
  await expect(group.locator('[aria-current="true"]')).toHaveText(/^ID/);
});

test("keeps every link of the English landing page in English", async ({ page }) => {
  await page.goto("/en");
  const hrefs = await page
    .locator("a[href]:not([hreflang])")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  expect(hrefs.length).toBeGreaterThan(10);
  for (const href of hrefs) {
    expect(href, "an in-page anchor or an English address").toMatch(/^(#|\/en(\/|$|#))/);
  }
});

const backOffices = [
  {
    name: "agency",
    root: "/agency",
    nav: "Agency navigation",
    labels: ["Dashboard", "Schedule", "Cleaners", "Orders", "Recordings"],
  },
  {
    name: "admin",
    root: "/admin",
    nav: "Admin navigation",
    labels: ["Dashboard", "Live monitor", "Tickets", "Recordings", "Services & prices", "FAQ"],
  },
];

for (const office of backOffices) {
  test(`switches the ${office.name} back office to English from the sidebar`, async ({ page }) => {
    await page.goto(office.root);
    const sidebar = page.getByRole("complementary");
    await sidebar.getByRole("group", { name: "Bahasa" }).getByRole("link", { name: "EN English" }).click();

    await expect(page).toHaveURL(`/en${office.root}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    const nav = page.getByRole("navigation", { name: office.nav });
    await expect(nav.getByRole("link")).toHaveText(office.labels);
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

    await nav.getByRole("link", { name: office.labels[1] }).click();
    await expect(page).toHaveURL(`/en${office.root}/${office.name === "agency" ? "schedule" : "monitor"}`);
    await expect(page.getByRole("heading", { level: 1, name: office.labels[1] })).toBeVisible();
  });
}
