import { expect, test, type Browser, type Page } from "@playwright/test";
import { createTestUser, deleteTestUsers, type TestUser } from "../../tests/integration/test-project";
import { bookPath, cancelOrder, fillWindow, lateWindow, sundayAfternoon, type Window } from "../booking-test-data";

// T9 review screenshots: the booking screens, at two phone and two desktop widths, in both languages.
// /services with the "Pesan" buttons; /book filled in, with its errors, when the window is gone as
// the page opens and when someone else takes it just before the customer books, and for a service
// that cannot be booked; the confirmation on /orders?booked=<id>.
// Saved to docs/screenshots/t9/:
//   <surface>-<width>.png       the whole page, with fixed bars where they really sit
//   <surface>-<width>-fold.png  phones only: the first screen exactly as it opens
// A fictional customer is made for the run in the Supabase test project, signs in once per device
// type, and is deleted at the end; every order made here is deleted with its place given back.
// Run with: npm run screenshots -- t9

const dir = "docs/screenshots/t9";
const area = "jakarta-barat";
const service = "regular";
const address = "Jl. Contoh Raya No. 12, RT 03/RW 05, Kembangan, Jakarta Barat";
type Device = "phone" | "desktop";
const widths: Record<Device, number[]> = { phone: [360, 390], desktop: [1280, 1440] };
const heights: Record<number, number> = { 360: 780, 390: 844, 1280: 800, 1440: 900 };

// One device after the other: both fill and book the same windows.
test.describe.configure({ mode: "serial" });

let customer: TestUser;
const orders: string[] = [];

test.beforeAll(async () => {
  customer = await createTestUser("t9-shots", { full_name: "Uji Pelanggan" });
});

test.afterAll(async () => {
  for (const id of orders.splice(0)) await cancelOrder(id);
  await deleteTestUsers([customer]);
});

async function newPage(browser: Browser, device: Device) {
  const width = widths[device][0];
  const mobile = device === "phone";
  const context = await browser.newContext({
    viewport: { width, height: heights[width] },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(customer.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(customer.password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  return { context, page };
}

/** The first screen (phones) and the whole page at the current width; checks there is no sideways scroll. */
async function shoot(page: Page, name: string, width: number, mobile: boolean) {
  await page.setViewportSize({ width, height: heights[width] });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^(Memuat|Loading)/)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width);
  const imagesReady = (firstScreen: boolean) =>
    page.waitForFunction(
      (onlyFirst) =>
        [...document.images]
          .filter((img) => !onlyFirst || img.getBoundingClientRect().top < window.innerHeight)
          .every((img) => img.complete && img.naturalWidth > 0),
      firstScreen,
    );
  await imagesReady(true);
  if (mobile) await page.screenshot({ path: `${dir}/${name}-${width}-fold.png` });

  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.max(pageHeight, heights[width]) });
  await imagesReady(false);
  await page.screenshot({ path: `${dir}/${name}-${width}.png` });
  await page.setViewportSize({ width, height: heights[width] });
}

async function shootAll(page: Page, device: Device, name: string) {
  for (const width of widths[device]) await shoot(page, name, width, device === "phone");
}

/**
 * Opens a page in the language of its address: an English page visited before is remembered in a
 * cookie (src/proxy.ts), which would send the next Indonesian address to English.
 */
async function open(page: Page, path: string) {
  await page.context().clearCookies({ name: "NEXT_LOCALE" });
  await page.goto(path);
}

const submit = (page: Page) => page.getByRole("button", { name: /^(Pesan sekarang|Book now)$/ });
const consent = (page: Page) => page.getByRole("switch");
const addressField = (page: Page) => page.getByLabel(/^(Alamat lengkap|Full address)$/);

async function chooseWindow(page: Page, window: Window) {
  await page.getByRole("button", { name: /^(Ganti jadwal|Change time)$/ }).click();
  await page.locator(`input[name="startsAt"][value="${window.startsAt}"]`).check();
}

for (const device of ["phone", "desktop"] as const) {
  test(`booking screens on a ${device}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const { context, page } = await newPage(browser, device);

    // The way in: every service card has its "Pesan" button.
    for (const [name, path] of [
      ["services-id", `/services?area=${area}`],
      ["services-en", `/en/services?area=${area}`],
    ] as const) {
      await open(page, path);
      await expect(page.getByRole("link", { name: /^(Pesan|Book) / }).first()).toBeVisible();
      await shootAll(page, device, name);
    }
    // Filled in and ready to book.
    // Filled in and ready to book, with the list of free windows open.
    const filled = await lateWindow(area, "15.00", 2);
    const english = await lateWindow(area, "13.00", 2);
    for (const [name, prefix, window] of [
      ["book-filled-id", "", filled],
      ["book-filled-en", "/en", english],
    ] as const) {
      // Opened on another window, then this one chosen from the list (which closes again).
      await open(page, bookPath(service, area, (window === filled ? english : filled).startsAt, prefix));
      await chooseWindow(page, window);
      await addressField(page).fill(address);
      await consent(page).check();
      await shootAll(page, device, name);
    }

    // The errors: sent without the consent and with too short an address.
    for (const [name, prefix] of [
      ["book-errors-id", ""],
      ["book-errors-en", "/en"],
    ] as const) {
      await open(page, bookPath(service, area, filled.startsAt, prefix));
      await addressField(page).fill("Jl. A");
      await page.getByRole("form").evaluate((form) => (form as HTMLFormElement).requestSubmit());
      await expect(addressField(page)).toHaveAttribute("aria-invalid", "true");
      await shootAll(page, device, name);
    }

    // The window in the address is gone by the time the page opens.
    for (const [name, prefix] of [
      ["book-gone-id", ""],
      ["book-gone-en", "/en"],
    ] as const) {
      await open(page, bookPath(service, area, sundayAfternoon(), prefix));
      await shootAll(page, device, name);
    }

    // Someone else takes the last place just before the customer books.
    for (const [name, prefix] of [
      ["book-taken-id", ""],
      ["book-taken-en", "/en"],
    ] as const) {
      await open(page, bookPath(service, area, filled.startsAt, prefix));
      await addressField(page).fill(address);
      await consent(page).check();
      const restore = await fillWindow(area, filled.startsAt);
      try {
        await submit(page).click();
        await expect(page.getByRole("alert").filter({ hasText: /baru saja terisi|just taken/ })).toBeVisible();
        await shootAll(page, device, name);
      } finally {
        await restore();
      }
    }

    // A service that cannot be booked.
    await open(page, bookPath("no-such-service", area, filled.startsAt));
    await shootAll(page, device, "book-unknown-id");

    // Booked: the confirmation, in both languages (one order per language, deleted afterwards).
    for (const [name, prefix, window] of [
      ["confirmation-id", "", filled],
      ["confirmation-en", "/en", english],
    ] as const) {
      await open(page, bookPath(service, area, window.startsAt, prefix));
      await addressField(page).fill(address);
      await consent(page).check();
      await submit(page).click();
      await page.waitForURL(/\/orders\?booked=/);
      orders.push(new URL(page.url()).searchParams.get("booked") ?? "");
      await expect(page.getByText(/^(Menunggu pembayaran|Awaiting payment)$/)).toBeVisible();
      await shootAll(page, device, name);
      await cancelOrder(orders.pop() ?? "");
    }

    await context.close();
  });
}
