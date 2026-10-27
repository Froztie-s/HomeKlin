import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createTestUser, deleteTestUsers, type TestUser } from "../../tests/integration/test-project";
import { cancelOrder, lateWindow } from "../booking-test-data";
import { orderPath } from "../order-test-data";

// T10 review screenshots: paying for an order (Midtrans Sandbox), at two phone and two desktop widths,
// in both languages. The confirmation on /orders?booked=<id> with "Bayar sekarang"; the button busy
// while the payment opens (the request is held back so the state can be seen); a refusal in the alert
// above the button (the browser sends an order the customer does not have); and the page as Midtrans
// sends the customer back, with the note that the payment is being confirmed. Midtrans' own page is
// never opened: nothing here starts a transaction.
// Saved to docs/screenshots/t10/:
//   <surface>-<width>.png       the whole page, with fixed bars where they really sit
//   <surface>-<width>-fold.png  phones only: the first screen exactly as it opens
// A fictional customer is made for the run in the Supabase test project and deleted at the end; the
// one order per device is deleted with its place given back.
// Run with: npm run screenshots -- t10

const dir = "docs/screenshots/t10";
const area = "jakarta-barat";
const service = "regular";
const address = "Jl. Contoh Raya No. 12, RT 03/RW 05, Kembangan, Jakarta Barat";
const phone = "0812 3456 7890";
type Device = "phone" | "desktop";
const widths: Record<Device, number[]> = { phone: [360, 390], desktop: [1280, 1440] };
const heights: Record<number, number> = { 360: 780, 390: 844, 1280: 800, 1440: 900 };

// One device after the other: both book the same window.
test.describe.configure({ mode: "serial" });

let customer: TestUser;
const orders: string[] = [];

test.beforeAll(async () => {
  customer = await createTestUser("t10-shots", { full_name: "Uji Pelanggan" });
});

test.afterAll(async () => {
  for (const id of orders.splice(0)) await cancelOrder(id);
  await deleteTestUsers([customer]);
});

async function newContext(browser: Browser, device: Device): Promise<BrowserContext> {
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
  await page.goto("/login?cara=sandi");
  await page.getByLabel("Email", { exact: true }).fill(customer.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(customer.password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  await page.close();
  return context;
}

/** The first screen (phones) and the whole page at the current width; checks there is no sideways scroll. */
async function shoot(page: Page, name: string, width: number, mobile: boolean) {
  await page.setViewportSize({ width, height: heights[width] });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^(Memuat|Loading)/)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width);
  if (mobile) await page.screenshot({ path: `${dir}/${name}-${width}-fold.png` });
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.max(pageHeight, heights[width]) });
  await page.screenshot({ path: `${dir}/${name}-${width}.png` });
  await page.setViewportSize({ width, height: heights[width] });
}

async function shootAll(page: Page, device: Device, name: string) {
  for (const width of widths[device]) await shoot(page, name, width, device === "phone");
}

/** Opens a page in the language of its address (a remembered English choice would redirect it). */
async function open(page: Page, path: string) {
  await page.context().clearCookies({ name: "NEXT_LOCALE" });
  await page.goto(path);
}

const payButton = (page: Page) => page.getByRole("button", { name: /^(Bayar sekarang|Pay now)$/ });

/** Waits until React has taken over the payment form (hydration), so a press runs the action in place. */
async function formReady(page: Page) {
  await page.locator('input[name="orderId"]').evaluate(
    (input) =>
      new Promise<void>((resolve) => {
        const hydrated = () => Object.keys(input).some((key) => key.startsWith("__reactFiber"));
        const check = () => (hydrated() ? resolve() : requestAnimationFrame(check));
        check();
      }),
  );
}

/**
 * Makes the payment form send another order's id, as a tampered browser would. Waits for hydration
 * first, which would write the real id back into the hidden field.
 */
async function sendOrderIdInstead(page: Page, orderId: string) {
  await formReady(page);
  await page.locator('input[name="orderId"]').evaluate((input, id) => {
    (input as HTMLInputElement).value = id;
  }, orderId);
}

for (const device of ["phone", "desktop"] as const) {
  test(`payment screens on a ${device}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const window = await lateWindow(area, "15.00", 8);
    const context = await newContext(browser, device);
    const page = await context.newPage();

    // An order that waits for payment, booked the way the customer books.
    await open(page, orderPath(service, area, window.startsAt));
    await page.getByLabel("Alamat lengkap").fill(address);
    await page.getByLabel("Nomor HP").fill(phone);
    await page.getByRole("switch").check();
    await page.getByRole("button", { name: "Pesan sekarang" }).click();
    await page.waitForURL(/\/orders\?booked=/, { timeout: 20_000 });
    const orderId = new URL(page.url()).searchParams.get("booked") ?? "";
    orders.push(orderId);

    for (const [lang, prefix] of [
      ["id", ""],
      ["en", "/en"],
    ] as const) {
      const confirmation = `${prefix}/orders?booked=${orderId}`;

      // Right after booking: the total, then "Bayar sekarang".
      await open(page, confirmation);
      await expect(payButton(page)).toBeVisible();
      await shootAll(page, device, `confirmation-${lang}`);

      // Back from Midtrans' page: the payment is being confirmed, the order still waits.
      await open(page, `${confirmation}&order_id=${orderId}&status_code=201&transaction_status=pending`);
      await expect(page.getByRole("status").filter({ hasText: /dikonfirmasi|being confirmed/ })).toBeVisible();
      await shootAll(page, device, `returned-${lang}`);

      // Refused by the server: the browser sent an order this customer does not have.
      await open(page, confirmation);
      await sendOrderIdInstead(page, randomUUID());
      await payButton(page).click();
      await expect(page.getByRole("alert").filter({ hasText: /tidak ditemukan|not found/ })).toBeVisible({ timeout: 20_000 });
      await shootAll(page, device, `error-${lang}`);

      // While the payment opens: the request is held back, so nothing reaches Midtrans.
      const busy = await context.newPage();
      await busy.route("**/orders?**", (route) => (route.request().method() === "POST" ? undefined : route.fallback()));
      await open(busy, confirmation);
      await formReady(busy);
      await payButton(busy).click();
      await expect(busy.getByRole("button", { name: /^(Membuka pembayaran|Opening the payment)/ })).toBeDisabled();
      await shootAll(busy, device, `pending-${lang}`);
      await busy.close();
    }

    await cancelOrder(orders.pop() ?? "");
    await context.close();
  });
}
