import { expect, test, type Page } from "@playwright/test";
import { createOwnerWorld, windowOffered, type OwnerWorld } from "./owner-test-data";
import { signInWithPassword } from "./order-test-data";
import { signedInAs } from "./setup/auth-state";

// T29b and T29c on a desk, in the D3 redesign (the owner mocks): the owner reads the overview (which
// includes this spec's own paid jobs), adds a partner agency on its own page, suspends one (its window
// leaves free_slots) and reactivates it, creates an admin on its own page who can then sign in with the
// password the owner chose, and removes that admin again. Nobody else gets the owner pages: an admin and a customer are sent away with none of the
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

const partnerRow = (page: Page, name: string) =>
  page.getByRole("table", { name: "Daftar mitra agensi" }).getByRole("row").filter({ hasText: name });
const adminRow = (page: Page, email: string) => page.locator(`[data-admin="${email}"]`);

test.describe("the owner", () => {
  test.use(signedInAs.owner);

  test("sees the overview for 30, 7 or 90 days: key numbers against the period before, daily revenue, payouts and orders by status", async ({ page }) => {
    await page.goto("/owner");
    await expect(page.getByRole("heading", { level: 1, name: "Ringkasan" })).toBeVisible();
    const stats = page.getByRole("list", { name: "Angka utama, 30 hari terakhir" }).getByRole("listitem");
    await expect(stats).toHaveCount(4);
    await expect(stats.nth(0)).toContainText("Pendapatan");
    await expect(stats.nth(0)).toContainText(/Rp\s[\d.]+/);
    // The growth is said in words: up, down, the same, or nothing to compare with.
    await expect(stats.nth(0)).toContainText(/(naik|turun) \d+% dari 30 hari sebelumnya|sama dengan 30 hari sebelumnya|belum ada pembanding/);
    await expect(stats.nth(1)).toContainText("pesanan dibayar");
    await expect(stats.nth(2)).toContainText("Rata-rata nilai pesanan");
    await expect(stats.nth(3)).toContainText("Dibayarkan ke agensi mitra");
    await expect(stats.nth(3)).toContainText("Sisa untuk HomeKlin Rp");

    // The bars cover the chosen period (2026-11-20), say what they show in words, and every day is in
    // a table. Today's revenue counts at least this spec's two paid jobs (made a moment ago).
    const daily = page.getByRole("region", { name: "Pendapatan harian" });
    await expect(daily.locator("[data-day]")).toHaveCount(30);
    await expect(daily.locator("p.sr-only")).toContainText(/Pendapatan 30 hari terakhir|Belum ada pendapatan/);
    await daily.getByText("Lihat angka per hari").click();
    const days = daily.getByRole("table", { name: "Pendapatan per hari, 30 hari terakhir" }).getByRole("row");
    await expect(days).toHaveCount(31);
    const today = Number(((await days.last().getByRole("cell").nth(1).textContent()) ?? "0").replace(/\D/g, ""));
    expect(today).toBeGreaterThanOrEqual(world.revenueIdr);

    const byStatus = page.getByRole("region", { name: "Pesanan menurut status" });
    for (const status of ["Dibayar", "Menunggu pembayaran", "Gagal", "Dibatalkan"]) await expect(byStatus).toContainText(status);
    await expect(byStatus).toContainText("Pesanan dalam 30 hari terakhir");
    await expect(page.getByRole("region", { name: "Pembayaran per agensi" })).toContainText("30 hari terakhir, total Rp");

    // The range is a link: 7 days, then 90, each with its own numbers and the period before it.
    const range = page.getByRole("navigation", { name: "Rentang waktu" });
    await expect(range.getByRole("link", { name: "30 hari" })).toHaveAttribute("aria-current", "true");
    await range.getByRole("link", { name: "7 hari" }).click();
    await expect(page).toHaveURL("/owner?days=7");
    await expect(page.getByRole("list", { name: "Angka utama, 7 hari terakhir" })).toContainText(/7 hari sebelumnya/);
    await expect(page.getByRole("region", { name: "Pembayaran per agensi" })).toContainText("7 hari terakhir");
    await expect(page.getByRole("region", { name: "Pendapatan harian" }).locator("[data-day]")).toHaveCount(7);
    await expect(page.getByRole("region", { name: "Pesanan menurut status" })).toContainText("7 hari terakhir");
    await page.getByRole("navigation", { name: "Rentang waktu" }).getByRole("link", { name: "90 hari" }).click();
    await expect(page).toHaveURL("/owner?days=90");
    await expect(page.getByRole("list", { name: "Angka utama, 90 hari terakhir" })).toBeVisible();
    // 90 days are 13 weekly bars, the weeks in their own table.
    const weekly = page.getByRole("region", { name: "Pendapatan mingguan" });
    await expect(weekly.locator("[data-day]")).toHaveCount(13);
    await weekly.getByText("Lihat angka per minggu").click();
    await expect(weekly.getByRole("table", { name: "Pendapatan per minggu, 90 hari terakhir" }).getByRole("row")).toHaveCount(14);

    await page.getByRole("region", { name: "Pembayaran per agensi" }).getByRole("link", { name: "Lihat semua mitra" }).click();
    await expect(page).toHaveURL("/owner/agencies");
  });

  test("lists each partner with its numbers, and opens the add page", async ({ page }) => {
    await page.goto("/owner/agencies");
    await expect(page.getByRole("heading", { level: 1, name: "Mitra agensi" })).toBeVisible();
    const row = partnerRow(page, world.agency.name);
    await expect(row).toContainText("Aktif");
    await expect(row).toContainText("Jakarta Pusat");
    // The last 30 days: this spec's one finished job, no cancelled order, no fee paid out yet (the
    // jobs were written straight into the table, so check-out made no fee).
    await expect(page.getByRole("region", { name: "Daftar mitra" })).toContainText("Angka untuk 30 hari terakhir");
    const cells = row.getByRole("cell");
    await expect(cells.nth(2)).toHaveText("1");
    await expect(cells.nth(3)).toHaveText(/^(\d+%|Belum ada)$/);
    await expect(cells.nth(4)).toHaveText("0");
    await expect(cells.nth(5)).toHaveText("Rp 0");

    await page.getByRole("link", { name: "Tambah mitra" }).click();
    await expect(page).toHaveURL("/owner/agencies/new");
    await expect(page.getByRole("heading", { level: 1, name: "Tambah mitra agensi" })).toBeVisible();
    await page.getByRole("link", { name: "Kembali ke mitra agensi" }).click();
    await expect(page).toHaveURL("/owner/agencies");
  });

  test("adds a partner agency on its own page", async ({ page }) => {
    await page.goto("/owner/agencies/new");
    const form = page.getByRole("form", { name: "Tambah mitra" });
    await form.getByLabel("Nama mitra").fill(world.newPartnerName);
    await form.getByRole("group", { name: "Area yang dilayani" }).getByLabel("Jakarta Pusat").check();
    await form.getByRole("button", { name: "Tambah mitra" }).click();
    await expect(form.getByRole("status")).toContainText(`${world.newPartnerName} ditambahkan`);
    await expect(form.getByLabel("Nama mitra")).toHaveValue("");

    await form.getByRole("link", { name: "Lihat daftar mitra" }).click();
    await expect(page).toHaveURL("/owner/agencies");
    const row = partnerRow(page, world.newPartnerName);
    await expect(row).toContainText("Aktif");
    await expect(row).toContainText("Jakarta Pusat");
    await expect(row).toContainText("Belum ada");
  });

  test("refuses a partner without a name, and says why", async ({ page }) => {
    await page.goto("/owner/agencies/new");
    const form = page.getByRole("form", { name: "Tambah mitra" });
    await form.getByLabel("Nama mitra").fill("x");
    await form.getByRole("button", { name: "Tambah mitra" }).click();
    await expect(form.getByRole("alert")).toContainText("Nama mitra perlu 2 sampai 120 karakter.");
    await expect(form.getByLabel("Nama mitra")).toHaveValue("x");
  });

  test("suspends a partner, whose window then vanishes, and reactivates it", async ({ page }) => {
    expect(await windowOffered(world.window.startsAt)).toBe(true);
    await page.goto("/owner/agencies");
    const row = partnerRow(page, world.agency.name);
    // Audit item 5: a quiet text button, no fill and no outline until hovered, still a 44 px target.
    const suspend = row.getByRole("button", { name: `Tangguhkan ${world.agency.name}` });
    await expect(suspend).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(suspend).toHaveCSS("border-top-width", "0px");
    expect((await suspend.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await suspend.click();
    // The confirm step says what suspending does before anything happens, in a dialog over the page,
    // so the table never grows past the screen (2026-11-20, UX audit).
    const question = row.getByRole("form", { name: `Tangguhkan ${world.agency.name}?` });
    await expect(page.getByRole("dialog", { name: `Tangguhkan ${world.agency.name}?` })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await expect(question).toContainText("tidak menerima pesanan baru");
    await expect(question).toContainText("Pekerjaan yang sudah dipesan tetap berjalan");
    await question.getByRole("button", { name: "Batal" }).click();
    await expect(row.getByText("Aktif", { exact: true }).filter({ visible: true })).toBeVisible();
    expect(await windowOffered(world.window.startsAt)).toBe(true);

    await row.getByRole("button", { name: `Tangguhkan ${world.agency.name}` }).click();
    await row.getByRole("button", { name: "Ya, tangguhkan" }).click();
    await expect(row.getByText("Ditangguhkan", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect.poll(() => windowOffered(world.window.startsAt)).toBe(false);

    await row.getByRole("button", { name: `Aktifkan lagi ${world.agency.name}` }).click();
    await expect(row).toContainText("kembali menerima pesanan baru");
    await row.getByRole("button", { name: "Ya, aktifkan" }).click();
    await expect(row.getByText("Aktif", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect.poll(() => windowOffered(world.window.startsAt)).toBe(true);
  });

  test("creates an admin who can sign in with that password, then removes them", async ({ page, browser, baseURL }) => {
    const { fullName, email, password } = world.newAdmin;
    await page.goto("/owner/admins");
    await expect(page.getByRole("heading", { level: 1, name: "Akun admin" })).toBeVisible();
    await page.getByRole("link", { name: "Tambah akun admin" }).click();
    await expect(page).toHaveURL("/owner/admins/new");
    await expect(page.getByRole("heading", { level: 1, name: "Buat akun admin" })).toBeVisible();

    const form = page.getByRole("form", { name: "Buat akun admin" });
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

    // The new admin signs in with the owner's password and lands in the admin console.
    const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const adminPage = await context.newPage();
    await signInWithPassword(adminPage, { email, password });
    await expect(adminPage).toHaveURL("/admin/monitor");

    // The same email again is refused, with words.
    await form.getByLabel("Nama lengkap").fill(fullName);
    await form.getByLabel("Email").fill(email);
    await form.getByLabel("Kata sandi awal", { exact: true }).fill(password);
    await form.getByRole("button", { name: "Buat akun admin" }).click();
    await expect(form.getByRole("alert")).toContainText("Email ini sudah dipakai");

    await form.getByRole("link", { name: "Batal" }).click();
    await expect(page).toHaveURL("/owner/admins");
    const row = adminRow(page, email);
    await expect(row).toContainText(fullName);
    // They signed in a moment ago: the row says when, and that the account is in use.
    await expect(row).toContainText("Hari ini");
    // The pill is drawn twice (one below 1024 px, one above); only one is ever shown.
    await expect(row.getByText("Aktif", { exact: true }).filter({ visible: true })).toBeVisible();
    // The row opens to the account and the way to remove it, which asks first.
    await expect(row.locator("summary")).toContainText(`Detail akun ${fullName}`);
    await row.locator("summary").click();
    await expect(row).toContainText("Hak akses");
    await row.getByRole("button", { name: `Hapus admin ${fullName}` }).click();
    await expect(row).toContainText("tidak bisa lagi membuka konsol admin");
    await row.getByRole("button", { name: "Ya, hapus" }).click();
    await expect(adminRow(page, email)).toHaveCount(0);

    // Without the role the admin console sends them away.
    await adminPage.goto("/admin/monitor");
    await expect(adminPage).not.toHaveURL("/admin/monitor");
    await context.close();
  });

  test("works in English", async ({ page }) => {
    await page.goto("/en/owner");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Key numbers, last 30 days" })).toContainText("Revenue");
    await expect(page.getByRole("navigation", { name: "Time range" }).getByRole("link", { name: "7 days" })).toHaveAttribute("href", "/en/owner?days=7");
    await expect(page.getByRole("region", { name: "Payouts per agency" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Owner navigation" }).getByRole("link", { name: "Partner agencies" })).toHaveAttribute(
      "href",
      "/en/owner/agencies",
    );

    await page.goto("/en/owner/agencies");
    await expect(page.getByRole("heading", { level: 1, name: "Partner agencies" })).toBeVisible();
    const row = page.getByRole("table", { name: "Partner agency list" }).getByRole("row").filter({ hasText: world.agency.name });
    await expect(row).toContainText("Central Jakarta");
    await expect(row.getByRole("button", { name: `Suspend ${world.agency.name}` })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add a partner" })).toHaveAttribute("href", "/en/owner/agencies/new");

    await page.goto("/en/owner/agencies/new");
    await expect(page.getByRole("heading", { level: 1, name: "Add a partner agency" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Add partner" })).toBeVisible();

    await page.goto("/en/owner/admins");
    await expect(page.getByRole("heading", { level: 1, name: "Admin accounts" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add an admin account" })).toHaveAttribute("href", "/en/owner/admins/new");

    await page.goto("/en/owner/admins/new");
    await expect(page.getByRole("form", { name: "Create admin account" })).toContainText("privately");
  });
});

for (const role of ["admin", "customer"] as const) {
  test.describe(`a signed-in ${role}`, () => {
    test.use(signedInAs[role]);

    test("is sent away from the owner pages, with none of the numbers in the HTML", async ({ page }) => {
      for (const path of ["/owner", "/owner/agencies", "/owner/agencies/new", "/owner/admins", "/owner/admins/new"]) {
        const html = await (await page.request.get(path)).text();
        for (const secret of [world.agency.name, "Pembayaran per agensi", "Pesanan menurut status", "Daftar mitra agensi", "Daftar akun admin", "Area yang dilayani", "Kata sandi awal"]) {
          expect(html, `${path}: ${secret}`).not.toContain(secret);
        }
        await page.goto(path);
        await expect(page).not.toHaveURL(new RegExp(`${path}$`));
        await expect(page.getByText(world.agency.name)).toHaveCount(0);
      }
    });
  });
}
