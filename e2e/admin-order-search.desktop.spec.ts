import { expect, test, type Page } from "@playwright/test";
import { createJobWorld, jobService, seededAgencyId, type JobWorld } from "./job-test-data";
import { signedInAs } from "./setup/auth-state";

// Audit item 1: admin finds an order by its number from any admin page. The field sits in the dark
// sidebar under the role card; it reads "hk 1170" or "1170" as "HK-1170" and goes to the order's page,
// and an input that cannot be an order number shows an error under the field without leaving the page.
// The number used in the first tests is far beyond the sequence, so the order page answers with its
// not-found state; "an order that exists" below makes a real order and finds it by its number.
// The shell draws the search twice (sidebar from 1024 px, menu below) and shows one copy at a time, so on a
// desk the sidebar's is the only one in the page. The search form is named by the same label as its
// input, so the input is found by its role (getByLabel would match the form too).

test.use(signedInAs.admin);

const missing = "HK-9999999";

test("goes to the order's page from any admin page, whatever way the number is written", async ({ page }) => {
  await page.goto("/admin/services");
  await expect(page.getByRole("search", { name: "Cari nomor pesanan" })).toHaveCount(1);
  const search = page.getByRole("complementary").getByRole("search", { name: "Cari nomor pesanan" });
  await search.getByLabel("Cari nomor pesanan").fill("  hk 9999999 ");
  await search.getByRole("button", { name: "Cari" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/orders/${missing}$`));
  // The title in the page's heading for assistive technology (it is hidden visually), and the message the
  // admin reads under it.
  await expect(page.getByRole("heading", { level: 1, name: "Pesanan tidak ditemukan" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Pesanan tidak ditemukan" })).toBeVisible();

  // The field starts empty on the next page; a bare number works too, and Enter sends it.
  const field = page.getByRole("complementary").getByRole("textbox", { name: "Cari nomor pesanan" });
  await expect(field).toHaveValue("");
  await field.fill("9999998");
  await field.press("Enter");
  await expect(page).toHaveURL(/\/admin\/orders\/HK-9999998$/);
});

test("shows an error under the field and stays on the page for an input that is not an order number", async ({ page }) => {
  await page.goto("/admin/faq");
  const search = page.getByRole("complementary").getByRole("search", { name: "Cari nomor pesanan" });
  const field = search.getByLabel("Cari nomor pesanan");
  await field.fill("HK-12");
  await field.press("Enter");
  await expect(search.getByRole("alert")).toContainText("Itu bukan nomor pesanan. Tulis seperti HK-1170 atau 1170.");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveValue("HK-12");
  await expect(page).toHaveURL(/\/admin\/faq$/);
});

test("works in English, keeping the language", async ({ page }) => {
  await page.goto("/en/admin/monitor");
  const field = page.getByRole("complementary").getByRole("textbox", { name: "Find an order number" });
  await field.fill("1170x");
  await field.press("Enter");
  await expect(page.getByRole("complementary").getByRole("alert")).toContainText("That is not an order number.");
  await field.fill("hk-9999999");
  await field.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/en/admin/orders/${missing}$`));
});

test.describe("an order that exists", () => {
  // A real paid order (written the way the job specs write theirs, e2e/job-test-data.ts), found by the
  // number the admin types. The two ways of typing share one order, so they run in one worker, in order.
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  let world: JobWorld;
  let code: string;

  test.beforeAll(async () => {
    test.setTimeout(120_000);
    world = await createJobWorld("adms");
    const agencyId = await seededAgencyId();
    const cleaner = await world.cleaner(agencyId, "Uji Petugas Cari");
    const job = await world.job({ agencyId, cleaner, startsIn: 90, address: "Jl. Uji Cari No. 21, Cakung, Jakarta Timur" });
    code = job.code;
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    await world?.cleanup();
  });

  /** Types `typed` in the sidebar's search, from an admin page that is not the order's, and sends it. */
  async function search(page: Page, typed: string) {
    await page.goto("/admin/services");
    const form = page.getByRole("complementary").getByRole("search", { name: "Cari nomor pesanan" });
    const field = form.getByLabel("Cari nomor pesanan");
    await expect(field).toBeVisible();
    await field.fill(typed);
    await form.getByRole("button", { name: "Cari" }).click();
  }

  /** The order's own page: its service as the title, its number under it, and no not-found message. */
  async function expectOrderPage(page: Page) {
    await expect(page).toHaveURL(new RegExp(`/admin/orders/${code}$`), { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: jobService.name })).toBeVisible();
    await expect(page.getByText(new RegExp(`^Pesanan ${code}, `))).toBeVisible();
    await expect(page.getByRole("region", { name: "Detail pesanan", exact: true })).toContainText("Jl. Uji Cari No. 21");
    await expect(page.getByText("Pesanan tidak ditemukan")).toHaveCount(0);
  }

  test("finds it by its number written in lower case, like hk-1042", async ({ page }) => {
    expect(code).toMatch(/^HK-\d{4,}$/);
    await search(page, code.toLowerCase());
    await expectOrderPage(page);
  });

  test("finds it by the digits of its number alone", async ({ page }) => {
    await search(page, code.slice("HK-".length));
    await expectOrderPage(page);
  });
});
