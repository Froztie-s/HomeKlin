import { expect, test, type Browser, type Page } from "@playwright/test";
import { createTestUser, deleteTestUsers, type TestUser } from "../../tests/integration/test-project";
import { lateWindow, type Window } from "../booking-test-data";
import { chooseWindow, guestEmail, orderPath, removeGuests } from "../order-test-data";

// T9b review screenshots: ordering without a separate sign-up, at two phone and two desktop widths,
// in both languages. /pesan empty (no service chosen), filled in by a guest, with its errors, on the
// code step, and for a signed-in customer; /login on its code step and with the password form.
// Saved to docs/screenshots/t9b/:
//   <surface>-<width>.png       the whole page, with fixed bars where they really sit
//   <surface>-<width>-fold.png  phones only: the first screen exactly as it opens
// Nothing is booked. Asking for a code makes an account for each guest address; those accounts and
// the fictional customer made for the run are deleted at the end.
// Run with: npm run screenshots -- t9b

const dir = "docs/screenshots/t9b";
const area = "jakarta-barat";
const service = "regular";
const address = "Jl. Contoh Raya No. 12, RT 03/RW 05, Kembangan, Jakarta Barat";
const phone = "0812 3456 7890";
type Device = "phone" | "desktop";
const widths: Record<Device, number[]> = { phone: [360, 390], desktop: [1280, 1440] };
const heights: Record<number, number> = { 360: 780, 390: 844, 1280: 800, 1440: 900 };

test.describe.configure({ mode: "serial" });

let customer: TestUser;
const guests: string[] = [];

test.beforeAll(async () => {
  customer = await createTestUser("t9b-shots", { full_name: "Uji Pelanggan" });
});

test.afterAll(async () => {
  await removeGuests(guests);
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
  return { context, page: await context.newPage() };
}

/** The first screen (phones) and the whole page at the current width; checks there is no sideways scroll. */
async function shoot(page: Page, name: string, width: number, mobile: boolean) {
  await page.setViewportSize({ width, height: heights[width] });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^(Memuat|Loading)/)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width);
  const imagesReady = () =>
    page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
  await imagesReady();
  if (mobile) await page.screenshot({ path: `${dir}/${name}-${width}-fold.png` });
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.max(pageHeight, heights[width]) });
  await imagesReady();
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

const english = (prefix: string) => prefix === "/en";

async function fillOrder(page: Page, prefix: string, window: Window, email?: string) {
  const en = english(prefix);
  await chooseWindow(page, window, en ? "en" : "id");
  await page.getByLabel(en ? "Full address" : "Alamat lengkap").fill(address);
  await page.getByLabel(en ? "Mobile number" : "Nomor HP").fill(phone);
  if (email) await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("switch").check();
}

for (const device of ["phone", "desktop"] as const) {
  test(`order and sign-in screens on a ${device}`, async ({ browser }) => {
    test.setTimeout(300_000);
    const window = await lateWindow(area, "15.00", 6);
    const { context, page } = await newPage(browser, device);

    for (const prefix of ["", "/en"]) {
      const lang = english(prefix) ? "en" : "id";
      // From "Pesan sekarang": no service chosen yet.
      await open(page, `${prefix}/pesan`);
      await expect(page.getByRole("radio").first()).toBeAttached();
      await shootAll(page, device, `pesan-empty-${lang}`);

      // Filled in by a guest, ready for "Kirim kode".
      await open(page, orderPath(service, area, undefined, prefix));
      await fillOrder(page, prefix, window, `t9b-shot@example.com`);
      await page.getByRole("button", { name: english(prefix) ? "Change time" : "Ganti jadwal" }).click();
      await shootAll(page, device, `pesan-filled-${lang}`);

      // Sent with problems: each one next to its field.
      await open(page, orderPath(service, area, undefined, prefix));
      await page.getByLabel(english(prefix) ? "Full address" : "Alamat lengkap").fill("Jl. A");
      await page.getByLabel(english(prefix) ? "Mobile number" : "Nomor HP").fill("12345");
      await page.getByLabel("Email", { exact: true }).fill("nama@");
      await page.getByRole("switch").check();
      await page.getByRole("button", { name: english(prefix) ? "Send code" : "Kirim kode" }).click();
      await expect(page.getByRole("alert").filter({ hasText: /isian|field/ })).toBeVisible();
      await shootAll(page, device, `pesan-errors-${lang}`);

      // The code step (a code is really sent, to a throw-away address).
      const email = guestEmail(guests);
      await open(page, orderPath(service, area, undefined, prefix));
      await fillOrder(page, prefix, window, email);
      await page.getByRole("button", { name: english(prefix) ? "Send code" : "Kirim kode" }).click();
      await expect(page.getByLabel(english(prefix) ? "6-digit code" : "Kode 6 angka")).toBeVisible({ timeout: 20_000 });
      await page.getByLabel(english(prefix) ? "6-digit code" : "Kode 6 angka").fill("12345");
      await shootAll(page, device, `pesan-code-${lang}`);

      // Sign-in: the code step, and the password form for staff and demo accounts.
      // An address with no account: the answer is the same as for one with an account.
      await open(page, `${prefix}/login`);
      await page.getByLabel("Email", { exact: true }).fill("nama.anda@example.com");
      await page.getByRole("button", { name: english(prefix) ? "Send code" : "Kirim kode" }).click();
      await expect(page.getByLabel(english(prefix) ? "6-digit code" : "Kode 6 angka")).toBeVisible({ timeout: 20_000 });
      await shootAll(page, device, `login-code-${lang}`);
      await open(page, `${prefix}/login?cara=sandi`);
      await expect(page.getByLabel(english(prefix) ? "Password" : "Kata sandi", { exact: true })).toBeVisible();
      await shootAll(page, device, `login-password-${lang}`);
      if (prefix === "") {
        await open(page, "/login");
        await expect(page.getByRole("button", { name: "Kirim kode" })).toBeVisible();
        await shootAll(page, device, "login-id");
      }
    }

    // A signed-in customer: no email, no code.
    await open(page, "/login?cara=sandi");
    await page.getByLabel("Email", { exact: true }).fill(customer.email);
    await page.getByLabel("Kata sandi", { exact: true }).fill(customer.password);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/login"));
    for (const prefix of ["", "/en"]) {
      await open(page, orderPath(service, area, window.startsAt, prefix));
      await expect(page.getByText(english(prefix) ? "You are booking as" : "Anda memesan sebagai")).toBeVisible();
      await page.getByLabel(english(prefix) ? "Full address" : "Alamat lengkap").fill(address);
      await page.getByLabel(english(prefix) ? "Mobile number" : "Nomor HP").fill(phone);
      await page.getByRole("switch").check();
      await shootAll(page, device, `pesan-customer-${english(prefix) ? "en" : "id"}`);
    }
    await context.close();
  });
}
