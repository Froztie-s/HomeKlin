import { expect, test, type Page } from "@playwright/test";
import { createTestUser, deleteTestUsers, type TestUser } from "../tests/integration/test-project";
import { cancelOrder, lateWindow } from "./booking-test-data";
import { bookSignedIn } from "./order-test-data";

// The booking flow's focused layout (2026-11-17), on a phone and a desktop. "Pesan sekarang" on the
// landing page opens step 1 (the service and the time). While the customer books (step 1 /services,
// step 2 /pesan, step 3 /orders/pay) the app's navigation is gone: one header with "Kembali" (44 px,
// reachable by keyboard right after the skip link), the steps, and the floating ID | EN switch, which
// keeps the step's choice and never covers the form or the payment button. "Kembali" goes from step 2
// to step 1 with the choice and what was typed, from step 1 back to where the customer came from, and
// from the payment to the customer's orders.
// Test data: step 3 books one late window in Jakarta Selatan (the default area, where no other spec
// books), 08.00 on the phone and 10.00 on the desktop, for a customer made for the run; the order and
// the customer are deleted at the end with the place given back.

const mainNav = (page: Page, english = false) =>
  page.getByRole("navigation", { name: english ? "Main navigation" : "Navigasi utama" });
const backLink = (page: Page, name: string) => page.getByRole("banner").getByRole("link", { name, exact: true });

/**
 * Presses "Kembali" once React runs it: before that (just after a full page load) the link leads to its
 * plain address, which is right without JavaScript but not what these tests check.
 */
async function pressBack(page: Page, name: string) {
  const link = backLink(page, name);
  await link.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        const ready = () => Object.keys(element).some((key) => key.startsWith("__reactProps"));
        const check = () => (ready() ? resolve() : requestAnimationFrame(check));
        check();
      }),
  );
  await link.click();
}

