import { expect, test, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { adminClient } from "../tests/integration/test-project";

// T5 on a phone (customers and cleaners are mobile-first): signing in, `next`, signing out, and the
// role check that refuses a signed-in user a section that is not theirs. Since T9b there is no separate
// sign-up (the account is made by ordering, e2e/order.mobile.spec.ts) and customers sign in by emailed
// code; these accounts have a password, which "Masuk dengan kata sandi" still accepts. Runs against
// the separate Supabase test project (playwright.config.ts). Every user here is made for this file
// with a unique address on example.com, and deleted again afterwards. Every test starts signed out.

type Role = "customer" | "cleaner" | "agency" | "admin";
type Account = { id: string; email: string; password: string; name: string };

const createdIds: string[] = [];

/** A confirmed user with a fictional name and the given role (set the way only the service role can). */
async function createAccount(role: Role, name: string): Promise<Account> {
  const email = `homeklin-e2e-${role}-${randomUUID().slice(0, 8)}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !data.user) throw new Error(`Could not create the ${role} test user: ${error?.message}`);
  createdIds.push(data.user.id);
  if (role !== "customer") {
    const update = await admin.from("profiles").update({ role }).eq("id", data.user.id);
    if (update.error) throw new Error(`Could not make the test user a ${role}: ${update.error.message}`);
  }
  return { id: data.user.id, email, password, name };
}

let customer: Account;
let cleaner: Account;

test.beforeAll(async () => {
  customer = await createAccount("customer", "Uji Pelanggan");
  cleaner = await createAccount("cleaner", "Uji Petugas");
});

test.afterAll(async () => {
  const admin = adminClient();
  for (const id of createdIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

/** On /login: "Masuk dengan kata sandi", then the email and password. */
async function fillLogin(page: Page, account: Account, password = account.password) {
  const withPassword = page.getByRole("link", { name: "Masuk dengan kata sandi" });
  const passwordField = page.getByLabel("Kata sandi", { exact: true });
  // The form streams in after the page shell; wait for it, then switch to the password if needed.
  await expect(withPassword.or(passwordField)).toBeVisible();
  if (await withPassword.isVisible()) await withPassword.click();
  await expect(passwordField).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

test.describe("no separate sign-up", () => {
  test("the old sign-up address leads to the order page, and /login offers ordering instead", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveURL("/pesan");
    await expect(page.getByRole("heading", { level: 1, name: "Pesan layanan" })).toBeVisible();

    await page.goto("/login");
    await expect(page.getByRole("link", { name: "Daftar", exact: true })).toHaveCount(0);
    await expect(page.getByText("Belum pernah memesan?")).toBeVisible();
    await expect(page.getByRole("link", { name: "Pesan layanan" })).toHaveAttribute("href", "/services");
  });
});

test.describe("signing in", () => {
  test("says the email or password is wrong, stays on /login and keeps the email", async ({ page }) => {
    await page.goto("/login");
    await fillLogin(page, customer, "not-the-password");

    // The form's live region (main also leaves out Next.js's own route announcer, which is an alert too).
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Email atau kata sandi salah. Periksa lagi, lalu coba masuk kembali.",
    );
    await expect(page).toHaveURL("/login?cara=sandi");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(customer.email);
    await expect(page.getByLabel("Kata sandi", { exact: true })).toHaveValue("");
  });

  test("sends a visitor from /orders to sign in, then on to /orders", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login\?next=%2Forders$/);
    await expect(page.getByRole("heading", { level: 1, name: "Masuk ke HomeKlin" })).toBeVisible();
    // Customers get a code; the password way keeps the page the visitor wanted.
    await expect(page.getByRole("button", { name: "Kirim kode" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Masuk dengan kata sandi" })).toHaveAttribute(
      "href",
      "/login?next=%2Forders&cara=sandi",
    );

    await fillLogin(page, customer);
    await expect(page).toHaveURL("/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Pesanan" })).toBeVisible();
    await expect(page.getByText("Belum ada pesanan")).toBeVisible();
  });

  test("takes a customer to /home and refuses them the admin and cleaner sections", async ({ page }) => {
    await page.goto("/login");
    await fillLogin(page, customer);
    await expect(page).toHaveURL("/home");
    await expect(page.getByRole("banner").getByRole("link", { name: "Uji Pelanggan, akun Anda" })).toBeVisible();

    // A sub-page of the admin section: the customer ends up on their own home, and the page they asked
    // for never reaches the browser, not even in the HTML that comes before the redirect.
    const html = await (await page.request.get("/admin/tickets")).text();
    expect(html).not.toContain("Pertanyaan pelanggan yang diteruskan");
    await page.goto("/admin/tickets");
    await expect(page).toHaveURL("/home");
    await expect(page.getByRole("heading", { level: 1, name: "Pesan kebersihan rumah" })).toBeVisible();

    await page.goto("/cleaner");
    await expect(page).toHaveURL("/home");
    await expect(page.getByText("Belum ada pekerjaan hari ini")).toHaveCount(0);

    // Signed in already: the sign-in pages send the customer on, to `next` when they may open it.
    await page.goto("/login");
    await expect(page).toHaveURL("/home");
    await page.goto("/login?next=%2Forders&cara=sandi");
    await expect(page).toHaveURL("/orders");
  });

  test("takes a cleaner to /cleaner and refuses them the customer's orders", async ({ page }) => {
    await page.goto("/login");
    await fillLogin(page, cleaner);
    await expect(page).toHaveURL("/cleaner");
    await expect(page.getByRole("heading", { level: 1, name: "Pekerjaan hari ini" })).toBeVisible();
    await expect(page.getByText("Belum ada pekerjaan hari ini")).toBeVisible();

    await page.goto("/orders");
    await expect(page).toHaveURL("/cleaner");
    await expect(page.getByText("Belum ada pesanan")).toHaveCount(0);

    // The cleaner's account tab shows who is signed in and the way out.
    await page.getByRole("navigation", { name: "Navigasi petugas" }).getByRole("link", { name: "Akun" }).click();
    await expect(page).toHaveURL("/cleaner/account");
    await expect(page.getByRole("main").getByText("Uji Petugas", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Keluar" })).toBeVisible();
  });
});

test.describe("signing out", () => {
  test("returns to the landing page, after which /orders needs a sign-in again", async ({ page }) => {
    await page.goto("/login");
    await fillLogin(page, customer);
    await expect(page).toHaveURL("/home");

    await page.getByRole("banner").getByRole("link", { name: "Uji Pelanggan, akun Anda" }).click();
    await expect(page).toHaveURL("/account");
    await expect(page.getByRole("main").getByText("Uji Pelanggan", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Keluar" }).click();

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Jasa kebersihan rumah yang bisa Anda tonton langsung" }),
    ).toBeVisible();
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login\?next=%2Forders$/);
    await page.goto("/home");
    await expect(page.getByRole("banner").getByRole("link", { name: "Masuk", exact: true })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});

test.describe("in English", () => {
  test("signs in from /en/login, with English messages, and stays in English", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.getByRole("heading", { level: 1, name: "Log in to HomeKlin" })).toBeVisible();
    await page.getByRole("link", { name: "Log in with a password" }).click();
    await expect(page).toHaveURL("/en/login?cara=sandi");
    await page.getByLabel("Email", { exact: true }).fill(customer.email);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "The email or password is not correct. Check them and try again.",
    );

    await page.getByLabel("Password", { exact: true }).fill(customer.password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL("/en/home");
    await expect(page.getByRole("heading", { level: 1, name: "Book a home cleaning" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Uji Pelanggan, your account" })).toHaveAttribute(
      "href",
      "/en/account",
    );
  });
});
