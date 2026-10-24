import { expect, test } from "@playwright/test";

// The customer app home at /home: HomeKlin's real services, prices and areas (T8) around a sample
// running job (labelled as such until T12 brings real orders). The test project is shared with runs
// that add and remove services, so the checks name seeded services instead of counting the list.
test.describe("customer home", () => {
  test("shows the current job first: live status, the Petugas HomeKlin and who can watch", async ({ page }) => {
    await page.goto("/home");
    const job = page.getByRole("region", { name: "Pesanan berjalan" });
    await expect(job).toBeVisible();
    await expect(job.getByText("Sedang berlangsung")).toBeVisible();
    await expect(job.getByText("Wulan Anggraeni")).toBeVisible();
    await expect(job.getByText("Petugas HomeKlin", { exact: true })).toBeVisible();
    await expect(job.getByRole("img", { name: "Foto Wulan Anggraeni" })).toBeVisible();
    await expect(job.getByRole("link", { name: "Tonton langsung" })).toHaveAttribute("href", "/orders");
    await expect(job.getByText(/Hanya Anda dan tim pemantau HomeKlin yang dapat menonton/)).toBeVisible();
  });

  test("starts with the five service areas, Jakarta Selatan chosen, and leads to its free slots", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1, name: "Pesan kebersihan rumah" })).toBeVisible();
    const area = page.getByRole("combobox", { name: "Area layanan" });
    await expect(area).toHaveValue("jakarta-selatan");
    await expect(area.getByRole("option")).toHaveText([
      "Jakarta Selatan",
      "Jakarta Pusat",
      "Jakarta Barat",
      "Jakarta Timur",
      "Jakarta Utara",
    ]);

    // Choosing an area alone stays on the page; the button opens that area's services and free slots.
    await area.selectOption("jakarta-barat");
    await expect(page).toHaveURL("/home");
    await page.getByRole("button", { name: "Lihat jadwal" }).click();
    await expect(page).toHaveURL("/services?area=jakarta-barat");
    await expect(page.getByRole("heading", { level: 2, name: "Jadwal kosong di Jakarta Barat" })).toBeVisible();
  });

  test("lists HomeKlin's services with their full price and duration", async ({ page }) => {
    await page.goto("/home");
    const services = page.getByRole("region", { name: "Layanan HomeKlin" });
    for (const name of ["Pembersihan Rutin", "Kasur"]) {
      const item = services.getByRole("listitem").filter({ has: page.getByRole("heading", { name }) });
      await expect(item.getByText(/^Rp\s[\d.]+$/)).toBeVisible();
      await expect(item.getByText(/^± \d+ (jam|menit)/)).toBeVisible();
      await expect(item.getByRole("link")).toHaveAttribute("href", "/services");
    }
    await expect(services).not.toContainText("mulai dari");
    await expect(services.getByRole("link", { name: /Semua layanan/ })).toHaveAttribute("href", "/services");
  });

  test("says plainly that the running order is sample data", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByText("Pratinjau tampilan: pesanan berjalan di atas adalah data contoh.")).toBeVisible();
  });
});
