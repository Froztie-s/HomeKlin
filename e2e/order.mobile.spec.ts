import { expect, test, type Page } from "@playwright/test";
import { adminClient } from "../tests/integration/test-project";
import { agencyMarks, cancelOrder, fillWindow, lateWindow, windowText, type Window } from "./booking-test-data";
import { chooseWindow, guestEmail, orderPath, removeGuests } from "./order-test-data";
import { signedInAs } from "./setup/auth-state";
import { codeFor } from "./setup/email-code";

// T9b on a phone: ordering without a separate sign-up. A guest clicks a service, fills in one form
// (service, area, window, address, phone, email, consent), gets a 6-digit code by email and types it;
// the code places the order, makes the account and signs them in. Returning customers sign in with a
// new code. Also: a wrong code, the resend countdown, a signed-in customer (no code), staff who cannot
// order, a window taken between "Kirim kode" and the code, the old addresses, English and 360 px.
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
const sendCode = (page: Page) => page.getByRole("button", { name: "Kirim kode" });
const placeButton = (page: Page) => page.getByRole("button", { name: "Pesan sekarang" });
const codeField = (page: Page) => page.getByLabel("Kode 6 angka");

/** Fills in the order form after the service and area are chosen. */
async function fillOrder(page: Page, window: Window, email?: string) {
  await chooseWindow(page, window);
  await page.getByLabel("Alamat lengkap").fill(address);
  await page.getByLabel("Nomor HP").fill(phone);
  if (email) await page.getByLabel("Email", { exact: true }).fill(email);
  await consentSwitch(page).check();
}

/** "Kirim kode", then the code step for that email. */
async function askForCode(page: Page, email: string) {
  await sendCode(page).click();
  await expect(page.getByRole("heading", { name: "Masukkan kode dari email" })).toBeVisible({ timeout: emailWait });
  await expect(page.getByText(`Kami mengirim kode 6 angka ke ${email}.`)).toBeVisible();
}

/** The order the confirmation shows, read from the address. */
async function bookedId(page: Page): Promise<string> {
  await expect(page).toHaveURL(/\/orders\?booked=[0-9a-f-]{36}$/);
  return new URL(page.url()).searchParams.get("booked") ?? "";
}

