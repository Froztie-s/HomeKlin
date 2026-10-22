import { expect, test, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { adminClient } from "../tests/integration/test-project";

// T5 on a phone (customers and cleaners are mobile-first): signing up, signing in, `next`, signing
// out, and the role check that refuses a signed-in user a section that is not theirs. Runs against
// the separate Supabase test project (playwright.config.ts). Every user here is made for this file
// with a unique address on example.com, and deleted again afterwards. Every test starts signed out.

type Role = "customer" | "cleaner" | "agency" | "admin";
type Account = { id: string; email: string; password: string; name: string };

const createdIds: string[] = [];
const signedUpEmails: string[] = [];

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

/** A user who signed up through the form, found by their unique address. */
async function userIdByEmail(email: string): Promise<string | undefined> {
  const admin = adminClient();
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list the test users: ${error.message}`);
    const user = data.users.find((candidate) => candidate.email === email);
    if (user) return user.id;
    if (data.users.length < 1000) return undefined;
  }
}

let customer: Account;
let cleaner: Account;

test.beforeAll(async () => {
  customer = await createAccount("customer", "Uji Pelanggan");
  cleaner = await createAccount("cleaner", "Uji Petugas");
});

test.afterAll(async () => {
  const admin = adminClient();
  for (const email of signedUpEmails) {
    const id = await userIdByEmail(email);
    if (id) createdIds.push(id);
  }
  for (const id of createdIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

async function fillLogin(page: Page, account: Account, password = account.password) {
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

test.describe("signing up", () => {
  test("creates a customer account through the form and lands on /home, signed in", async ({ page }) => {
    const email = `homeklin-e2e-signup-${randomUUID().slice(0, 8)}@example.com`;
    signedUpEmails.push(email);

    await page.goto("/signup");
    await expect(page.getByRole("heading", { level: 1, name: "Buat akun HomeKlin" })).toBeVisible();
    await page.getByLabel("Nama lengkap").fill("Uji Pelanggan Baru");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Kata sandi", { exact: true }).fill(randomBytes(18).toString("base64url"));
    await page.getByRole("button", { name: "Buat akun", exact: true }).click();

    await expect(page).toHaveURL("/home");
    await expect(page.getByRole("heading", { level: 1, name: "Pesan kebersihan rumah" })).toBeVisible();
    const chip = page.getByRole("banner").getByRole("link", { name: "Uji Pelanggan Baru, akun Anda" });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute("href", "/account");
    await expect(chip).toHaveText("UB");
    await expect(page.getByRole("banner").getByRole("link", { name: "Masuk", exact: true })).toHaveCount(0);
  });

  test("shows every problem next to its field and puts the cursor in the first one", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Buat akun", exact: true }).click();

    const name = page.getByLabel("Nama lengkap");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toHaveAccessibleDescription("Masukkan nama lengkap Anda.");
    await expect(name).toBeFocused();
    await expect(page.getByLabel("Email", { exact: true })).toHaveAccessibleDescription("Masukkan email Anda.");
    // The password keeps its rule as a hint and gets the problem after it.
    await expect(page.getByLabel("Kata sandi", { exact: true })).toHaveAccessibleDescription(
      "Minimal 8 karakter. Masukkan kata sandi Anda.",
    );
    await expect(page).toHaveURL("/signup");
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
    await expect(page).toHaveURL("/login");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(customer.email);
    await expect(page.getByLabel("Kata sandi", { exact: true })).toHaveValue("");
  });

  test("sends a visitor from /orders to sign in, then on to /orders", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login\?next=%2Forders$/);
    await expect(page.getByRole("heading", { level: 1, name: "Masuk ke HomeKlin" })).toBeVisible();
    // The way to sign up instead keeps the page the visitor wanted.
    await expect(page.getByRole("link", { name: "Daftar", exact: true })).toHaveAttribute(
      "href",
      "/signup?next=%2Forders",
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
    await page.goto("/signup?next=%2Forders");
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
