import { expect, test, type Page } from "@playwright/test";

// T4, markdown/SPEC.md "Language": every page works in Indonesian and English, with a visible switch
// that remembers the choice. Indonesian is the default for every new visitor, whatever the browser
// prefers; a chosen language is kept in the NEXT_LOCALE cookie for a year. Runs on a phone (the
// header's compact switch) and on a desktop (the switch in the utility bar).
const headline = {
  id: "Jasa kebersihan rumah yang bisa Anda tonton langsung",
  en: "A home cleaning service you can watch live",
};

// The switch is a group of links named by the page's language; each link is named by the language it
// opens, in that language, starting with its visible code ("EN English").
function switchTo(page: Page, language: "en" | "id") {
  const group = page.getByRole("group", { name: language === "en" ? "Bahasa" : "Language" });
  return group.getByRole("link", { name: language === "en" ? "EN English" : "ID Bahasa Indonesia" });
}

test.describe("a browser that prefers English", () => {
  test.use({ locale: "en-US", extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" } });

  test("still opens the site in Indonesian", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "id");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline.id);
  });
});

test.describe("switching the language on the landing page", () => {
  test("opens the English page, keeps the tab title and remembers the choice for a year", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await switchTo(page, "en").click();

    await expect(page).toHaveURL("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline.en);
    await expect(page.getByRole("heading", { level: 1 }).locator("em")).toHaveText("watch live");
    await expect(page).toHaveTitle("HomeKlin");

    const cookie = (await context.cookies()).find(({ name }) => name === "NEXT_LOCALE");
    expect(cookie?.value).toBe("en");
    const daysLeft = ((cookie?.expires ?? 0) - Date.now() / 1000) / 86_400;
    expect(daysLeft).toBeGreaterThan(360);
    expect(daysLeft).toBeLessThan(370);
  });

  test("brings a returning visitor back to the language they chose", async ({ page }) => {
    await page.goto("/");
    await switchTo(page, "en").click();
    await expect(page).toHaveURL("/en");

    await page.goto("/");
    await expect(page).toHaveURL("/en");
    await page.goto("/home");
    await expect(page).toHaveURL("/en/home");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("switches back to Indonesian at the plain address", async ({ page }) => {
    await page.goto("/en");
    await switchTo(page, "id").click();

    await expect(page).toHaveURL("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "id");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline.id);

    await page.goto("/home");
    await expect(page).toHaveURL("/home");
    await expect(page.locator("html")).toHaveAttribute("lang", "id");
  });

  test("marks the current language, so the switch never shows two choices as equal", async ({ page }) => {
    await page.goto("/en");
    await expect(switchTo(page, "id")).toHaveAttribute("hreflang", "id");
    await expect(switchTo(page, "id")).toHaveAttribute("lang", "id");
    // The full toggle (desktop) also shows the current language, marked aria-current; the compact
    // phone version shows only the other language.
    const current = page.getByRole("group", { name: "Language" }).locator('[aria-current="true"]');
    for (const element of await current.all()) {
      await expect(element).toHaveText(/^EN/);
      await expect(element).toHaveAttribute("lang", "en");
    }
  });
});

test.describe("the customer app in English", () => {
  test("switches from the app bar and stays in English while navigating", async ({ page }) => {
    await page.goto("/home");
    await switchTo(page, "en").click();

    await expect(page).toHaveURL("/en/home");
    await expect(page.getByRole("heading", { level: 1, name: "Book a home cleaning" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    for (const label of ["Home", "Services", "Orders", "Help", "Account"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    }

    await nav.getByRole("link", { name: "Services", exact: true }).click();
    await expect(page).toHaveURL("/en/services");
    await expect(page.getByRole("heading", { level: 1, name: "Services" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Services", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveTitle("Services · HomeKlin");
  });

  test("shows prices the Indonesian way on English pages", async ({ page }) => {
    await page.goto("/en/services");
    const prices = page.getByRole("main").getByText(/^Rp\s[\d.]+$/);
    await expect(prices.first()).toBeVisible();
    for (const price of await prices.allTextContents()) expect(price).toMatch(/^Rp\s\d{1,3}(\.\d{3})*$/);
    // The one full price (T8): never "from" a price, and never "IDR 85,000".
    await expect(page.getByRole("main").getByText("from", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("main")).not.toContainText("IDR");
  });
});

test.describe("addresses", () => {
  test("drop the Indonesian prefix", async ({ page }) => {
    await page.goto("/id/home");
    await expect(page).toHaveURL("/home");
  });

  test("answer an unknown page with a 404 in the page's language", async ({ page }) => {
    const indonesian = await page.goto("/agencies");
    expect(indonesian?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "id");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Halaman tidak ditemukan");

    const english = await page.goto("/en/agencies");
    expect(english?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
    await expect(page.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/en");
  });
});
