import { expect, test, type Page } from "@playwright/test";
import { adminClient } from "../tests/integration/test-project";
import {
  agencyMarks,
  cancelOrder,
  dayText,
  fillWindow,
  lateWindow,
  ordersAt,
  sundayAfternoon,
  windowText,
  type Window,
} from "./booking-test-data";
import { orderPath } from "./order-test-data";
import { readTestUsers, signedInAs } from "./setup/auth-state";

// T9 on a phone (customers are mobile-first), on the order page since T9b (/pesan): a signed-in
// customer goes from the price list to a booked order. The customer picks a service and a free
// arrival window, gives the address and phone, switches on the streaming consent and books; the order
// then waits for payment. Also: the consent is required, a window someone else takes in the meantime
// is refused with other windows offered, a window that is gone when the page opens, an unknown
// service, and a visitor who opens the old booking address and signs in on the way. Guests ordering
// with an emailed code are in e2e/order.mobile.spec.ts. To the customer HomeKlin is one company:
// nothing on these pages, nor in the data sent to the browser, names the agency that got the job.
// Test data (e2e/booking-test-data.ts): late windows in Jakarta Barat only, one per test, and every
// order made here is deleted again with its place given back.

const area = "jakarta-barat";
const service = { id: "regular", name: "Pembersihan Rutin", nameEn: "Regular Cleaning" };
const address = "Jl. Contoh Raya No. 12, RT 03/RW 05, Kembangan, Jakarta Barat";
const phone = "0812 3456 7890";
const agencyWording = /agensi|agency|mitra|partner/i;

const usedStarts: string[] = [];
const customerId = () => readTestUsers().find((user) => user.role === "customer")?.id;

/** A late window for this test, remembered so the clean-up finds any order made at it. */
async function windowFor(time: string, daysBack = 0): Promise<Window> {
  const window = await lateWindow(area, time, daysBack);
  usedStarts.push(window.startsAt);
  return window;
}

test.afterAll(async () => {
  // An order left by a test that failed half-way: delete it and give its place back.
  const id = customerId();
  if (!id) return;
  for (const orderId of await ordersAt(id, area, usedStarts)) await cancelOrder(orderId);
});

const bookingForm = (page: Page) => page.getByRole("form", { name: "Pesan layanan" });
const consentSwitch = (page: Page) => page.getByRole("switch", { name: /Saya setuju/ });
const submitButton = (page: Page) => page.getByRole("button", { name: "Pesan sekarang" });

async function chooseWindow(page: Page, window: Window) {
  await page.getByRole("button", { name: "Ganti jadwal" }).click();
  await page
    .getByRole("group", { name: dayText(window.startsAt) })
    .getByRole("radio", { name: windowText(window) })
    .check();
}

