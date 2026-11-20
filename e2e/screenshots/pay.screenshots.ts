import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createTestUser, deleteTestUsers, type TestUser } from "../../tests/integration/test-project";
import { cancelOrder, lateWindow } from "../booking-test-data";
import { orderPath } from "../order-test-data";

// Review screenshots of paying on HomeKlin's own payment step (after Customer-Payment and Phone-Payment):
// the choices (QRIS, a bank with its banks, a card with its fields), then what the page shows after
// choosing (the QR code, a virtual account number). One phone width and one desktop width, Indonesian.
// Saved to docs/screenshots/pay/: <surface>-<width>.png, the whole page. A fictional customer is made
// for the run in the Supabase test project and deleted at the end; the order is deleted with its place
// given back. The payments are real Sandbox charges; no money moves.
// Run with: npm run screenshots -- pay

const dir = "docs/screenshots/pay";
const area = "jakarta-barat";
const service = "regular";
const address = "Jl. Contoh Raya No. 12, RT 03/RW 05, Kembangan, Jakarta Barat";
const phone = "0812 3456 7890";
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };

test.describe.configure({ mode: "serial" });

let customer: TestUser;
const orders: string[] = [];

test.beforeAll(async () => {
  customer = await createTestUser("pay-shots", { full_name: "Uji Pelanggan" });
});

test.afterAll(async () => {
  for (const id of orders.splice(0)) await cancelOrder(id);
  await deleteTestUsers([customer]);
});

async function newContext(browser: Browser, device: keyof typeof sizes): Promise<BrowserContext> {
  const mobile = device === "phone";
  const context = await browser.newContext({
    viewport: sizes[device],
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

async function shoot(page: Page, name: string, device: keyof typeof sizes) {
  const { width, height } = sizes[device];
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.max(pageHeight, height) });
  await page.screenshot({ path: `${dir}/${name}-${width}.png` });
  await page.setViewportSize({ width, height });
}

for (const device of ["phone", "desktop"] as const) {
  test(`payment step on a ${device}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const window = await lateWindow(area, "15.00", 8);
    const context = await newContext(browser, device);
    const page = await context.newPage();

    await page.goto(orderPath(service, area, window.startsAt));
    await page.getByLabel("Alamat lengkap").fill(address);
    await page.getByLabel("Nomor HP").fill(phone);
    await page.getByRole("switch").check();
    await page.getByRole("button", { name: "Lanjut ke pembayaran" }).click();
    await page.waitForURL(/\/orders\?booked=/, { timeout: 20_000 });
    orders.push(new URL(page.url()).searchParams.get("booked") ?? "");

    const pay = page.getByRole("button", { name: "Bayar sekarang" }).first();
    await expect(pay).toBeVisible();
    await page.getByRole("radio", { name: /QRIS/ }).evaluate(
      (input) =>
        new Promise<void>((resolve) => {
          const check = () => (Object.keys(input).some((key) => key.startsWith("__reactFiber")) ? resolve() : requestAnimationFrame(check));
          check();
        }),
    );
    await shoot(page, "1-choose-qris", device);

    await page.getByRole("radio", { name: /Virtual account/ }).check();
    await page.getByRole("radio", { name: "Mandiri" }).check();
    await shoot(page, "2-choose-bank", device);

    await page.getByRole("radio", { name: /Kartu kredit atau debit/ }).check();
    await shoot(page, "3-choose-card", device);

    await page.getByRole("radio", { name: /QRIS/ }).check();
    await pay.click();
    await expect(page.getByRole("img", { name: "Kode QRIS untuk membayar pesanan ini" })).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    await shoot(page, "4-qris-waiting", device);

    await page.getByRole("button", { name: "Ganti cara bayar" }).click();
    await page.getByRole("radio", { name: /Virtual account/ }).check({ timeout: 30_000 });
    await page.getByRole("radio", { name: "BCA" }).check();
    await pay.click();
    await expect(page.getByRole("heading", { name: "Transfer ke virtual account BCA" })).toBeVisible({ timeout: 30_000 });
    await shoot(page, "5-bank-waiting", device);

    await context.close();
  });
}
