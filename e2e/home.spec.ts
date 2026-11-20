import { expect, test } from "@playwright/test";
import { signedInAs } from "./setup/auth-state";

// The customer app home at /home (D5, mocks Customer-Home and Phone-Home). A visitor sees where to
// start: the five service areas, which lead to step 1 of ordering, and HomeKlin's real services with
// their full price and duration (T8). A signed-in customer sees "Pesanan Anda": their own orders, their
// account and the way to help, which replaced the labelled sample job of T7. The test project is shared
// with runs that add and remove services, so the checks name seeded services instead of counting.
test.describe("customer home for a visitor", () => {
  test("starts with the five service areas, Jakarta Selatan chosen, and leads to its free times", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1, name: "Pesan kebersihan rumah" })).toBeVisible();
    const area = page.getByRole("combobox", { name: "Area layanan" });
    await expect(area).toHaveValue("jakarta-selatan");
    // The integration tests add areas named "Uji ..." to the shared test project while they run, and a
    // build made meanwhile lists them too; the five seeded areas come first, in this order.
    await expect(area.getByRole("option").filter({ hasNotText: /^Uji / })).toHaveText([
      "Jakarta Selatan",
      "Jakarta Pusat",
      "Jakarta Barat",
      "Jakarta Timur",
      "Jakarta Utara",
    ]);

    // Choosing an area alone stays on the page; the button opens step 1 in that area.
    await area.selectOption("jakarta-barat");
    await expect(page).toHaveURL("/home");
    await page.getByRole("button", { name: "Lihat jadwal" }).click();
    await expect(page).toHaveURL("/services?area=jakarta-barat");
    await expect(page.getByRole("heading", { level: 2, name: "Jam kosong di Jakarta Barat" })).toBeVisible();
  });

  test("lists HomeKlin's services with their full price and duration, each leading to step 1", async ({ page }) => {
    await page.goto("/home");
    const services = page.getByRole("region", { name: "Layanan HomeKlin" });
    for (const name of ["Pembersihan Rutin", "Kasur"]) {
      const item = services.getByRole("listitem").filter({ has: page.getByRole("heading", { name }) });
      await expect(item.getByText(/^Rp\s[\d.]+$/)).toBeVisible();
      await expect(item.getByText(/^± \d+ (jam|menit)/)).toBeVisible();
      await expect(item.getByRole("link")).toHaveAttribute("href", /^\/services\?layanan=[a-z0-9-]+$/);
    }
    await expect(services.getByRole("link", { name: "Pembersihan Rutin" })).toHaveAttribute("href", "/services?layanan=regular");
    await expect(services).not.toContainText("mulai dari");
    await expect(services.getByRole("link", { name: /Semua layanan/ })).toHaveAttribute("href", "/services");
  });

  test("shows no sample data any more", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/data contoh/i)).toHaveCount(0);
  });
});

test.describe("customer home when signed in", () => {
  test.use(signedInAs.customer);

  test("shows Pesanan Anda with the account, the recording facts and the way to book again", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1, name: "Pesanan Anda" })).toBeVisible();
    // Since 2026-11-20 the home holds only the orders still to come; the finished ones are on /orders
    // (e2e/orders.mobile.spec.ts checks what goes where, with its own customers).
    await expect(page.getByRole("tablist")).toHaveCount(0);
    const aside = page.getByRole("complementary", { name: "Akun dan bantuan" });
    await expect(aside.getByRole("heading", { name: "Akun Anda" })).toBeVisible();
    await expect(aside.getByRole("button", { name: "Keluar" })).toBeVisible();
    await expect(aside.getByText("Tersedia 7 hari, lalu dihapus otomatis.")).toBeVisible();
    await expect(aside.getByRole("link", { name: "Hubungi bantuan" })).toHaveAttribute("href", "/support");
    await expect(page.getByRole("link", { name: "Pesan layanan lagi" })).toHaveAttribute("href", "/services");
    await expect(page.getByText(/data contoh/i)).toHaveCount(0);
  });
});
