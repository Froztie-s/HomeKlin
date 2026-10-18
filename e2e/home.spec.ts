import { expect, test } from "@playwright/test";

// The customer app home at /home (static preview until T7-T8 and T12 wire real data).
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

  test("starts with the service area picker set to Jakarta Selatan", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1, name: "Pesan kebersihan rumah" })).toBeVisible();
    const area = page.getByRole("combobox", { name: "Area layanan" });
    await expect(area).toHaveValue("jakarta-selatan");
    await expect(area.getByRole("option")).toHaveCount(5);
  });

  test("lists HomeKlin's four services with a starting price and the next free slot", async ({ page }) => {
    await page.goto("/home");
    const services = page.getByRole("region", { name: "Layanan HomeKlin" });
    const items = services.getByRole("listitem");
    await expect(items).toHaveCount(4);
    for (const item of await items.all()) {
      await expect(item).toContainText("mulai dari");
      await expect(item.getByText(/^Rp\s[\d.]+$/)).toBeVisible();
      await expect(item.getByText(/Jadwal terdekat/)).toBeVisible();
    }
    await expect(services.getByRole("link", { name: /Semua layanan/ })).toHaveAttribute("href", "/services");
  });

  test("says plainly that the page shows sample data", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByText(/data contoh/)).toBeVisible();
  });
});

test.describe("customer services page", () => {
  test("lists the four services with prices, durations and the next free slot", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByRole("heading", { level: 1, name: "Layanan" })).toBeVisible();
    const items = page.getByRole("main").getByRole("listitem");
    await expect(items).toHaveCount(4);
    for (const item of await items.all()) {
      await expect(item.getByRole("heading", { level: 2 })).toBeVisible();
      await expect(item).toContainText("mulai dari");
      await expect(item.getByText(/^Rp\s[\d.]+$/)).toBeVisible();
      await expect(item.getByText(/jam$/)).toBeVisible();
      await expect(item.getByText(/Jadwal terdekat/)).toBeVisible();
    }
    await expect(page.getByText(/data contoh/)).toBeVisible();
  });
});