test.describe("as a signed-in customer", () => {
  test.use(signedInAs.customer);

  test("books a service for a free window and sees the order waiting for payment", async ({ page }) => {
    const target = await windowFor("15.00");

    await page.goto(`/services?area=${area}`);
    const card = page
      .getByRole("list", { name: "Daftar harga" })
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: service.name }) });
    const price = (await card.getByText(/^Rp\s[\d.]+$/).textContent()) ?? "";
    expect(price).toMatch(/^Rp/);
    await card.getByRole("link", { name: `Pesan ${service.name}` }).click();

    // The order page opens on the earliest free window, with the service, its full price and the area.
    await expect(page).toHaveURL(/\/pesan\?layanan=regular&area=jakarta-barat&starts=\d{4}-/);
    await expect(page.getByRole("heading", { level: 1, name: "Pesan layanan" })).toBeVisible();
    const summary = page.getByRole("region", { name: "Layanan" });
    await expect(summary.getByLabel("Pilih layanan")).toHaveValue(service.id);
    await expect(summary.getByText(service.name, { exact: true })).toBeVisible();
    await expect(summary.getByText("± 2 jam")).toBeVisible();
    await expect(bookingForm(page).getByText(price, { exact: true })).toBeVisible();
    await expect(bookingForm(page).getByLabel("Area layanan")).toHaveValue(area);
    // Signed in: no email and no code, the order goes straight through.
    await expect(page.getByText("Anda memesan sebagai")).toBeVisible();

    // Another window, late in the range; the choice goes into the address too.
    await chooseWindow(page, target);
    // A tap picks the window and closes the long list again, back on the button that opened it.
    const toggle = page.getByRole("button", { name: "Ganti jadwal" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    const chosen = page.getByRole("group", { name: "Jadwal kedatangan" });
    await expect(chosen.getByText(dayText(target.startsAt), { exact: true })).toBeVisible();
    await expect(chosen.getByText(`${windowText(target)} WIB`, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`starts=${encodeURIComponent(target.startsAt)}`));

    await page.getByLabel("Alamat lengkap").fill(address);
    await page.getByLabel("Nomor HP").fill(phone);
    // The streaming consent comes with a plain explanation, and booking waits for it.
    await expect(page.getByText(/Hanya Anda dan tim pemantau HomeKlin/)).toBeVisible();
    await expect(page.getByText(/disimpan 7 hari, lalu dihapus/)).toBeVisible();
    await expect(submitButton(page)).toBeDisabled();
    await consentSwitch(page).check();
    await expect(submitButton(page)).toBeEnabled();
    await submitButton(page).click();

    // Booking and the redirect run on the server; under a full parallel run that can take over 5 s.
    await expect(page).toHaveURL(/\/orders\?booked=[0-9a-f-]{36}$/, { timeout: 15_000 });
    const orderId = new URL(page.url()).searchParams.get("booked") ?? "";
    try {
      const confirmation = page.getByRole("region", { name: "Pesanan Anda sudah dibuat" });
      await expect(confirmation.getByText("Menunggu pembayaran")).toBeVisible();
      await expect(confirmation.getByText(service.name)).toBeVisible();
      await expect(confirmation.getByText(price, { exact: true })).toBeVisible();
      await expect(confirmation.getByText(`${dayText(target.startsAt)}, ${windowText(target)} WIB`)).toBeVisible();
      await expect(confirmation.getByText(address)).toBeVisible();
      // The next step is paying (T10, e2e/payment.mobile.spec.ts).
      await expect(confirmation.getByRole("button", { name: "Bayar sekarang" })).toBeVisible();

      // One brand: neither the page nor the data sent to the browser names or identifies the agency.
      const marks = await agencyMarks();
      const rendered = await page.content();
      const served = await (await page.request.get(page.url())).text();
      for (const html of [rendered, served]) {
        expect(html).toContain("Menunggu pembayaran");
        expect(html).not.toMatch(agencyWording);
        for (const mark of marks) expect(html).not.toContain(mark);
      }

      // The order really waits for payment, at the chosen window.
      const { data } = await adminClient()
        .from("orders")
        .select("status, starts_at, stream_consent, contact_phone")
        .eq("id", orderId)
        .single();
      expect(data?.status).toBe("pending_payment");
      expect(data?.contact_phone).toBe("+6281234567890");
      expect(data?.stream_consent).toBe(true);
      expect(new Date(data?.starts_at as string).toISOString()).toBe(target.startsAt);
    } finally {
      await cancelOrder(orderId);
    }
  });

  test("refuses to book without the streaming consent", async ({ page }) => {
    const target = await windowFor("10.00");
    await page.goto(orderPath(service.id, area, target.startsAt));
    await page.getByLabel("Alamat lengkap").fill(address);
    await page.getByLabel("Nomor HP").fill(phone);
    await expect(consentSwitch(page)).not.toBeChecked();
    await expect(submitButton(page)).toBeDisabled();
    await expect(page.getByText("Nyalakan persetujuan siaran di atas untuk memesan.")).toBeVisible();

    // Sent anyway (the button is only a hint; the server decides): refused, next to the switch.
    await bookingForm(page).evaluate((form) => (form as HTMLFormElement).requestSubmit());
    await expect(page.getByText("Nyalakan persetujuan siaran untuk memesan.", { exact: true })).toBeVisible();
    await expect(consentSwitch(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/pesan\?/);
    await expect(page.getByLabel("Alamat lengkap")).toHaveValue(address);
    const id = customerId();
    if (id) expect(await ordersAt(id, area, [target.startsAt])).toEqual([]);
  });

  test("shows each problem next to its field", async ({ page }) => {
    const target = await windowFor("10.00", 1);
    await page.goto(orderPath(service.id, area, target.startsAt));
    await page.getByLabel("Alamat lengkap").fill("Jl. A");
    await consentSwitch(page).check();
    await submitButton(page).click();
    await expect(page.getByText("Tulis alamat lengkap, paling sedikit 10 karakter.")).toBeVisible();
    // The phone is the cleaner's contact on the day, so it is required too.
    await expect(page.getByLabel("Nomor HP")).toHaveAccessibleDescription(/Masukkan nomor HP Anda\./);
    await expect(page.getByText("Periksa 2 isian yang ditandai.")).toBeVisible();
    await expect(page.getByLabel("Alamat lengkap")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Alamat lengkap")).toBeFocused();
    // The consent stays on, so fixing the address is all that is left to do.
    await expect(consentSwitch(page)).toBeChecked();
    await expect(submitButton(page)).toBeEnabled();
  });

  test("says plainly when someone else takes the window first, and offers the other windows", async ({ page }) => {
    const target = await windowFor("13.00");
    await page.goto(orderPath(service.id, area, target.startsAt));
    const chosen = page.getByRole("group", { name: "Jadwal kedatangan" });
    await expect(chosen.getByText(`${windowText(target)} WIB`, { exact: true })).toBeVisible();
    await page.getByLabel("Alamat lengkap").fill(address);
    await page.getByLabel("Nomor HP").fill(phone);
    await consentSwitch(page).check();

    // Meanwhile other customers book the window's last places.
    const restore = await fillWindow(area, target.startsAt);
    try {
      await submitButton(page).click();
      const alert = page.getByRole("alert").filter({ hasText: "Jadwal ini baru saja terisi" });
      await expect(alert).toBeVisible();
      await expect(alert).toContainText("Pelanggan lain memesan tempat terakhir");
      await expect(page).toHaveURL(/\/pesan\?/);

      // The other free windows are offered right there, without the one that was taken.
      const day = page.getByRole("group", { name: dayText(target.startsAt) });
      await expect(day.getByRole("radio", { name: windowText(target) })).toHaveCount(0);
      await expect(day.getByRole("radio").first()).toBeVisible();
      await expect(chosen.getByText("Belum ada jadwal yang dipilih")).toBeVisible();
      // What the customer typed and agreed to is kept.
      await expect(page.getByLabel("Alamat lengkap")).toHaveValue(address);
      await expect(consentSwitch(page)).toBeChecked();
      const id = customerId();
      if (id) expect(await ordersAt(id, area, [target.startsAt])).toEqual([]);
    } finally {
      await restore();
    }
  });

  test("says so when the window is gone by the time the page opens", async ({ page }) => {
    await page.goto(orderPath(service.id, area, sundayAfternoon()));
    await expect(page.getByRole("heading", { name: "Jadwal ini sudah tidak kosong" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Jadwal kedatangan" }).getByText("Belum ada jadwal yang dipilih")).toBeVisible();
    // The area's free windows are open to choose from, right there.
    await expect(page.getByRole("radio").first()).toBeVisible();
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  });

  test("asks for another service when the one in the address cannot be booked", async ({ page }) => {
    const target = await windowFor("08.00");
    await page.goto(orderPath("no-such-service", area, target.startsAt));
    await expect(page.getByText("Layanan dari tautan ini tidak dapat dipesan. Pilih layanan lain di bawah.")).toBeVisible();
    const choice = page.getByLabel("Pilih layanan");
    await expect(choice).toHaveValue("");
    await choice.selectOption(service.id);
    await expect(page.getByRole("region", { name: "Layanan" }).getByText(service.name, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`layanan=${service.id}`));
    // The window from the address is still chosen.
    await expect(page.getByRole("group", { name: "Jadwal kedatangan" })).toContainText(windowText(target));
  });

  test("works in English, with times in Jakarta time", async ({ page }) => {
    const target = await windowFor("08.00", 1);
    await page.goto(orderPath(service.id, area, target.startsAt, "/en"));
    await expect(page.getByRole("heading", { level: 1, name: "Book a cleaning" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Service" }).getByText(service.nameEn, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Arrival time" }).getByText(`${windowText(target)} WIB`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/Only you and the HomeKlin monitoring team/)).toBeVisible();
    await expect(page.getByRole("switch", { name: /I agree/ })).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Book now" })).toBeDisabled();
  });

  test.describe("at 360 px", () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test("the booking page has no horizontal scroll and names no agency, in both languages", async ({ page }) => {
      const target = await windowFor("13.00", 1);
      for (const prefix of ["", "/en"]) {
        await page.goto(orderPath(service.id, area, target.startsAt, prefix));
        await expect(submitButton(page).or(page.getByRole("button", { name: "Book now" }))).toBeVisible();
        await page.getByRole("button", { name: /^(Ganti jadwal|Change time)$/ }).click();
        expect(await page.content()).not.toMatch(agencyWording);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      }
    });
  });
});

test.describe("as a visitor", () => {
  // Ordering needs no account beforehand (T9b): the old booking address leads straight to the order
  // page with the same choice, without a sign-in on the way.
  test("opens the old booking address and lands on the order page with the same choice, without signing in", async ({ page }) => {
    const target = await windowFor("08.00", 2);
    const params = new URLSearchParams({ service: service.id, area, starts: target.startsAt });
    await page.goto(`/book?${params.toString()}`);

    await expect(page).toHaveURL(orderPath(service.id, area, target.startsAt));
    await expect(page.getByRole("region", { name: "Layanan" }).getByText(service.name, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Jadwal kedatangan" }).getByText(`${windowText(target)} WIB`, { exact: true }),
    ).toBeVisible();
  });
});
