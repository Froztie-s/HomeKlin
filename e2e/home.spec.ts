import { expect, test } from "@playwright/test";

// The customer home (static preview until T7-T8 wire real data).
test.describe("customer home", () => {
  test("shows the current job first, with a calm live status and who can watch", async ({ page }) => {
    await page.goto("/");
    const job = page.getByRole("region", { name: "Pesanan berjalan" });
    await expect(job).toBeVisible();
    await expect(job.getByText("Sedang berlangsung")).toBeVisible();
    await expect(job.getByRole("link", { name: "Tonton langsung" })).toBeVisible();
    await expect(job.getByText("Hanya Anda yang dapat menonton")).toBeVisible();
  });

  test("offers a search for agencies within a service area", async ({ page }) => {
    await page.goto("/");
    const search = page.getByRole("search");
    await expect(search.getByRole("combobox", { name: "Area layanan" })).toHaveValue("jakarta-selatan");
    await expect(search.getByRole("searchbox", { name: "Cari agensi atau layanan" })).toBeVisible();
  });

  test("lists the four service categories", async ({ page }) => {
    await page.goto("/");
    const categories = page.getByRole("region", { name: "Layanan" });
    for (const name of ["Pembersihan Rutin", "Deep Cleaning", "Sofa & Karpet", "Dapur & Kamar Mandi"]) {
      await expect(categories.getByRole("link", { name })).toBeVisible();
    }
  });

  test("lets the customer compare agencies on rating, area, verification and price", async ({ page }) => {
    await page.goto("/");
    const agencies = page.getByRole("region", { name: "Agensi di Jakarta Selatan" });
    const cards = agencies.getByRole("article");
    await expect(cards).toHaveCount(4);

    const first = cards.first();
    await expect(first.getByRole("heading", { level: 3 })).toBeVisible();
    await expect(first.getByText("Terverifikasi")).toBeVisible();
    await expect(first.getByText(/ulasan/)).toBeVisible();
    await expect(first.getByText(/^Rp\s[\d.]+$/)).toBeVisible();
  });

  test("says plainly that the page shows sample data", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/data contoh/)).toBeVisible();
  });
});
