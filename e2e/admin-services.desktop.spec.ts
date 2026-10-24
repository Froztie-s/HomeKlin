import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { adminClient, visitorClient } from "../tests/integration/test-project";
import { signedInAs } from "./setup/auth-state";

// T7b on a desk: admin manages HomeKlin's services and the one price list at /admin/services, and only
// admin may. Runs against the separate Supabase test project (playwright.config.ts).
// Test data: other specs read the same catalog at the same time, so this file never changes the seven
// seeded services. It adds its own, with a unique id (uji-<random>), placed last (order 999), and keeps
// it switched off except while it checks switching on; afterAll deletes what it added.

const created: string[] = [];

/** A unique, fictional service for one test. */
function testService() {
  const id = `uji-${randomUUID().slice(0, 8)}`;
  created.push(id);
  return { id, nameId: `Uji Layanan ${id.slice(4)}`, nameEn: `Test Service ${id.slice(4)}` };
}

test.afterAll(async () => {
  if (created.length > 0) await adminClient().from("services").delete().in("id", created.splice(0));
});

/** What a visitor's catalog (the customer pages' read, src/lib/catalog/catalog.ts) says about a service. */
async function visitorSees(id: string): Promise<{ price_idr: number } | undefined> {
  const { data, error } = await visitorClient().rpc("search_services", { p_query: null, p_category: null, p_area: null });
  if (error) throw new Error(`Could not read the catalog as a visitor: ${error.message}`);
  return (data as { id: string; price_idr: number }[]).find((service) => service.id === id);
}

async function fillNewService(page: Page, service: { id: string; nameId: string; nameEn: string }) {
  await page.getByLabel("ID layanan").fill(service.id);
  await page.getByLabel("Jenis layanan").selectOption({ label: "Kain & kasur" });
  await page.getByLabel("Urutan tampil").fill("999");
  await page.getByLabel("Nama (Bahasa Indonesia)").fill(service.nameId);
  await page.getByLabel("Deskripsi (Bahasa Indonesia)").fill("Layanan uji otomatis. Tidak dijual.");
  await page.getByLabel("Nama (Inggris)").fill(service.nameEn);
  await page.getByLabel("Deskripsi (Inggris)").fill("An automated test service. Not for sale.");
  await page.getByLabel("Harga (Rp)").fill("90.000");
  await page.getByLabel("Durasi (menit)").fill("90");
}