async function expectFocused(page: Page, back: string, english = false) {
  await expect(backLink(page, back)).toBeVisible();
  await expect(mainNav(page, english)).toHaveCount(0);
  const box = (await backLink(page, back).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** How many visible texts and controls of the page sit under a box (the floating switch). */
function coveredBy(page: Page, zone: { x: number; y: number; width: number; height: number }) {
  return page.evaluate((box) => {
    const items = document.querySelectorAll("main :is(a, button, input, select, textarea, label, p, h1, h2, h3, li)");
    return [...items].filter((item) => {
      if (item.closest("[data-testid='booking-bar'], [aria-hidden='true'], [inert]")) return false;
      const r = item.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.left < box.x + box.width && box.x < r.right && r.top < box.y + box.height && box.y < r.bottom;
    }).length;
  }, zone);
}

const languages = [
  { prefix: "", cta: "Pesan sekarang", heading: "Pilih layanan dan jam", step: "Langkah 1 dari 3", back: "Kembali" },
  { prefix: "/en", cta: "Book now", heading: "Choose a service and a time", step: "Step 1 of 3", back: "Back" },
];

test.describe("Pesan sekarang on the landing page", () => {
  for (const language of languages) {
    test(`opens step 1, focused, and ${language.back} leads back to the landing page (${language.prefix || "/"})`, async ({ page }) => {
      const landing = language.prefix || "/";
      await page.goto(landing);
      await page.getByRole("banner").getByRole("link", { name: language.cta }).click();

      await expect(page).toHaveURL(`${language.prefix}/services`);
      await expect(page.getByRole("heading", { level: 1, name: language.heading })).toBeVisible();
      await expect(page.getByText(language.step, { exact: true })).toBeVisible();
      await expectFocused(page, language.back, language.prefix === "/en");

      await pressBack(page, language.back);
      await expect(page).toHaveURL(landing);
      await expect(page.getByRole("banner").getByRole("link", { name: language.cta })).toBeVisible();
    });
  }
});

test.describe("the booking steps", () => {
  test("show no navigation, only Kembali in the header, reachable right after the skip link", async ({ page }) => {
    for (const { path, step } of [
      { path: "/services", step: "Langkah 1 dari 3" },
      { path: "/pesan", step: "Langkah 2 dari 3" },
    ]) {
      await page.goto(path);
      await expect(page.getByText(step, { exact: true })).toBeVisible();
      await expectFocused(page, "Kembali");
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Langsung ke konten utama" })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(backLink(page, "Kembali")).toBeFocused();
    }
  });

  test("Kembali on step 1 opened from outside the site leads to the customer home", async ({ page }) => {
    await page.goto("/services");
    await pressBack(page, "Kembali");
    await expect(page).toHaveURL("/home");
    await expect(mainNav(page)).toBeVisible();
  });

  test("Kembali on step 2 returns to step 1 with the choice, and step 2 keeps what was typed", async ({ page }) => {
    const address = "Jl. Contoh Kembali No. 7, Jakarta Selatan";
    await page.goto("/pesan?layanan=regular&area=jakarta-selatan");
    await expect(page.getByLabel("Pilih layanan")).toHaveValue("regular");
    await page.getByLabel("Alamat lengkap").fill(address);

    await pressBack(page, "Kembali");
    await expect(page).toHaveURL("/services?area=jakarta-selatan&layanan=regular");
    await expect(page.getByText("Langkah 1 dari 3", { exact: true })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Pembersihan Rutin", exact: true })).toBeChecked();

    // Back on step 2, what was typed comes back.
    await page.goto("/pesan?layanan=regular&area=jakarta-selatan");
    await expect(page.getByLabel("Alamat lengkap")).toHaveValue(address);
  });

  test("Kembali on step 1 after moving inside the flow leads to where the customer came from", async ({ page }) => {
    await page.goto("/support");
    await mainNav(page).getByRole("link", { name: "Layanan", exact: true }).click();
    await expect(page).toHaveURL("/services");

    // Step 1 to step 2 and back again: the browser's history now ends on a step, so step 1's
    // Kembali goes to the page the customer came from, not back to step 2.
    await page.getByRole("radio", { name: "Pembersihan Rutin", exact: true }).check();
    await page.getByRole("region", { name: "Jam kosong di Jakarta Selatan" }).getByRole("radio", { disabled: false }).first().check();
    await page.getByRole("form", { name: "Ringkasan" }).getByRole("button", { name: "Pesan sekarang" }).click();
    await expect(page).toHaveURL(/\/pesan\?/);
    await expect(page.getByText("Langkah 2 dari 3", { exact: true })).toBeVisible();
    await pressBack(page, "Kembali");
    await expect(page).toHaveURL(/\/services\?area=jakarta-selatan&layanan=regular&starts=/);
    await pressBack(page, "Kembali");
    await expect(page).toHaveURL("/support");
  });

  test("keep the language switch at the bottom-left; it keeps the step's choice and never covers the form", async ({ page }) => {
    await page.goto("/pesan?layanan=regular&area=jakarta-selatan");
    const group = page.getByRole("group", { name: "Bahasa" });
    await expect(group).toHaveCount(1);
    await expect(page.getByRole("banner").getByRole("group")).toHaveCount(0);
    const viewport = page.viewportSize()!;
    const box = (await group.boundingBox())!;
    expect(box.x).toBeLessThanOrEqual(viewport.width / 4);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.y + box.height).toBeGreaterThan(viewport.height - 120);

    // At the end of the page no text or control of the form is under it (the phone's booking bar may
    // show there, with its empty spacer ending the page).
    // (Polled, scrolling again each time: the form streams in, and the switch glides with the bar.)
    await expect
      .poll(async () => {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        return coveredBy(page, (await group.boundingBox())!);
      })
      .toBe(0);

    await group.getByRole("link", { name: "EN English" }).click();
    await expect(page).toHaveURL("/en/pesan?layanan=regular&area=jakarta-selatan");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByLabel("Choose a service")).toHaveValue("regular");
    await expect(page.getByLabel("Service area")).toHaveValue("jakarta-selatan");
    await expectFocused(page, "Back", true);
    await page.getByRole("group", { name: "Language" }).getByRole("link", { name: "ID Bahasa Indonesia" }).click();
    await expect(page).toHaveURL("/pesan?layanan=regular&area=jakarta-selatan");
  });
});

test.describe("step 3, the payment", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  let customer: TestUser;
  const orders: string[] = [];

  test.beforeAll(async () => {
    customer = await createTestUser("flow-pay", { full_name: "Uji Pelanggan" });
  });

  test.afterAll(async () => {
    for (const id of orders.splice(0)) await cancelOrder(id);
    if (customer) await deleteTestUsers([customer]);
  });

  test("is focused too, its button is clear of the language switch, and Ke pesanan Anda leads to the orders", async ({ page }, testInfo) => {
    await page.goto("/login?cara=sandi");
    await page.getByLabel("Email", { exact: true }).fill(customer.email);
    await page.getByLabel("Kata sandi", { exact: true }).fill(customer.password);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"));

    const slot = await lateWindow("jakarta-selatan", testInfo.project.name === "desktop" ? "10.00" : "08.00");
    const orderId = await bookSignedIn(page, "regular", "jakarta-selatan", slot);
    orders.push(orderId);

    await expect(page).toHaveURL(`/orders/pay?order=${orderId}`);
    await expect(page.getByText("Langkah 3 dari 3", { exact: true })).toBeVisible();
    await expectFocused(page, "Ke pesanan Anda");

    // The payment button is not under the floating switch, wherever the page is scrolled to.
    const pay = page.getByRole("button", { name: "Bayar sekarang" });
    await pay.scrollIntoViewIfNeeded();
    const clear = async () => {
      const [button, languages] = [(await pay.boundingBox())!, (await page.getByRole("group", { name: "Bahasa" }).boundingBox())!];
      const overlaps =
        button.x < languages.x + languages.width &&
        languages.x < button.x + button.width &&
        button.y < languages.y + languages.height &&
        languages.y < button.y + button.height;
      return !overlaps;
    };
    expect(await clear()).toBe(true);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await clear()).toBe(true);

    await pressBack(page, "Ke pesanan Anda");
    await expect(page).toHaveURL("/home");
    await expect(mainNav(page)).toBeVisible();
  });
});
