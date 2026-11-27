import { expect, test, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { adminClient } from "../tests/integration/test-project";
import { codeFor } from "./setup/email-code";

// T5 on a phone (customers and cleaners are mobile-first): signing in, `next`, signing out, and the
// role check that refuses a signed-in user a section that is not theirs. Since T9b there is no separate
// sign-up (the account is made by ordering, e2e/order.mobile.spec.ts) and customers sign in by emailed
// code; these accounts have a password, which the "Kata sandi" tab still accepts. Runs against
// the separate Supabase test project (playwright.config.ts). Every user here is made for this file
// with a unique address on example.com, and deleted again afterwards. Every test starts signed out.
// The emailed code is the customers' main way in ("signing in by code" below): the test project's
// emails go nowhere (Ethereal), so codeFor() asks the admin API for a fresh code right after the app
// sent one. A code sign-in replaces the account's password with a random one (claimCustomerAccount), so
// the code tests each use an account of their own and the password tests never meet it.

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

/** On /login: the "Kata sandi" tab, then the email and password. */
async function fillLogin(page: Page, account: Account, password = account.password) {
  const withPassword = page.getByRole("link", { name: /^Kata sandi/ });
  const passwordField = page.getByLabel("Kata sandi", { exact: true });
  // The form streams in after the page shell; wait for it, then switch to the password if needed.
  await expect(withPassword.or(passwordField)).toBeVisible();
  if (await withPassword.isVisible()) await withPassword.click();
  await expect(passwordField).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

// Sending an email (the code) can take the test project several seconds.
const emailWait = 20_000;

/**
 * On /login (the "Kode email" way, which opens first): the email, then "Kirim kode", then the code step.
 * Returns once the page says the code was sent (it says so whether or not the email has an account).
 */
async function askForCode(page: Page, email: string) {
  const send = page.getByRole("button", { name: "Kirim kode" });
  await expect(send).toBeVisible();
  // Once React has taken over the form, so the press runs its handler instead of posting the page.
  await send.evaluate(
    (button) =>
      new Promise<void>((resolve) => {
        const ready = () => (Object.keys(button).some((key) => key.startsWith("__reactFiber")) ? resolve() : requestAnimationFrame(ready));
        ready();
      }),
  );
  await page.getByLabel("Email", { exact: true }).fill(email);
  await send.click();
  await expect(page.getByText(`Jika ${email} terdaftar di HomeKlin, kami sudah mengirim kode 6 angka`)).toBeVisible({ timeout: emailWait });
  await expect(page.getByLabel("Kode 6 angka")).toBeVisible();
}

/** Types the code on the code step and presses "Masuk". */
async function enterCode(page: Page, code: string) {
  await page.getByLabel("Kode 6 angka").fill(code);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

test.describe("signing in by code", () => {
  // The customers' main way in (SPEC: customers sign in by emailed code). Each test makes its own
  // customer, because the code check replaces the account's password.
  test("sends a code, and the right code signs the customer in on /home", async ({ page }) => {
    const account = await createAccount("customer", "Uji Pelanggan Kode");
    await page.goto("/login");
    await askForCode(page, account.email);
    // The code step names the address the code went to, and leaves the way back to the email.
    await expect(page.getByRole("heading", { level: 2, name: "Masukkan kode dari email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ganti email" })).toBeVisible();

    await enterCode(page, await codeFor(account.email));
    await expect(page).toHaveURL("/home", { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Pesanan Anda" })).toBeVisible();
    // Signed in: the account menu names the customer, and a page that needs a sign-in opens.
    await page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("button", { name: "Akun" }).click();
    await expect(page.getByRole("menu").getByText("Uji Pelanggan Kode", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/orders");
    await expect(page).toHaveURL("/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Riwayat pesanan", exact: true })).toBeVisible();
  });

  test("goes on to the page named by ?next= after the right code", async ({ page }) => {
    const account = await createAccount("customer", "Uji Pelanggan Lanjut");
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login\?next=%2Forders$/);
    await askForCode(page, account.email);

    await enterCode(page, await codeFor(account.email));
    await expect(page).toHaveURL("/orders", { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Riwayat pesanan", exact: true })).toBeVisible();
    await expect(page.getByText("Belum ada riwayat pesanan")).toBeVisible();
  });

  test("a wrong code stays on the code step with the error, and the right code still works", async ({ page }) => {
    const account = await createAccount("customer", "Uji Pelanggan Salah");
    await page.goto("/login");
    await askForCode(page, account.email);

    const code = await codeFor(account.email);
    // Never the real code, whatever it is.
    const wrong = code === "000000" ? "111111" : "000000";
    await enterCode(page, wrong);
    await expect(page.getByText("Kode salah atau sudah tidak berlaku.", { exact: false })).toBeVisible();
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { level: 2, name: "Masukkan kode dari email" })).toBeVisible();
    await expect(page.getByLabel("Kode 6 angka")).toHaveAttribute("aria-invalid", "true");
    // Still signed out: no session cookie was set (sb-<project>-auth-token, or its .0, .1 pieces; the
    // "-code-verifier" cookies are the sign-in's own bookkeeping, not a session).
    const sessionCookies = (await page.context().cookies()).filter((cookie) => /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name));
    expect(sessionCookies).toEqual([]);

    // A wrong guess does not spoil the code that was asked for: the right one, on the same step, signs in.
    await enterCode(page, code);
    await expect(page).toHaveURL("/home", { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Pesanan Anda" })).toBeVisible();
  });
});

test.describe("signing up", () => {
  // 2026-11-20 (the user): ordering needs an account, so /login offers "Daftar" and /signup is back.
  test("/login offers Daftar, and /signup is the sign-up form with the way back", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Belum punya akun?")).toBeVisible();
    await expect(page.getByRole("link", { name: "Daftar", exact: true })).toHaveAttribute("href", "/signup");
    await expect(page.getByRole("link", { name: "Pesan layanan" })).toHaveCount(0);
    // The two ways in are named by how one signs in, never "demo".
    const ways = page.getByRole("navigation", { name: "Cara masuk" });
    await expect(ways.getByRole("link")).toHaveText([/^Kode email/, /^Kata sandi/]);
    await expect(page.getByText(/demo/i)).toHaveCount(0);

    await page.getByRole("link", { name: "Daftar", exact: true }).click();
    await expect(page).toHaveURL("/signup");
    await expect(page.getByRole("heading", { level: 1, name: "Daftar" })).toBeVisible();
    await expect(page.getByLabel("Nama lengkap")).toBeVisible();
    await expect(page.getByLabel("Kata sandi", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Buat akun" }).click();
    await expect(page.getByText("Masukkan nama lengkap Anda.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Masuk", exact: true })).toHaveAttribute("href", "/login");
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
    await expect(page.getByRole("heading", { level: 1, name: "Masuk", exact: true })).toBeVisible();
    // Customers get a code; the password way keeps the page the visitor wanted.
    await expect(page.getByRole("button", { name: "Kirim kode" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Kata sandi/ })).toHaveAttribute(
      "href",
      "/login?next=%2Forders&cara=sandi",
    );

    await fillLogin(page, customer);
    await expect(page).toHaveURL("/orders");
    // /orders is "Riwayat pesanan" since 2026-11-20 (the orders still to come are on /home); a new
    // customer has no history yet.
    await expect(page.getByRole("heading", { level: 1, name: "Riwayat pesanan", exact: true })).toBeVisible();
    await expect(page.getByText("Belum ada riwayat pesanan")).toBeVisible();
  });

  test("takes a customer to /home and refuses them the admin and cleaner sections", async ({ page }) => {
    await page.goto("/login");
    await fillLogin(page, customer);
    await expect(page).toHaveURL("/home");
    // The account menu (not a chip in the bar) names the customer.
    await page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("button", { name: "Akun" }).click();
    await expect(page.getByRole("menu").getByText("Uji Pelanggan", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    // A sub-page of the admin section: the customer ends up on their own home, and the page they asked
    // for never reaches the browser, not even in the HTML that comes before the redirect.
    const html = await (await page.request.get("/admin/tickets")).text();
    expect(html).not.toContain("Tiket baru muncul otomatis");
    await page.goto("/admin/tickets");
    await expect(page).toHaveURL("/home");
    await expect(page.getByRole("heading", { level: 1, name: "Pesanan Anda" })).toBeVisible();

    await page.goto("/cleaner");
    await expect(page).toHaveURL("/home");
    await expect(page.getByText("Belum ada pekerjaan", { exact: true })).toHaveCount(0);

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
    await expect(page.getByRole("heading", { level: 1, name: "Selamat datang, Uji" })).toBeVisible();
    await page.getByRole("navigation", { name: "Navigasi petugas" }).getByRole("link", { name: "Pekerjaan" }).click();
    await expect(page).toHaveURL("/cleaner/jobs");
    await expect(page.getByText("Belum ada pekerjaan", { exact: true })).toBeVisible();

    await page.goto("/orders");
    await expect(page).toHaveURL("/cleaner");
    // Neither the customer's history nor the home's empty state ("Belum ada pesanan") is shown to them.
    await expect(page.getByText("Belum ada riwayat pesanan")).toHaveCount(0);
    await expect(page.getByText("Belum ada pesanan", { exact: true })).toHaveCount(0);

    // The cleaner's account tab shows who is signed in and the way out.
    await page.getByRole("navigation", { name: "Navigasi petugas" }).getByRole("link", { name: "Akun" }).click();
    await expect(page).toHaveURL("/cleaner/account");
    await expect(page.getByRole("main").getByRole("heading", { name: "Uji Petugas", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Keluar" })).toBeVisible();
  });
});

test.describe("signing out", () => {
  test("returns to the landing page, after which /orders needs a sign-in again", async ({ page }) => {
    await page.goto("/login");
    await fillLogin(page, customer);
    await expect(page).toHaveURL("/home");

    // Signing out is in the account menu of the navigation, with no page of its own (e2e/account-menu.spec.ts).
    await page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("button", { name: "Akun" }).click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Rumah bersih yang bisa Anda tonton langsung" }),
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
    await expect(page.getByRole("heading", { level: 1, name: "Log in", exact: true })).toBeVisible();
    await page.getByRole("link", { name: /^Password/ }).click();
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
    await expect(page.getByRole("heading", { level: 1, name: "Your orders" })).toBeVisible();
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Account" }).click();
    await expect(page.getByRole("menu").getByText("Uji Pelanggan", { exact: true })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Log out" })).toBeVisible();
  });
});
