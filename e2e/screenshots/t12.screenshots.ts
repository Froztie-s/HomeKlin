import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createTestUser, deleteTestUsers, type TestUser } from "../../tests/integration/test-project";
import { cancelOrder, lateWindow } from "../booking-test-data";
import { signInWithPassword } from "../order-test-data";
import { notification, notify } from "../payment-test-data";

// T12 review screenshots: the customer's order list and an order's details, at two phone and two
// desktop widths, in both languages. Empty list, a list with every status, a paid order's details, a
// waiting order's details with "Bayar sekarang", and the confirmation with its link back to the list.
// Saved to docs/screenshots/t12/:
//   <surface>-<lang>-<width>.png       the whole page, with fixed bars where they really sit
//   <surface>-<lang>-<width>-fold.png  phones only: the first screen exactly as it opens
// A fictional customer is made for the run in the Supabase test project and deleted at the end, with
// every order deleted and its place given back. Late windows in Jakarta Timur, days 2 and 3.
// Run with: npm run screenshots -- t12

const dir = "docs/screenshots/t12";
const area = "jakarta-timur";
type Device = "phone" | "desktop";
const widths: Record<Device, number[]> = { phone: [360, 390], desktop: [1280, 1440] };
const heights: Record<number, number> = { 360: 780, 390: 844, 1280: 800, 1440: 900 };

test.describe.configure({ mode: "serial" });

let customer: TestUser;
const orders: Record<string, string> = {};

test.beforeAll(async () => {
  test.setTimeout(120_000);
  customer = await createTestUser("t12-shots", { full_name: "Uji Pelanggan" });
});

test.afterAll(async () => {
  for (const id of Object.values(orders)) await cancelOrder(id);
  await deleteTestUsers([customer]);
});

async function book(startsAt: string): Promise<string> {
  const { data, error } = await customer.client.rpc("book_slot", {
    p_service: "regular",
    p_area: area,
    p_starts_at: startsAt,
    p_address: "Jl. Contoh Raya No. 12, RT 03/RW 05, Cakung, Jakarta Timur",
    p_phone: "+6281234567891",
    p_consent: true,
  });
  if (error) throw new Error(`Could not book the test order: ${error.message}`);
  return (data as { order_id: string }[])[0].order_id;
}

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
  await signInWithPassword(page, customer);
  await page.close();
  return context;
}

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

async function open(page: Page, path: string) {
  await page.context().clearCookies({ name: "NEXT_LOCALE" });
  await page.goto(path);
}

const languages = [
  ["id", ""],
  ["en", "/en"],
] as const;

test("the empty list", async ({ browser }) => {
  test.setTimeout(120_000);
  for (const device of ["phone", "desktop"] as const) {
    const context = await newContext(browser, device);
    const page = await context.newPage();
    for (const [lang, prefix] of languages) {
      await open(page, `${prefix}/orders`);
      for (const width of widths[device]) await shoot(page, `list-empty-${lang}`, width, device === "phone");
    }
    await context.close();
  }
});

test("the filled list and the details", async ({ browser, request }) => {
  test.setTimeout(300_000);
  orders.cancelled = await book((await lateWindow(area, "15.00", 2)).startsAt);
  orders.failed = await book((await lateWindow(area, "13.00", 2)).startsAt);
  orders.paid = await book((await lateWindow(area, "10.00", 3)).startsAt);
  orders.waiting = await book((await lateWindow(area, "08.00", 3)).startsAt);
  await notify(request, await notification(orders.paid, "settlement", "200"));
  await notify(request, await notification(orders.failed, "deny", "202"));
  await notify(request, await notification(orders.cancelled, "expire", "407"));

  for (const device of ["phone", "desktop"] as const) {
    const context = await newContext(browser, device);
    const page = await context.newPage();
    for (const [lang, prefix] of languages) {
      const surfaces: [string, string][] = [
        ["list", `${prefix}/orders`],
        ["details-paid", `${prefix}/orders?order=${orders.paid}`],
        ["details-waiting", `${prefix}/orders?order=${orders.waiting}`],
        ["details-failed", `${prefix}/orders?order=${orders.failed}`],
        ["confirmation", `${prefix}/orders?booked=${orders.waiting}`],
      ];
      for (const [name, path] of surfaces) {
        await open(page, path);
        for (const width of widths[device]) await shoot(page, `${name}-${lang}`, width, device === "phone");
      }
    }
    await context.close();
  }
});
