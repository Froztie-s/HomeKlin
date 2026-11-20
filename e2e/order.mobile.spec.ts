import { expect, test, type Page } from "@playwright/test";
import { adminClient } from "../tests/integration/test-project";
import { cancelOrder, lateWindow, windowText } from "./booking-test-data";
import { guestEmail, orderPath, removeGuests } from "./order-test-data";
import { signedInAs } from "./setup/auth-state";

// T9b on a phone, changed on 2026-11-20 (the user): ordering needs a customer account. A guest who
// opens the order page is sent to /login with it as ?next=, can sign up there (/signup) and comes back
// to the same order, signed in. Also: the login code step, a signed-in customer ordering, the old
// /book address, an area or service that cannot be ordered, staff sent to their own home, and 360 px.
// The guest code steps of the order form are no longer reachable and are not tested here.
// The test project's emails go nowhere (Ethereal), so codeFor() asks the admin API for a fresh code
// right after the app sent one. Every guest has a unique address and is deleted afterwards, with every
// place they booked given back; windows are late ones in Jakarta Barat (e2e/booking-test-data.ts), 3 to 5 open days before the
// last, so they never meet the T9 spec's (0 to 2) when both run at once.

const area = "jakarta-barat";
const service = { id: "regular", name: "Pembersihan Rutin", nameEn: "Regular Cleaning" };
const address = "Jl. Contoh Raya No. 12, RT 03/RW 05, Kembangan, Jakarta Barat";
const phone = "0812 3456 7890";
const agencyWording = /agensi|agency|mitra|partner/i;
// Sending an email (the code) can take the test project several seconds.
const emailWait = 20_000;

const guests: string[] = [];
test.afterAll(async () => {
  await removeGuests(guests);
});

const consentSwitch = (page: Page) => page.getByRole("switch", { name: /Saya setuju/ });
// The form's own buttons; the phone bar repeats the main one outside the form (BookingBar).
const orderForm = (page: Page) => page.getByRole("form", { name: /^(Pesan layanan|Book a cleaning)$/ });
const sendCode = (page: Page) => orderForm(page).getByRole("button", { name: "Kirim kode" });
const placeButton = (page: Page) => orderForm(page).getByRole("button", { name: "Lanjut ke pembayaran" });

/** The order the confirmation shows, read from the address. */
async function bookedId(page: Page): Promise<string> {
  // Booking and the redirect run on the server; under a full parallel run that can take over 5 s.
  // Step 3 is /orders/pay?order=<id> since the focused booking layout (2026-11-17).
  await expect(page).toHaveURL(/\/orders\/pay\?order=[0-9a-f-]{36}$/, { timeout: 15_000 });
  return new URL(page.url()).searchParams.get("order") ?? "";
}