test.describe("an admin", () => {
  test.use(signedInAs.admin);

  test("sees every service with its price, type, duration and state", async ({ page }) => {
    await page.goto("/admin/services");
    await expect(page.getByRole("heading", { level: 1, name: "Layanan & Harga" })).toBeVisible();

    const table = page.getByRole("table", { name: "Layanan HomeKlin dan harganya" });
    for (const header of ["Layanan", "Jenis", "Harga", "Durasi", "Status"]) {
      await expect(table.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
    }
    const row = table.getByRole("row").filter({ hasText: "Pembersihan Rutin" });
    await expect(row).toContainText("Regular Cleaning");
    await expect(row).toContainText("Seluruh rumah");
    await expect(row).toContainText("2 jam");
    await expect(row).toContainText(/Rp\s85\.000/);
    // The state is a word as well as the switch, never the colour alone.
    await expect(row.getByRole("switch", { name: "Tampilkan Pembersihan Rutin di katalog pelanggan" })).toBeVisible();
    await expect(row.getByText(/^(Aktif|Nonaktif)$/)).toBeVisible();
    await expect(row.getByRole("link", { name: "Ubah Pembersihan Rutin" })).toHaveAttribute(
      "href",
      "/admin/services/edit?id=regular",
    );
  });

  test("adds a service, changes its price, and switches it on and off for customers", async ({ page }) => {
    const service = testService();

    await test.step("adds the service, switched off", async () => {
      await page.goto("/admin/services");
      await page.getByRole("link", { name: "Tambah layanan" }).click();
      await expect(page).toHaveURL("/admin/services/new");
      await expect(page.getByRole("heading", { level: 1, name: "Tambah layanan" })).toBeVisible();
      await expect(page.getByLabel("Aktif: tampil di katalog pelanggan")).not.toBeChecked();

      await fillNewService(page, service);
      await page.getByRole("button", { name: "Simpan layanan" }).click();

      await expect(page).toHaveURL(`/admin/services?created=${service.id}`);
      await expect(page.getByRole("status").filter({ hasText: `${service.nameId} ditambahkan.` })).toContainText(
        "belum tampil di katalog pelanggan",
      );
      const row = page.getByRole("row").filter({ hasText: service.nameId });
      await expect(row).toContainText(service.nameEn);
      await expect(row).toContainText("1 jam 30 menit");
      await expect(row.getByRole("switch")).toHaveAttribute("aria-checked", "false");
      await expect(row.getByText("Nonaktif", { exact: true })).toBeVisible();

      const { data } = await adminClient().from("services").select("price_idr, is_active, category").eq("id", service.id).single();
      expect(data).toEqual({ price_idr: 90000, is_active: false, category: "fabrics" });
      expect(await visitorSees(service.id)).toBeUndefined();
    });

    await test.step("changes the price", async () => {
      await page.getByRole("link", { name: `Ubah ${service.nameId}` }).click();
      await expect(page).toHaveURL(`/admin/services/edit?id=${service.id}`);
      await expect(page.getByRole("heading", { level: 1, name: "Ubah layanan" })).toBeVisible();
      // The id is shown, not editable.
      const id = page.getByLabel("ID layanan");
      await expect(id).toHaveValue(service.id);
      await expect(id).not.toBeEditable();

      const price = page.getByLabel("Harga (Rp)");
      await expect(price).toHaveValue("90000");
      await price.fill("95.000");
      await page.getByRole("button", { name: "Simpan perubahan" }).click();

      await expect(page).toHaveURL(`/admin/services?saved=${service.id}`);
      await expect(page.getByRole("status").filter({ hasText: `Perubahan pada ${service.nameId} disimpan.` })).toBeVisible();
      await expect(page.getByRole("row").filter({ hasText: service.nameId })).toContainText(/Rp\s95\.000/);
    });

    await test.step("switches it on: visitors read the new price in the catalog", async () => {
      const row = page.getByRole("row").filter({ hasText: service.nameId });
      const toggle = row.getByRole("switch", { name: `Tampilkan ${service.nameId} di katalog pelanggan` });
      await toggle.click();
      // The announcement comes with the server's answer, after the change is stored.
      await expect(row.getByRole("status")).toHaveText(`${service.nameId} sekarang tampil di katalog pelanggan.`);
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await expect(row.getByText("Aktif", { exact: true })).toBeVisible();
      expect(await visitorSees(service.id)).toMatchObject({ price_idr: 95000 });
    });

    await test.step("switches it off again: visitors no longer see it", async () => {
      const row = page.getByRole("row").filter({ hasText: service.nameId });
      const toggle = row.getByRole("switch");
      await toggle.click();
      await expect(row.getByRole("status")).toHaveText(`${service.nameId} tidak tampil lagi di katalog pelanggan.`);
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      expect(await visitorSees(service.id)).toBeUndefined();

      // After a reload the list still shows what is stored.
      await page.reload();
      await expect(page.getByRole("row").filter({ hasText: service.nameId }).getByRole("switch")).toHaveAttribute(
        "aria-checked",
        "false",
      );
    });
  });

  test("is told what to fix, per field and in the page's language, and nothing is saved", async ({ page }) => {
    await page.goto("/admin/services/new");
    await page.getByRole("button", { name: "Simpan layanan" }).click();

    await expect(page.getByLabel("ID layanan")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("ID layanan")).toBeFocused();
    await expect(page.getByText("Masukkan ID layanan.")).toBeVisible();
    await expect(page.getByText("Pilih jenis layanan.")).toBeVisible();
    await expect(page.getByText("Masukkan harga.")).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Periksa 8 kolom yang ditandai.");
    await expect(page).toHaveURL("/admin/services/new");

    await page.goto("/en/admin/services/new");
    await page.getByLabel("Service ID").fill("Bad ID!");
    await page.getByLabel("Price (Rp)").fill("85,5");
    await page.getByRole("button", { name: "Save service" }).click();
    await expect(page.getByText("Use only lowercase letters, numbers and hyphens")).toBeVisible();
    await expect(page.getByText("Write the price in whole rupiah, for example 85000 or 85.000.")).toBeVisible();
    // What was typed stays in the form.
    await expect(page.getByLabel("Price (Rp)")).toHaveValue("85,5");
  });

  test("cannot take an id that is already in use", async ({ page }) => {
    const service = testService();
    await page.goto("/admin/services/new");
    await fillNewService(page, { ...service, id: "regular" });
    await page.getByRole("button", { name: "Simpan layanan" }).click();

    await expect(page.getByText("ID ini sudah dipakai layanan lain. Pilih ID lain.")).toBeVisible();
    await expect(page).toHaveURL("/admin/services/new");
    // The seeded service is unchanged.
    const { data } = await adminClient().from("services").select("name_id").eq("id", "regular").single();
    expect(data?.name_id).toBe("Pembersihan Rutin");
  });

  test("is told plainly when a service does not exist", async ({ page }) => {
    await page.goto("/admin/services/edit?id=tidak-ada-layanan-ini");
    await expect(page.getByRole("heading", { name: "Layanan tidak ditemukan" })).toBeVisible();
    await page.getByRole("link", { name: "Kembali ke daftar layanan" }).click();
    await expect(page).toHaveURL("/admin/services");
  });
});

test.describe("a signed-in customer", () => {
  test.use(signedInAs.customer);

  test("is sent to their own home, and never gets the admin's list or form", async ({ page }) => {
    const html = await (await page.request.get("/admin/services")).text();
    expect(html).not.toContain("Tambah layanan");
    const form = await (await page.request.get("/admin/services/new")).text();
    expect(form).not.toContain("Simpan layanan");

    await page.goto("/admin/services");
    await expect(page).toHaveURL("/home");
  });
});