test.describe("as a guest", () => {
  // Each test waits for at least one email to go out.
  test.describe.configure({ timeout: 90_000 });
  test("orders from the landing page with an emailed code and is signed in", async ({ page }) => {
    const email = guestEmail(guests);
    const target = await lateWindow(area, "15.00", 3);

    await page.goto("/");
    await page
      .getByRole("region", { name: "Layanan dan harga, tanpa kejutan" })
      .getByRole("link", { name: service.name })
      .click();
    await expect(page).toHaveURL(`/pesan?layanan=${service.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Pesan layanan" })).toBeVisible();
    // The service is chosen already, the area is the default one until changed.
    await expect(page.getByLabel("Pilih layanan")).toHaveValue(service.id);
    await expect(page.getByLabel("Area layanan")).toHaveValue("jakarta-selatan");
    await page.getByLabel("Area layanan").selectOption(area);
    await expect(page).toHaveURL(`/pesan?layanan=${service.id}&area=${area}`);

    await fillOrder(page, target, email);
    await expect(page.getByText("Kami kirim kode ke email ini.", { exact: false })).toBeVisible();
    await askForCode(page, email);
    // The order is not made yet.
    const { data: before } = await adminClient().from("orders").select("id").eq("starts_at", target.startsAt).eq("address", address);
    expect(before ?? []).toEqual([]);

    await codeField(page).fill(await codeFor(email));
    await placeButton(page).click();
    const orderId = await bookedId(page);

    const confirmation = page.getByRole("region", { name: "Pesanan Anda sudah dibuat" });
    await expect(confirmation.getByText("Menunggu pembayaran")).toBeVisible();
    await expect(confirmation.getByText(service.name)).toBeVisible();
    await expect(confirmation.getByText(address)).toBeVisible();
    // Signed in now: the header has the account chip instead of "Masuk".
    await expect(page.getByRole("banner").getByRole("link", { name: "Masuk", exact: true })).toHaveCount(0);
    await expect(page.getByRole("banner").getByRole("link", { name: /akun Anda/i })).toHaveAttribute("href", "/account");

    // One brand: no agency wording, name or id in the page or in the HTML the server sends.
    const marks = await agencyMarks();
    const served = await (await page.request.get(page.url())).text();
    for (const html of [await page.content(), served]) {
      expect(html).toContain("Menunggu pembayaran");
      expect(html).not.toMatch(agencyWording);
      for (const mark of marks) expect(html).not.toContain(mark);
    }

    // The account exists as a customer, and the order carries the phone in the stored form.
    const { data: order } = await adminClient()
      .from("orders")
      .select("status, contact_phone, customer_id, starts_at")
      .eq("id", orderId)
      .single();
    expect(order?.status).toBe("pending_payment");
    expect(order?.contact_phone).toBe("+6281234567890");
    expect(new Date(order?.starts_at as string).toISOString()).toBe(target.startsAt);
    const { data: profile } = await adminClient().from("profiles").select("role").eq("id", order?.customer_id).single();
    expect(profile?.role).toBe("customer");
  });

  test("says a wrong code is wrong, stays on the code step, then takes the right one", async ({ page }) => {
    const email = guestEmail(guests);
    const target = await lateWindow(area, "10.00", 3);
    await page.goto(orderPath(service.id, area));
    await fillOrder(page, target, email);
    await askForCode(page, email);

    await codeField(page).fill("000000");
    await placeButton(page).click();
    await expect(page.getByText("Kode salah atau sudah tidak berlaku.", { exact: false })).toBeVisible();
    await expect(codeField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(codeField(page)).toBeFocused();
    await expect(page).toHaveURL(/\/pesan\?/);

    await codeField(page).fill(await codeFor(email));
    await placeButton(page).click();
    const orderId = await bookedId(page);
    await expect(page.getByText("Menunggu pembayaran")).toBeVisible();
    await cancelOrder(orderId);
  });

  test("waits a minute before another code, and keeps the form for another email", async ({ page }) => {
    const email = guestEmail(guests);
    const target = await lateWindow(area, "13.00", 3);
    await page.goto(orderPath(service.id, area, target.startsAt));
    await page.getByLabel("Alamat lengkap").fill(address);
    await page.getByLabel("Nomor HP").fill(phone);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await consentSwitch(page).check();
    await askForCode(page, email);

    const resend = page.getByRole("button", { name: /^Kirim ulang kode dalam \d+ detik$/ });
    await expect(resend).toBeDisabled();
    const first = Number((await resend.textContent())?.match(/\d+/)?.[0]);
    expect(first).toBeLessThanOrEqual(60);
    await expect.poll(async () => Number((await resend.textContent())?.match(/\d+/)?.[0])).toBeLessThan(first);

    // "Ganti email": back to the form with everything kept.
    await page.getByRole("button", { name: "Ganti email" }).click();
    await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
    await expect(page.getByLabel("Alamat lengkap")).toHaveValue(address);
    await expect(page.getByLabel("Nomor HP")).toHaveValue(phone);
    await expect(consentSwitch(page)).toBeChecked();
    await expect(page.getByRole("group", { name: "Jadwal kedatangan" })).toContainText(windowText(target));
  });

  test("shows each problem next to its field, before any code is sent", async ({ page }) => {
    await page.goto(orderPath(service.id, area));
    await page.getByLabel("Alamat lengkap").fill("Jl. A");
    await page.getByLabel("Nomor HP").fill("12345");
    await page.getByLabel("Email", { exact: true }).fill("not-an-email");
    await consentSwitch(page).check();
    await sendCode(page).click();
    await expect(page.getByText("Pilih jadwal kedatangan.")).toBeVisible();
    await expect(page.getByText("Tulis alamat lengkap, paling sedikit 10 karakter.")).toBeVisible();
    await expect(page.getByLabel("Nomor HP")).toHaveAccessibleDescription(
      /Periksa nomor HP Anda, misalnya 0812 3456 7890\./,
    );
    await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("heading", { name: "Masukkan kode dari email" })).toHaveCount(0);
    await expect(page.getByLabel("Alamat lengkap")).toHaveValue("Jl. A");
  });

  test("finishes signed in when the window is taken between the code and the order", async ({ page }) => {
    const email = guestEmail(guests);
    const target = await lateWindow(area, "08.00", 3);
    const other = await lateWindow(area, "10.00", 4);
    await page.goto(orderPath(service.id, area));
    await fillOrder(page, target, email);
    await askForCode(page, email);

    const restore = await fillWindow(area, target.startsAt);
    try {
      await codeField(page).fill(await codeFor(email));
      await placeButton(page).click();
      const alert = page.getByRole("alert").filter({ hasText: "Jadwal ini baru saja terisi" });
      await expect(alert).toBeVisible();
      await expect(page).toHaveURL(/\/pesan\?/);
      // The code was right: signed in now, so no new code is needed.
      await expect(page.getByText("Anda memesan sebagai")).toBeVisible();
      await expect(page.getByText(email, { exact: true })).toBeVisible();
      await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
      await expect(page.getByLabel("Alamat lengkap")).toHaveValue(address);
      await expect(consentSwitch(page)).toBeChecked();

      await chooseWindow(page, other);
      await placeButton(page).click();
      const orderId = await bookedId(page);
      await expect(page.getByText("Menunggu pembayaran")).toBeVisible();
      await cancelOrder(orderId);
    } finally {
      await restore();
    }
  });

  test("a returning customer signs in with a new code and finds the order", async ({ page }) => {
    const email = guestEmail(guests);
    const target = await lateWindow(area, "15.00", 4);
    await page.goto(orderPath(service.id, area, target.startsAt));
    await page.getByLabel("Alamat lengkap").fill(address);
    await page.getByLabel("Nomor HP").fill(phone);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await consentSwitch(page).check();
    await askForCode(page, email);
    await codeField(page).fill(await codeFor(email));
    await placeButton(page).click();
    const orderId = await bookedId(page);
    const orderPage = `/orders?booked=${orderId}`;

    // Sign out from the account page, which explains there is no password.
    await page.goto("/account");
    await expect(page.getByText("Anda masuk dengan kode yang kami kirim ke email Anda.")).toBeVisible();
    await page.getByRole("button", { name: "Keluar" }).click();
    await expect(page).toHaveURL("/");

    await page.goto(orderPage);
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Kirim kode" }).click();
    await expect(page.getByText(`Jika ${email} terdaftar di HomeKlin`)).toBeVisible({ timeout: emailWait });
    await page.getByLabel("Kode 6 angka").fill(await codeFor(email));
    await page.getByRole("button", { name: "Masuk", exact: true }).click();

    await expect(page).toHaveURL(orderPage);
    const confirmation = page.getByRole("region", { name: "Pesanan Anda sudah dibuat" });
    await expect(confirmation.getByText("Menunggu pembayaran")).toBeVisible();
    await expect(confirmation.getByText(address)).toBeVisible();
  });

  test("the login code step says the same whether or not the email has an account", async ({ page }) => {
    const unknown = `t9b-nobody-${Date.now()}@example.com`;
    await page.goto("/login");
    // No sign-up any more: first-time customers are sent to order.
    await expect(page.getByRole("link", { name: "Daftar" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Pesan layanan" })).toHaveAttribute("href", "/services");
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

  test("orders in English", async ({ page }) => {
    const email = guestEmail(guests);
    const target = await lateWindow(area, "13.00", 4);
    await page.goto(orderPath(service.id, area, undefined, "/en"));
    await expect(page.getByRole("heading", { level: 1, name: "Book a cleaning" })).toBeVisible();
    await expect(page.getByLabel("Choose a service")).toHaveValue(service.id);
    await chooseWindow(page, target, "en");
    await page.getByLabel("Full address").fill(address);
    await page.getByLabel("Mobile number").fill(phone);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByRole("switch", { name: /I agree/ }).check();
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText(`We sent a 6-digit code to ${email}.`)).toBeVisible({ timeout: emailWait });
    await page.getByLabel("6-digit code").fill(await codeFor(email));
    await page.getByRole("button", { name: "Book now" }).click();
    await expect(page).toHaveURL(/\/en\/orders\?booked=[0-9a-f-]{36}$/);
    await expect(page.getByText("Awaiting payment")).toBeVisible();
    await cancelOrder(new URL(page.url()).searchParams.get("booked") ?? "");
  });

  test("the old sign-up page leads to the order page", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveURL("/pesan");
    await expect(page.getByRole("heading", { level: 1, name: "Pesan layanan" })).toBeVisible();
    // No service in the address: the form asks for one.
    await expect(page.getByLabel("Pilih layanan")).toHaveValue("");
    await page.goto("/en/signup");
    await expect(page).toHaveURL("/en/pesan");
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

  test.describe("at 360 px", () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test("the order form and its code step have no sideways scroll, in both languages", async ({ page }) => {
      test.slow();
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      for (const prefix of ["/en", ""]) {
        // An English page remembers the language (NEXT_LOCALE); forget it, so "" is Indonesian.
        await page.context().clearCookies();
        await page.goto(orderPath(service.id, area, undefined, prefix));
        await expect(page.locator("html")).toHaveAttribute("lang", prefix ? "en" : "id");
        await expect(page.getByRole("radio").first()).toBeVisible();
        expect(await page.content()).not.toMatch(agencyWording);
        expect(await overflow()).toBeLessThanOrEqual(0);
      }
      const email = guestEmail(guests);
      const target = await lateWindow(area, "08.00", 4);
      await page.goto(orderPath(service.id, area));
      await fillOrder(page, target, email);
      await askForCode(page, email);
      expect(await overflow()).toBeLessThanOrEqual(0);
      await page.goto("/login");
      expect(await overflow()).toBeLessThanOrEqual(0);
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

  test("the old booking address leads to the order page with the same choice", async ({ page }) => {
    const target = await lateWindow(area, "13.00", 5);
    const params = new URLSearchParams({ service: service.id, area, starts: target.startsAt });
    await page.goto(`/book?${params.toString()}`);
    await expect(page).toHaveURL(orderPath(service.id, area, target.startsAt));
    await expect(page.getByRole("group", { name: "Jadwal kedatangan" })).toContainText(windowText(target));
  });
});

test.describe("as a cleaner", () => {
  test.use(signedInAs.cleaner);

  test("is told plainly that staff accounts cannot order", async ({ page }) => {
    await page.goto(orderPath(service.id, area));
    await expect(page.getByRole("heading", { name: "Akun staf tidak dapat memesan" })).toBeVisible();
    await expect(page.getByRole("form")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ke halaman kerja Anda" })).toHaveAttribute("href", "/cleaner");
  });
});