test.describe("as a guest", () => {
  test.describe.configure({ timeout: 90_000 });

  test("is asked to log in before ordering, can sign up instead, and comes back to the same order", async ({ page }) => {
    const target = await lateWindow(area, "08.00", 4);
    const wanted = orderPath(service.id, area, target.startsAt);
    await page.goto(wanted);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(wanted)}`);
    await expect(orderForm(page)).toHaveCount(0);

    // "Belum punya akun? Daftar" keeps the order the guest was about to place.
    await page.getByRole("link", { name: "Daftar" }).click();
    await expect(page).toHaveURL(`/signup?next=${encodeURIComponent(wanted)}`);
    await expect(page.getByRole("heading", { level: 1, name: "Daftar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Masuk" })).toHaveAttribute("href", `/login?next=${encodeURIComponent(wanted)}`);

    const email = guestEmail(guests);
    await page.getByLabel("Nama lengkap").fill("Uji Pendaftar");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Kata sandi", { exact: true }).fill("kata-sandi-uji-123");
    await page.getByRole("button", { name: "Buat akun" }).click();
    await expect(page).toHaveURL(wanted, { timeout: 15_000 });
    await expect(page.getByText("Anda memesan sebagai")).toBeVisible();
    await expect(page.getByRole("region", { name: "Layanan dan jadwal" })).toContainText(windowText(target));
  });

  test("the old booking address needs a sign-in too", async ({ page }) => {
    await page.goto(`/book?service=${service.id}&area=${area}`);
    await expect(page).toHaveURL(/\/login\?next=%2Fbook/);
  });

  test("the login code step says the same whether or not the email has an account", async ({ page }) => {
    const unknown = `t9b-nobody-${Date.now()}@example.com`;
    await page.goto("/login");
    // First-time customers sign up (2026-11-20); the card no longer sends them to order without one.
    await expect(page.getByRole("link", { name: "Daftar" })).toHaveAttribute("href", "/signup");
    await expect(page.getByRole("link", { name: "Pesan layanan" })).toHaveCount(0);
    await page.getByLabel("Email", { exact: true }).fill(unknown);
    await page.getByRole("button", { name: "Kirim kode" }).click();
    await expect(page.getByText(`Jika ${unknown} terdaftar di HomeKlin, kami sudah mengirim kode 6 angka`)).toBeVisible({ timeout: emailWait });
    await expect(page.getByRole("button", { name: /^Kirim ulang kode dalam \d+ detik$/ })).toBeDisabled();
    await page.getByLabel("Kode 6 angka").fill("123456");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByText("Kode salah atau sudah tidak berlaku.", { exact: false })).toBeVisible();
    await expect(page).toHaveURL("/login");
    // Asking for a code never makes an account.
    const { data } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(data.users.some((user) => user.email === unknown)).toBe(false);
  });

  test.describe("at 360 px", () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test("the sign-in and sign-up pages have no sideways scroll, in both languages", async ({ page }) => {
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      for (const prefix of ["/en", ""]) {
        await page.context().clearCookies();
        for (const path of ["/login", "/login?cara=sandi", "/signup"]) {
          await page.goto(`${prefix}${path}`);
          await expect(page.locator("html")).toHaveAttribute("lang", prefix ? "en" : "id");
          expect(await overflow()).toBeLessThanOrEqual(0);
        }
      }
    });
  });
});

test.describe("as a signed-in customer", () => {
  test.use(signedInAs.customer);

  test("orders without a code", async ({ page }) => {
    const target = await lateWindow(area, "10.00", 5);
    await page.goto(orderPath(service.id, area, target.startsAt));
    await expect(page.getByText("Anda memesan sebagai")).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
    await expect(sendCode(page)).toHaveCount(0);
    await page.getByLabel("Alamat lengkap").fill(address);
    await page.getByLabel("Nomor HP").fill(phone);
    await consentSwitch(page).check();
    await placeButton(page).click();
    const orderId = await bookedId(page);
    try {
      await expect(page.getByText("Menunggu pembayaran")).toBeVisible();
    } finally {
      await cancelOrder(orderId);
    }
  });

  test("an area HomeKlin does not serve, and a service that cannot be ordered, say so", async ({ page }) => {
    await page.goto("/pesan?layanan=no-such-service&area=jakarta-utara");
    await expect(page.getByText("Layanan dari tautan ini tidak dapat dipesan.", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Pilih layanan")).toHaveValue("");
    await expect(page.getByText("HomeKlin belum melayani Jakarta Utara")).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    // Another area brings its free windows at once.
    await page.getByLabel("Area layanan").selectOption(area);
    await expect(page.getByRole("radio").first()).toBeAttached();
  });

  test("the order form has no sideways scroll at 360 px, in both languages", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    for (const prefix of ["/en", ""]) {
      await page.context().clearCookies({ name: "NEXT_LOCALE" });
      await page.goto(orderPath(service.id, area, undefined, prefix));
      await expect(page.locator("html")).toHaveAttribute("lang", prefix ? "en" : "id");
      await expect(page.getByRole("radio").first()).toBeVisible();
      expect(await page.content()).not.toMatch(agencyWording);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    }
  });

  test("the old booking address leads to the order page with the same choice", async ({ page }) => {
    const target = await lateWindow(area, "13.00", 5);
    const params = new URLSearchParams({ service: service.id, area, starts: target.startsAt });
    await page.goto(`/book?${params.toString()}`);
    await expect(page).toHaveURL(orderPath(service.id, area, target.startsAt));
    await expect(page.getByRole("region", { name: "Layanan dan jadwal" })).toContainText(windowText(target));
  });
});

test.describe("as a cleaner", () => {
  test.use(signedInAs.cleaner);

  test("cannot open the order page or the customer pages: each sends them to their own home", async ({ page }) => {
    // 2026-11-20 (the user): typing a customer page's address no longer opens it for staff.
    for (const path of [orderPath(service.id, area), "/book", "/orders", "/home", "/services", "/support", "/"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL("/cleaner");
    }
  });
});
