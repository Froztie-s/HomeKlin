import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { adminClient } from "../tests/integration/test-project";
import { signedInAs } from "./setup/auth-state";

// T7b and T8 together: what admin changes at /admin/services is what customers see on /services, at
// once. The customer pages cache the catalog under catalogCacheTag and admin's Server Actions expire it
// with updateTag (src/lib/catalog/cached.ts, src/lib/catalog/admin-actions.ts), so the change must show
// on the very next visit. Two browsers: a signed-in admin and a visitor who is not signed in.
// Test data: one service of its own (uji-<random>, order 999); the seeded services are never touched,
// and afterAll deletes it.

const service = (() => {
  const token = randomUUID().slice(0, 8);
  return { id: `uji-${token}`, token, nameId: `Uji Katalog ${token}`, nameEn: `Test Catalog ${token}` };
})();

test.afterAll(async () => {
  await adminClient().from("services").delete().eq("id", service.id);
});

/** The visitor's /services for this test's keyword, once the streamed catalog has arrived. */
async function visitorCatalog(page: Page) {
  await page.goto(`/services?q=${service.token}`);
  await expect(page.getByText("Memuat layanan…")).toHaveCount(0);
  return page.getByRole("main");
}

test("a price admin saves is the price customers see on their next visit", async ({ browser }) => {
  const adminContext = await browser.newContext({ storageState: signedInAs.admin.storageState });
  const visitorContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const visitor = await visitorContext.newPage();

  await test.step("admin adds the service, switched on, at Rp 90.000", async () => {
    await admin.goto("/admin/services/new");
    await admin.getByLabel("ID layanan").fill(service.id);
    await admin.getByLabel("Jenis layanan").selectOption({ label: "Kain & kasur" });
    await admin.getByLabel("Urutan tampil").fill("999");
    await admin.getByLabel("Nama (Bahasa Indonesia)").fill(service.nameId);
    await admin.getByLabel("Deskripsi (Bahasa Indonesia)").fill("Layanan uji otomatis. Tidak dijual.");
    await admin.getByLabel("Nama (Inggris)").fill(service.nameEn);
    await admin.getByLabel("Deskripsi (Inggris)").fill("An automated test service. Not for sale.");
    await admin.getByLabel("Harga (Rp)").fill("90.000");
    await admin.getByLabel("Durasi (menit)").fill("90");
    await admin.getByLabel("Aktif: tampil di katalog pelanggan").check();
    await admin.getByRole("button", { name: "Simpan layanan" }).click();
    await expect(admin).toHaveURL(`/admin/services?created=${service.id}`);
  });

  await test.step("the visitor finds it with its price", async () => {
    const catalog = await visitorCatalog(visitor);
    await expect(catalog.getByText(service.nameId)).toBeVisible();
    await expect(catalog).toContainText(/Rp\s90\.000/);
  });

  await test.step("admin changes the price; the visitor sees the new one on the next visit", async () => {
    await admin.goto(`/admin/services/edit?id=${service.id}`);
    await admin.getByLabel("Harga (Rp)").fill("95.000");
    await admin.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(admin).toHaveURL(`/admin/services?saved=${service.id}`);

    const catalog = await visitorCatalog(visitor);
    await expect(catalog).toContainText(/Rp\s95\.000/);
    await expect(catalog).not.toContainText(/Rp\s90\.000/);
  });

  await test.step("admin switches it off; the visitor no longer finds it", async () => {
    await admin.goto("/admin/services");
    const row = admin.getByRole("row").filter({ hasText: service.nameId });
    const toggle = row.getByRole("switch", { name: `Tampilkan ${service.nameId} di katalog pelanggan` });
    await toggle.click();
    // The switch flips at once; this announcement comes with the server's answer, after the change is
    // stored and the cache tag expired. Only then does the visitor look.
    await expect(row.getByRole("status")).toHaveText(`${service.nameId} tidak tampil lagi di katalog pelanggan.`);
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    const catalog = await visitorCatalog(visitor);
    await expect(catalog.getByRole("heading", { name: "Tidak ada layanan yang cocok" })).toBeVisible();
    await expect(catalog.getByText(service.nameId)).toHaveCount(0);
  });

  await adminContext.close();
  await visitorContext.close();
});
