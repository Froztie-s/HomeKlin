import { expect, test, type Page } from "@playwright/test";

// T8, the customer catalog on a phone (markdown/tasks/todo.md): find a service by area, type and
// keyword in both languages, see the free arrival windows of a served area, the empty state where
// nobody is free (Jakarta Utara, which no one serves in the seed), and a search with no match.
// The test project is shared with other test runs that add and remove services, so these checks name
// specific seeded services and never count the whole list. The free windows come from the e2e setup
// (e2e/setup/catalog.setup.ts): 08.00, 10.00, 13.00 and 15.00 WIB, Monday to Saturday.

const seededStarts = ["08.00", "10.00", "13.00", "15.00"];
const windowText = /^(08\.00-10\.00|10\.00-12\.00|13\.00-15\.00|15\.00-17\.00)$/;

function priceList(page: Page, name = "Daftar harga") {
  return page.getByRole("list", { name });
}

function card(page: Page, service: string, list = "Daftar harga") {
  return priceList(page, list).getByRole("listitem").filter({ has: page.getByRole("heading", { name: service }) });
}

test.describe("finding a service", () => {
  test("starts in Jakarta Selatan with its free slots and HomeKlin's full prices", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByRole("combobox", { name: "Area layanan" })).toHaveValue("jakarta-selatan");
    await expect(page.getByRole("heading", { level: 2, name: "Jadwal kosong di Jakarta Selatan" })).toBeVisible();
    await expect(page.getByText("Paling cepat")).toBeVisible();

    const regular = card(page, "Pembersihan Rutin");
    await expect(regular).toBeVisible();
    await expect(regular.getByText(/^Rp\s[\d.]+$/)).toBeVisible();
    await expect(regular.getByText("± 2 jam")).toBeVisible();
    // The price is the whole price: never "from" a price.
    await expect(page.getByRole("main")).not.toContainText("mulai dari");
  });

  test("finds a service by area and type, and keeps the choice in the address", async ({ page }) => {
    await page.goto("/services");
    await page.getByRole("combobox", { name: "Area layanan" }).selectOption("jakarta-timur");
    await expect(page).toHaveURL("/services?area=jakarta-timur");
    await expect(page.getByRole("heading", { level: 2, name: "Jadwal kosong di Jakarta Timur" })).toBeVisible();

    const types = page.getByRole("group", { name: "Jenis layanan" });
    await types.getByRole("button", { name: "Sofa, karpet & kasur" }).click();
    await expect(page).toHaveURL("/services?area=jakarta-timur&type=fabrics");
    await expect(types.getByRole("button", { name: "Sofa, karpet & kasur" })).toHaveAttribute("aria-pressed", "true");
    await expect(types.getByRole("button", { name: "Semua" })).toHaveAttribute("aria-pressed", "false");
    await expect(card(page, "Kasur")).toBeVisible();
    await expect(card(page, "Sofa & Karpet")).toBeVisible();
    await expect(card(page, "Pembersihan Rutin")).toHaveCount(0);

    // A reload keeps both choices.
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Area layanan" })).toHaveValue("jakarta-timur");
    await expect(card(page, "Kasur")).toBeVisible();
    await expect(card(page, "Pembersihan Rutin")).toHaveCount(0);

    // "Semua" clears the type and keeps the area.
    await types.getByRole("button", { name: "Semua" }).click();
    await expect(page).toHaveURL("/services?area=jakarta-timur");
    await expect(card(page, "Pembersihan Rutin")).toBeVisible();
  });

  test("finds a service by keyword, and clears the search", async ({ page }) => {
    await page.goto("/services?area=jakarta-pusat");
    await page.getByRole("searchbox", { name: "Cari layanan" }).fill("jendela");
    await page.getByRole("searchbox", { name: "Cari layanan" }).press("Enter");
    await expect(page).toHaveURL("/services?area=jakarta-pusat&q=jendela");
    await expect(card(page, "Kaca & Jendela")).toBeVisible();
    await expect(card(page, "Pembersihan Rutin")).toHaveCount(0);
    await expect(page.getByText(/layanan untuk “jendela”/)).toBeVisible();

    await page.getByRole("link", { name: "Hapus pencarian" }).click();
    await expect(page).toHaveURL("/services?area=jakarta-pusat");
    await expect(page.getByRole("searchbox", { name: "Cari layanan" })).toHaveValue("");
    await expect(card(page, "Pembersihan Rutin")).toBeVisible();
  });

  test("matches a keyword in either language", async ({ page }) => {
    // An English word on the Indonesian page...
    await page.goto("/services?q=mattress");
    await expect(card(page, "Kasur")).toBeVisible();
    // ...and an Indonesian word on the English page.
    await page.goto("/en/services?q=kasur");
    await expect(card(page, "Mattress", "Price list")).toBeVisible();
  });

  test("works in English, with prices and times the Indonesian way", async ({ page }) => {
    await page.goto("/en/services");
    await expect(page.getByRole("combobox", { name: "Service area" })).toHaveValue("jakarta-selatan");
    await expect(page.getByRole("heading", { level: 2, name: "Free slots in South Jakarta" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search services" }).fill("sofa");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL("/en/services?q=sofa");
    const sofa = card(page, "Sofa & Carpet", "Price list");
    await expect(sofa.getByText(/^Rp\s[\d.]+$/)).toBeVisible();
    await expect(sofa.getByText(/^About \d+ hours?/)).toBeVisible();
    // No price is a starting price ("from Rp ...").
    await expect(priceList(page, "Price list")).not.toContainText(/\bfrom\b/i);
  });
});

test.describe("free slots", () => {
  test("shows the earliest free slot and every free slot of the next two weeks by day", async ({ page }) => {
    await page.goto("/services?area=jakarta-barat");
    const panel = page.getByRole("region", { name: "Jadwal kosong di Jakarta Barat" });
    await expect(panel.getByText(/^\d{2}\.\d{2}-\d{2}\.\d{2} WIB$/)).toBeVisible();

    await panel.getByText("Lihat semua jadwal kosong").click();
    const days = panel.getByRole("heading", { level: 3 });
    expect(await days.count()).toBeGreaterThanOrEqual(5);
    await expect(days.first()).toHaveText(/^(Hari ini|Besok|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu)\b/);
    // Monday to Saturday only: no Sunday in the seed.
    await expect(days.filter({ hasText: /Minggu/ })).toHaveCount(0);
    await expect(panel.getByText(/Waktu dalam WIB/)).toBeVisible();
  });

  test.describe("in a browser set to another time zone", () => {
    test.use({ timezoneId: "Pacific/Honolulu", locale: "en-US" });

    test("still shows the windows in Jakarta time", async ({ page }) => {
      await page.goto("/services");
      const panel = page.getByRole("region", { name: "Jadwal kosong di Jakarta Selatan" });
      await panel.getByText("Lihat semua jadwal kosong").click();
      const windows = panel.getByRole("listitem").filter({ hasText: windowText });
      expect(await windows.count()).toBeGreaterThanOrEqual(8);
      for (const text of await windows.allTextContents()) {
        expect(seededStarts).toContain(text.slice(0, 5));
      }
    });
  });

  test("says plainly when nobody serves the area yet, and offers the areas that are served", async ({ page }) => {
    await page.goto("/services");
    await page.getByRole("combobox", { name: "Area layanan" }).selectOption("jakarta-utara");
    await expect(page).toHaveURL("/services?area=jakarta-utara");
    await expect(page.getByRole("heading", { level: 2, name: "Belum ada jadwal kosong di Jakarta Utara" })).toBeVisible();
    await expect(page.getByText(/HomeKlin belum melayani area ini/)).toBeVisible();
    await expect(priceList(page)).toHaveCount(0);
    await expect(page.getByRole("searchbox")).toHaveCount(0);

    const served = page.getByRole("list", { name: "Area yang sudah dilayani HomeKlin" });
    await expect(served.getByRole("link", { name: "Jakarta Utara" })).toHaveCount(0);
    // The default area needs no ?area= in the address.
    await served.getByRole("link", { name: "Jakarta Selatan" }).click();
    await expect(page).toHaveURL("/services");
    await expect(page.getByRole("combobox", { name: "Area layanan" })).toHaveValue("jakarta-selatan");
    await expect(page.getByRole("heading", { level: 2, name: "Jadwal kosong di Jakarta Selatan" })).toBeVisible();
  });
});

test.describe("no match and odd addresses", () => {
  test("says when a search finds nothing, and leads back to every service", async ({ page }) => {
    await page.goto("/services?area=jakarta-timur&q=zzzqqq");
    await expect(page.getByRole("heading", { level: 2, name: "Tidak ada layanan yang cocok" })).toBeVisible();
    await expect(priceList(page)).toHaveCount(0);
    await page.getByRole("link", { name: "Lihat semua layanan" }).click();
    await expect(page).toHaveURL("/services?area=jakarta-timur");
    await expect(card(page, "Pembersihan Rutin")).toBeVisible();
  });

  test("ignores what it does not understand in the address", async ({ page }) => {
    await page.goto("/services?area=bandung&type=everything");
    await expect(page.getByRole("combobox", { name: "Area layanan" })).toHaveValue("jakarta-selatan");
    await expect(page.getByRole("group", { name: "Jenis layanan" }).getByRole("button", { name: "Semua" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(card(page, "Pembersihan Rutin")).toBeVisible();
  });
});

test.describe("one brand and one screen width, in every state", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const path of [
    "/services?area=jakarta-utara",
    "/services?area=jakarta-timur&type=fabrics",
    "/services?q=zzzqqq",
    "/en/services?area=jakarta-utara",
    "/en/services?area=jakarta-barat&type=rooms",
  ]) {
    test(`${path} names no agency and has no horizontal scroll at 360 px`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("combobox")).toBeVisible();
      for (const details of await page.locator("details").all()) await details.locator("summary").click();
      expect(await page.content()).not.toMatch(/agensi|agency|mitra|partner/i);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("while the catalog loads", () => {
  // Without JavaScript the streamed catalog never replaces its placeholder, which makes the loading
  // state itself visible to check: it is part of the prerendered page and says what is happening.
  test.use({ javaScriptEnabled: false });

  test("shows a placeholder that says the services are loading", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByRole("heading", { level: 1, name: "Layanan" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Memuat layanan…" })).toBeVisible();
  });
});
