import { expect, test, type Page } from "@playwright/test";
import { createOwnerWorld, windowOffered, type OwnerWorld } from "./owner-test-data";
import { signInWithPassword } from "./order-test-data";
import { signedInAs } from "./setup/auth-state";

// T29b and T29c on a desk: the owner reads the business numbers (which include this spec's own paid
// jobs), adds a partner agency, suspends one (its window leaves free_slots) and reactivates it,
// creates an admin who can then sign in with the password the owner chose, and removes that admin
// again. Nobody else gets the owner pages: an admin and a customer are sent away with none of the
// numbers in the HTML. The spec makes its own agency and jobs (e2e/owner-test-data.ts) and removes
// everything at the end.

test.describe.configure({ mode: "serial", timeout: 120_000 });

let world: OwnerWorld;

test.beforeAll(async () => {
  world = await createOwnerWorld("t29b");
});

test.afterAll(async () => {
  await world?.cleanup();
});

const rupiah = (amount: number) => `Rp ${amount.toLocaleString("id-ID")}`;
const partnerRow = (page: Page, table: string, name: string) =>
  page.getByRole("table", { name: table }).getByRole("row").filter({ hasText: name });

test.describe("the owner", () => {
  test.use(signedInAs.owner);

  test("sees the business numbers, including this spec's paid jobs", async ({ page }) => {
    await page.goto("/owner");
    await expect(page.getByRole("heading", { level: 1, name: "Angka bisnis" })).toBeVisible();
    for (const label of ["Pendapatan", "Pesanan dibayar", "Pekerjaan selesai"]) {
      await expect(page.getByRole("group", { name: label })).toBeVisible();
    }
    await expect(page.getByRole("group", { name: "Pendapatan" })).toContainText(/Rp\s[\d.]+/);

    const row = partnerRow(page, "Kinerja mitra agensi", world.agency.name);
    await expect(row.getByRole("rowheader")).toHaveText(world.agency.name);
    await expect(row.getByRole("cell")).toHaveText(["Aktif", "2", "1", rupiah(world.revenueIdr)]);

    const byStatus = page.getByRole("region", { name: "Pesanan menurut status" });
    for (const status of ["Dibayar", "Menunggu pembayaran", "Gagal", "Dibatalkan"]) await expect(byStatus).toContainText(status);

    // The chart says what it shows in words, and its numbers are in a table too. Today's row counts
    // at least this spec's two orders (made a moment ago).
    const trend = page.getByRole("region", { name: "30 hari terakhir" });
    await expect(trend.getByRole("img")).toHaveAttribute("aria-label", /pesanan dalam 30 hari terakhir/);
    await trend.getByText("Tampilkan sebagai tabel").click();
    const days = trend.getByRole("table", { name: "Pesanan per hari" }).getByRole("row");
    await expect(days).toHaveCount(31);
    const today = Number((await days.last().getByRole("cell").first().textContent()) ?? "0");
    expect(today).toBeGreaterThanOrEqual(2);
  });

  test("adds a partner agency", async ({ page }) => {
    await page.goto("/owner/agencies");
    await expect(page.getByRole("heading", { level: 1, name: "Mitra agensi" })).toBeVisible();
    const form = page.getByRole("region", { name: "Tambah mitra" });
    await form.getByLabel("Nama mitra").fill(world.newPartnerName);
    await form.getByRole("group", { name: "Area yang dilayani" }).getByLabel("Jakarta Pusat").check();
    await form.getByRole("button", { name: "Tambah mitra" }).click();
    await expect(form.getByRole("status")).toContainText(`${world.newPartnerName} ditambahkan`);
    await expect(form.getByLabel("Nama mitra")).toHaveValue("");

    const row = partnerRow(page, "Daftar mitra agensi", world.newPartnerName);
    await expect(row).toContainText("Aktif");
    await expect(row).toContainText("Jakarta Pusat");
    await expect(row).toContainText("Belum ada");
  });

  test("refuses a partner without a name, and says why", async ({ page }) => {
    await page.goto("/owner/agencies");
    const form = page.getByRole("region", { name: "Tambah mitra" });
    await form.getByLabel("Nama mitra").fill("x");
    await form.getByRole("button", { name: "Tambah mitra" }).click();
    await expect(form.getByRole("alert")).toContainText("Nama mitra perlu 2 sampai 120 karakter.");
    await expect(form.getByLabel("Nama mitra")).toHaveValue("x");
  });

  test("suspends a partner, whose window then vanishes, and reactivates it", async ({ page }) => {
    expect(await windowOffered(world.window.startsAt)).toBe(true);
    await page.goto("/owner/agencies");
    const row = partnerRow(page, "Daftar mitra agensi", world.agency.name);
    await row.getByRole("button", { name: `Tangguhkan ${world.agency.name}` }).click();
    // The confirm step says what suspending does before anything happens.
    await expect(row).toContainText("tidak menerima pesanan baru");
    await expect(row).toContainText("Pekerjaan yang sudah dipesan tetap berjalan");
    await row.getByRole("button", { name: "Batal" }).click();
    await expect(row).toContainText("Aktif");
    expect(await windowOffered(world.window.startsAt)).toBe(true);

    await row.getByRole("button", { name: `Tangguhkan ${world.agency.name}` }).click();
    await row.getByRole("button", { name: "Ya, tangguhkan" }).click();
    await expect(row.getByText("Ditangguhkan", { exact: true })).toBeVisible();
    await expect.poll(() => windowOffered(world.window.startsAt)).toBe(false);

    await row.getByRole("button", { name: `Aktifkan lagi ${world.agency.name}` }).click();
    await expect(row).toContainText("kembali menerima pesanan baru");
    await row.getByRole("button", { name: "Ya, aktifkan" }).click();
    await expect(row.getByText("Aktif", { exact: true })).toBeVisible();
    await expect.poll(() => windowOffered(world.window.startsAt)).toBe(true);
  });

  test("creates an admin who can sign in with that password, then removes them", async ({ page, browser, baseURL }) => {
    const { fullName, email, password } = world.newAdmin;
    await page.goto("/owner/admins");
    await expect(page.getByRole("heading", { level: 1, name: "Akun admin" })).toBeVisible();
    const form = page.getByRole("region", { name: "Buat akun admin" });
    await expect(form).toContainText("secara pribadi");
    await form.getByLabel("Nama lengkap").fill(fullName);
    await form.getByLabel("Email").fill(email);
    const passwordField = form.getByLabel("Kata sandi awal", { exact: true });
    await passwordField.fill(password);
    await expect(passwordField).toHaveAttribute("type", "password");
    await form.getByRole("button", { name: "Tampilkan kata sandi" }).click();
    await expect(passwordField).toHaveAttribute("type", "text");
    await form.getByRole("button", { name: "Buat akun admin" }).click();
    await expect(form.getByRole("status")).toContainText(`Akun admin untuk ${email} dibuat`);
    const row = partnerRow(page, "Daftar akun admin", email);
    await expect(row).toContainText(fullName);

    // The new admin signs in with the owner's password and lands in the admin console.
    const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const adminPage = await context.newPage();
    await signInWithPassword(adminPage, { email, password });
    await expect(adminPage).toHaveURL("/admin");

    // The same email again is refused, with words.
    await form.getByLabel("Nama lengkap").fill(fullName);
    await form.getByLabel("Email").fill(email);
    await form.getByLabel("Kata sandi awal", { exact: true }).fill(password);
    await form.getByRole("button", { name: "Buat akun admin" }).click();
    await expect(form.getByRole("alert")).toContainText("Email ini sudah dipakai");

    await row.getByRole("button", { name: `Hapus admin ${fullName}` }).click();
    await expect(row).toContainText("tidak bisa lagi membuka konsol admin");
    await row.getByRole("button", { name: "Ya, hapus" }).click();
    await expect(partnerRow(page, "Daftar akun admin", email)).toHaveCount(0);

    // Without the role the admin console sends them away.
    await adminPage.goto("/admin");
    await expect(adminPage).not.toHaveURL("/admin");
    await context.close();
  });

  test("works in English", async ({ page }) => {
    await page.goto("/en/owner");
    await expect(page.getByRole("heading", { level: 1, name: "Business numbers" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Revenue" })).toBeVisible();
    await expect(partnerRow(page, "Partner agency performance", world.agency.name)).toContainText("Active");
    await expect(page.getByRole("navigation", { name: "Owner navigation" }).getByRole("link", { name: "Partner agencies" })).toHaveAttribute(
      "href",
      "/en/owner/agencies",
    );

    await page.goto("/en/owner/agencies");
    await expect(page.getByRole("heading", { level: 1, name: "Partner agencies" })).toBeVisible();
    const row = partnerRow(page, "Partner agency list", world.agency.name);
    await expect(row).toContainText("Central Jakarta");
    await expect(row.getByRole("button", { name: `Suspend ${world.agency.name}` })).toBeVisible();
    await expect(page.getByRole("region", { name: "Add a partner" })).toBeVisible();

    await page.goto("/en/owner/admins");
    await expect(page.getByRole("heading", { level: 1, name: "Admin accounts" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Create an admin account" })).toContainText("privately");
  });
});

for (const role of ["admin", "customer"] as const) {
  test.describe(`a signed-in ${role}`, () => {
    test.use(signedInAs[role]);

    test("is sent away from the owner pages, with none of the numbers in the HTML", async ({ page }) => {
      for (const path of ["/owner", "/owner/agencies", "/owner/admins"]) {
        const html = await (await page.request.get(path)).text();
        for (const secret of [world.agency.name, "Kinerja mitra agensi", "Pesanan dibayar", "Daftar mitra agensi", "Daftar akun admin"]) {
          expect(html, `${path}: ${secret}`).not.toContain(secret);
        }
        await page.goto(path);
        await expect(page).not.toHaveURL(new RegExp(`${path}$`));
        await expect(page.getByText(world.agency.name)).toHaveCount(0);
      }
    });
  });
}
