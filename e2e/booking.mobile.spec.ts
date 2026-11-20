import { expect, test, type Locator, type Page } from "@playwright/test";
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
import { jakartaDate, orderPath, stepOneChip } from "./order-test-data";
import { readTestUsers, signedInAs } from "./setup/auth-state";

// T9 on a phone (customers are mobile-first), on the order page since T9b (/pesan), in the three steps
// since D5: a signed-in customer goes from step 1 (/services: a service and a free time) to step 2
// (/pesan: the address, the phone, a note for the Petugas, the streaming consent) and on to step 3,
// the payment, where the order waits for payment. Also: the consent is required, a window someone else takes in the meantime
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

const bookingForm = (page: Page, lang: "id" | "en" = "id") => page.getByRole("form", { name: lang === "id" ? "Pesan layanan" : "Book a cleaning" });
const consentSwitch = (page: Page) => page.getByRole("switch", { name: /Saya setuju/ });
// The form's own button; the phone bar repeats it outside the form (BookingBar), joined with form="...".
const submitButton = (page: Page) => bookingForm(page).getByRole("button", { name: "Lanjut ke pembayaran" });
const note = "Masuk lewat pintu samping. Kunci ada di pos satpam.";

test.describe("as a signed-in customer", () => {
  test.use(signedInAs.customer);

  test("books a service for a free window and sees the order waiting for payment", async ({ page }) => {
    const first = await windowFor("15.00", 1);
    const target = await windowFor("15.00");

    // Step 1: a service and a time, with the summary following the choice.
    await page.goto(`/services?area=${area}`);
    const currentStep = page.getByRole("list", { name: "Langkah pemesanan" }).locator('[aria-current="step"]');
    await expect(currentStep).toContainText("Layanan");
    await expect(page.getByText("Langkah 1 dari 3")).toBeVisible();
    const card = page
      .getByRole("list", { name: "Layanan", exact: true })
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: service.name }) });
    const price = (await card.getByText(/^Rp\s[\d.]+$/).textContent()) ?? "";
    expect(price).toMatch(/^Rp/);
    const summary1 = page.getByRole("form", { name: "Ringkasan" });
    // "Pesan sekarang" is never disabled: without a service it says so and goes to the services.
    const bookNow = summary1.getByRole("button", { name: "Pesan sekarang" });
    await expect(bookNow).toBeEnabled();
    await expect(bookNow).toHaveAccessibleDescription("Pilih layanan dulu untuk melanjutkan.");
    await bookNow.click();
    await expect(page).toHaveURL(/\/services\?/);
    const serviceGroup = page.getByRole("radiogroup", { name: "Layanan", exact: true });
    await expect(serviceGroup).toHaveAccessibleDescription("Pilih salah satu layanan untuk melanjutkan.");
    await expect(serviceGroup.getByRole("radio").first()).toBeFocused();
    await page.getByRole("radio", { name: service.name, exact: true }).check();
    await expect(page.getByText("Pilih salah satu layanan untuk melanjutkan.")).toHaveCount(0);
    await expect(summary1.getByText(price, { exact: true })).toBeVisible();
    const times = page.getByRole("region", { name: "Jam kosong di Jakarta Barat" });
    await times.getByLabel("Tanggal").selectOption(jakartaDate(first.startsAt));
    await times.getByRole("radio", { name: stepOneChip(first) }).check();
    await bookNow.click();

    // Step 2 opens with the service, the area and the time chosen, shown once, read-only.
    await expect(page).toHaveURL(/\/pesan\?/);
    const url = new URL(page.url());
    expect(Object.fromEntries(url.searchParams)).toEqual({ layanan: service.id, area, starts: first.startsAt });
    await expect(page.getByRole("heading", { level: 1, name: "Detail pemesanan" })).toBeVisible();
    await expect(currentStep).toContainText("Pesan");
    await expect(page.getByText("Langkah 2 dari 3")).toBeVisible();
    const choice = page.getByRole("region", { name: "Layanan dan jadwal" });
    await expect(choice.getByText(service.name, { exact: true })).toBeVisible();
    await expect(choice.getByText("± 2 jam")).toBeVisible();
    await expect(choice.getByText(price, { exact: true })).toBeVisible();
    await expect(choice.getByText("Jakarta Barat", { exact: true })).toBeVisible();
    await expect(choice.getByText(`${windowText(first)} WIB`, { exact: true })).toBeVisible();
    // No pickers to fill in again.
    await expect(page.getByLabel("Pilih layanan")).toHaveCount(0);
    await expect(page.getByLabel("Area layanan")).toHaveCount(0);
    await expect(bookingForm(page).getByRole("radio")).toHaveCount(0);
    await expect(bookingForm(page).getByText(price, { exact: true }).last()).toBeVisible();
    // Signed in: no email and no code, the order goes straight through, and no "no account needed".
    await expect(page.getByText("Anda memesan sebagai")).toBeVisible();
    await expect(page.getByText(/Tidak perlu membuat akun/)).toHaveCount(0);

    await page.getByLabel("Alamat lengkap").fill(address);
    await page.getByLabel("Nomor HP").fill(phone);
    await page.getByLabel("Catatan untuk Petugas (opsional)").fill(note);

    // "Ubah": back to step 1 with the choice, then another time late in the range; what was typed stays.
    await choice.getByRole("link", { name: "Ubah layanan dan jadwal" }).click();
    await expect(page).toHaveURL(/\/services\?/);
    expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ area, layanan: service.id, starts: first.startsAt });
    await expect(page.getByRole("radio", { name: service.name, exact: true })).toBeChecked();
    await expect(times.getByRole("radio", { name: stepOneChip(first) })).toBeChecked();
    await times.getByLabel("Tanggal").selectOption(jakartaDate(target.startsAt));
    await times.getByRole("radio", { name: stepOneChip(target) }).check();
    await bookNow.click();
    await expect(page).toHaveURL(new RegExp(`starts=${encodeURIComponent(target.startsAt)}`));
    await expect(choice.getByText(dayText(target.startsAt), { exact: true })).toBeVisible();
    await expect(choice.getByText(`${windowText(target)} WIB`, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Alamat lengkap")).toHaveValue(address);
    await expect(page.getByLabel("Nomor HP")).toHaveValue(phone);
    await expect(page.getByLabel("Catatan untuk Petugas (opsional)")).toHaveValue(note);

    // The streaming consent comes with a plain explanation, and booking waits for it: the button
    // works, the switch is marked and gets the cursor. The consent itself is never kept for "Ubah".
    await expect(page.getByText(/Hanya Anda dan tim pemantau HomeKlin/)).toBeVisible();
    await expect(page.getByText(/disimpan 7 hari, lalu dihapus/)).toBeVisible();
    await expect(consentSwitch(page)).not.toBeChecked();
    await expect(submitButton(page)).toBeEnabled();
    await submitButton(page).click();
    await expect(consentSwitch(page)).toBeFocused();
    await expect(consentSwitch(page)).toHaveAccessibleDescription("Nyalakan persetujuan siaran untuk memesan.");
    await consentSwitch(page).check();
    await expect(page.getByText("Nyalakan persetujuan siaran untuk memesan.")).toHaveCount(0);
    await submitButton(page).click();

    // Booking and the redirect run on the server; under a full parallel run that can take over 5 s.
    await expect(page).toHaveURL(/\/orders\/pay\?order=[0-9a-f-]{36}$/, { timeout: 15_000 });
    const orderId = new URL(page.url()).searchParams.get("order") ?? "";
    try {
      const confirmation = page.getByRole("region", { name: "Pembayaran" });
      await expect(currentStep).toContainText("Bayar");
      await expect(confirmation.getByText("Menunggu pembayaran")).toBeVisible();
      await expect(confirmation.getByText(service.name)).toBeVisible();
      await expect(confirmation.getByText(price, { exact: true })).toBeVisible();
      await expect(confirmation.getByText(`${dayText(target.startsAt)}, ${windowText(target)} WIB`)).toBeVisible();
      await expect(confirmation.getByText(address)).toBeVisible();
      // The next step is paying (T10, e2e/payment.mobile.spec.ts).
      await expect(confirmation.getByRole("button", { name: "Bayar sekarang" }).first()).toBeVisible();

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
        .select("status, starts_at, stream_consent, contact_phone, customer_note")
        .eq("id", orderId)
        .single();
      expect(data?.status).toBe("pending_payment");
      expect(data?.contact_phone).toBe("+6281234567890");
      expect(data?.stream_consent).toBe(true);
      expect(data?.customer_note).toBe(note);
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
    // The button stays usable; its hint names the switch and links to it, wherever it sits.
    await expect(submitButton(page)).toBeEnabled();
    await expect(submitButton(page)).toHaveAccessibleDescription("Nyalakan persetujuan siaran untuk melanjutkan.");
    await page.getByRole("link", { name: "persetujuan siaran" }).click();
    await expect(consentSwitch(page)).toBeFocused();

    // Sent without it: the server refuses, the switch says why and gets the cursor.
    await submitButton(page).click();
    await expect(page.getByText("Nyalakan persetujuan siaran untuk memesan.", { exact: true })).toBeVisible();
    await expect(consentSwitch(page)).toHaveAttribute("aria-invalid", "true");
    await expect(consentSwitch(page)).toBeFocused();
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
    const choice = page.getByRole("region", { name: "Layanan dan jadwal" });
    await expect(choice.getByText(`${windowText(target)} WIB`, { exact: true })).toBeVisible();
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

      // The pickers open on that day: the taken window is marked full and cannot be chosen, the others can.
      const day = page.getByRole("group", { name: dayText(target.startsAt) });
      await expect(day.getByRole("radio", { name: stepOneChip(target), exact: true })).toHaveCount(0);
      await expect(day.getByRole("radio", { name: `${stepOneChip(target)}, penuh` })).toBeDisabled();
      await expect(day.getByRole("radio", { disabled: false }).first()).toBeVisible();
      await expect(page.getByRole("group", { name: "Jadwal kedatangan" }).getByText("Belum ada jadwal yang dipilih")).toBeVisible();
      // What the customer typed and agreed to is kept.
      await expect(page.getByLabel("Alamat lengkap")).toHaveValue(address);
      await expect(consentSwitch(page)).toBeChecked();
      const id = customerId();
      if (id) expect(await ordersAt(id, area, [target.startsAt])).toEqual([]);
    } finally {
      await restore();
    }
  });

  test("writes the times on steps 1 and 2 the same way, a full one shown as full on both", async ({ page }) => {
    const full = await windowFor("15.00", 2);
    const restore = await fillWindow(area, full.startsAt);
    try {
      await page.goto(`/services?area=${area}&layanan=${service.id}`);
      const times = page.getByRole("region", { name: "Jam kosong di Jakarta Barat" });
      await times.getByLabel("Tanggal").selectOption(jakartaDate(full.startsAt));
      const chips = async (scope: Locator) => ({
        names: await scope.getByRole("radio").evaluateAll((radios) => radios.map((radio) => radio.getAttribute("aria-label"))),
        texts: (await scope.locator("label").allInnerTexts()).map((text) => text.replace(/\s+/g, " ").trim()),
      });
      const stepOne = await chips(times.locator("fieldset"));
      expect(stepOne.texts).toContain(`${windowText(full)} penuh`);
      await expect(times.getByRole("radio", { name: `${stepOneChip(full)}, penuh` })).toBeDisabled();

      // Step 2 with the time still to choose (as from a landing link): the same chips, the same rule.
      await page.goto(orderPath(service.id, area));
      await page.getByLabel("Tanggal", { exact: true }).selectOption(jakartaDate(full.startsAt));
      const stepTwo = await chips(page.getByRole("group", { name: dayText(full.startsAt) }));
      expect(stepTwo).toEqual(stepOne);
      for (const text of stepTwo.texts) expect(text).toMatch(/^\d{2}\.\d{2}-\d{2}\.\d{2}( penuh)?$/);
      await expect(page.getByRole("radio", { name: `${stepOneChip(full)}, penuh` })).toBeDisabled();
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
    // The options carry the name only (the price shows under the select, never cut off).
    await expect(choice.getByRole("option", { name: service.name, exact: true })).toBeAttached();
    await choice.selectOption(service.id);
    const summary = page.getByRole("region", { name: "Layanan" }).locator("p");
    await expect(summary.getByText(service.name, { exact: true })).toBeVisible();
    await expect(summary.getByText(/^Rp\s[\d.]+$/)).toBeVisible();
    // The times are read again for that service; the window from the address stays chosen.
    await expect(page).toHaveURL(new RegExp(`layanan=${service.id}`));
    await expect(page.getByRole("group", { name: "Jadwal kedatangan" })).toContainText(windowText(target));
    await expect(page.getByRole("radio", { name: stepOneChip(target), exact: true })).toBeChecked();
  });

  test("works in English, with times in Jakarta time", async ({ page }) => {
    const target = await windowFor("08.00", 1);
    await page.goto(orderPath(service.id, area, target.startsAt, "/en"));
    await expect(page.getByRole("heading", { level: 1, name: "Booking details" })).toBeVisible();
    const choice = page.getByRole("region", { name: "Service and time" });
    await expect(choice.getByText(service.nameEn, { exact: true })).toBeVisible();
    await expect(choice.getByText(`${windowText(target)} WIB`, { exact: true })).toBeVisible();
    await expect(page.getByText(/Only you and the HomeKlin monitoring team/)).toBeVisible();
    await expect(page.getByRole("switch", { name: /I agree/ })).not.toBeChecked();
    const button = bookingForm(page, "en").getByRole("button", { name: "Continue to payment" });
    await expect(button).toBeEnabled();
    await expect(button).toHaveAccessibleDescription("Turn on the streaming consent to carry on.");
  });

  test.describe("at 360 px", () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test("the booking page has no horizontal scroll and names no agency, in both languages", async ({ page }) => {
      const target = await windowFor("13.00", 1);
      for (const [prefix, lang] of [["", "id"], ["/en", "en"]] as const) {
        await page.goto(orderPath(service.id, area, target.startsAt, prefix));
        await expect(bookingForm(page, lang).getByRole("button", { name: lang === "id" ? "Lanjut ke pembayaran" : "Continue to payment" })).toBeAttached();
        await expect(page.getByRole("region", { name: lang === "id" ? "Layanan dan jadwal" : "Service and time" })).toBeVisible();
        expect(await page.content()).not.toMatch(agencyWording);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      }
      // The pickers' selects fit too: names only, short day names.
      await page.goto(orderPath(service.id, area, undefined, "/en"));
      await page.getByLabel("Choose a service").selectOption(service.id);
      for (const select of [page.getByLabel("Choose a service"), page.getByLabel("Date", { exact: true })]) {
        const fits = await select.evaluate((element) => {
          const field = element as HTMLSelectElement;
          const option = field.selectedOptions[0];
          const probe = document.createElement("span");
          probe.style.font = getComputedStyle(field).font;
          probe.style.whiteSpace = "nowrap";
          probe.style.position = "absolute";
          probe.textContent = option?.textContent ?? "";
          document.body.append(probe);
          const text = probe.getBoundingClientRect().width;
          probe.remove();
          const style = getComputedStyle(field);
          return text <= field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        });
        expect(fits).toBe(true);
      }
    });

    test("a service tapped on a phone brings its free times into view; the arrow keys do not move the page", async ({ page }) => {
      await page.goto(`/services?area=${area}`);
      const times = page.getByRole("region", { name: /^Jam kosong/ });
      const radios = page.getByRole("radiogroup", { name: "Layanan" }).getByRole("radio");
      await radios.first().scrollIntoViewIfNeeded();
      await expect(times).not.toBeInViewport();
      await radios.first().click({ force: true });
      await expect(times).toBeInViewport();

      await page.evaluate(() => window.scrollTo(0, 0));
      await radios.first().focus();
      const before = await page.evaluate(() => window.scrollY);
      await page.keyboard.press("ArrowDown");
      await expect(radios.nth(1)).toBeChecked();
      expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(before + 200);
    });

    test("keeps the choice, the price and the button in a bar at the bottom while the button is out of sight", async ({ page }) => {
      const target = await windowFor("10.00", 2);
      for (const path of [`/services?area=${area}&layanan=${service.id}`, orderPath(service.id, area, target.startsAt)]) {
        await page.goto(path);
        const bar = page.getByRole("region", { name: "Pilihan Anda" });
        await expect(bar).toBeVisible();
        await expect(bar).toContainText(service.name);
        await expect(bar).toContainText(/Rp\s[\d.]+/);
        const button = bar.getByRole("button");
        const box = await button.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        // The booking flow has no bottom navigation: the bar sits on the bottom edge, and the floating
        // language switch moves up above it, never over it. (Polled: the bar slides in.)
        await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toHaveCount(0);
        const viewport = page.viewportSize()!;
        await expect
          .poll(async () => {
            const barBox = await bar.boundingBox();
            return Math.round((barBox?.y ?? 0) + (barBox?.height ?? 0));
          })
          .toBe(viewport.height);
        const languages = page.getByRole("group", { name: "Bahasa" });
        await expect
          .poll(async () => {
            const [barBox, switchBox] = [await bar.boundingBox(), await languages.boundingBox()];
            return (switchBox?.y ?? 0) + (switchBox?.height ?? 0) <= (barBox?.y ?? 0);
          })
          .toBe(true);
        // With the step's own button on screen the bar steps aside (and leaves the accessibility tree).
        const own = path.startsWith("/services")
          ? page.getByRole("form", { name: "Ringkasan" }).getByRole("button", { name: "Pesan sekarang" })
          : submitButton(page);
        await own.scrollIntoViewIfNeeded();
        await expect(bar).toHaveCount(0);
        await expect(page.getByTestId("booking-bar")).toHaveAttribute("data-shown", "false");
      }
      // On step 2 its button sends the form like the form's own button: without the consent, the switch says why.
      await page.goto(orderPath(service.id, area, target.startsAt));
      await page.getByLabel("Alamat lengkap").fill(address);
      await page.getByLabel("Nomor HP").fill(phone);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByRole("region", { name: "Pilihan Anda" }).getByRole("button", { name: "Lanjut ke pembayaran" }).click();
      await expect(consentSwitch(page)).toBeFocused();
      await expect(consentSwitch(page)).toHaveAttribute("aria-invalid", "true");
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
    const choice = page.getByRole("region", { name: "Layanan dan jadwal" });
    await expect(choice.getByText(service.name, { exact: true })).toBeVisible();
    await expect(choice.getByText(`${windowText(target)} WIB`, { exact: true })).toBeVisible();
  });
});
