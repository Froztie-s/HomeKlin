import { expect, test, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { adminClient } from "../tests/integration/test-project";

// T5 on a desktop screen (agency and admin work at desks): each staff role lands on its own back
// office, is refused the other one, sees who is signed in in the sidebar and signs out from there.
// Runs against the separate Supabase test project (playwright.config.ts). Every user here is made for
// this file with a unique address on example.com, and deleted again afterwards. Every test starts
// signed out.

type Role = "agency" | "admin";
type Account = { id: string; email: string; password: string; name: string };

const createdIds: string[] = [];

/** A confirmed user with a fictional name, given a staff role the way only the service role can. */
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
  const update = await admin.from("profiles").update({ role }).eq("id", data.user.id);
  if (update.error) throw new Error(`Could not make the test user a ${role}: ${update.error.message}`);
  return { id: data.user.id, email, password, name };
}

let agency: Account;
let administrator: Account;

test.beforeAll(async () => {
  agency = await createAccount("agency", "Uji Staf");
  administrator = await createAccount("admin", "Uji Admin");
});

test.afterAll(async () => {
  const admin = adminClient();
  for (const id of createdIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

/** Staff keep email and password (T9b): "Masuk dengan kata sandi" on /login. */
async function logIn(page: Page, account: Account) {
  await page.goto("/login");
  await page.getByRole("link", { name: "Masuk dengan kata sandi" }).click();
  await expect(page).toHaveURL("/login?cara=sandi");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

test("the landing header offers Masuk, which opens the sign-in page", async ({ page }) => {
  await page.goto("/");
  const signIn = page.getByRole("banner").getByRole("link", { name: "Masuk", exact: true });
  await expect(signIn).toBeVisible();
  await signIn.click();
  await expect(page).toHaveURL("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Masuk ke HomeKlin" })).toBeVisible();
});

test("an agency user lands on /agency, sees who is signed in, and is refused the admin console", async ({ page }) => {
  await logIn(page, agency);
  await expect(page).toHaveURL("/agency");
  await expect(page.getByRole("heading", { level: 1, name: "Dasbor" })).toBeVisible();
  await expect(page.getByText("Ringkasan agensi muncul di sini")).toBeVisible();

  const sidebar = page.getByRole("complementary");
  await expect(sidebar.getByText("Masuk sebagai")).toBeVisible();
  await expect(sidebar.getByText(agency.name, { exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Keluar" })).toBeVisible();

  await page.goto("/admin");
  await expect(page).toHaveURL("/agency");
  await expect(page.getByText("Ringkasan platform muncul di sini")).toHaveCount(0);
});

test("an admin lands on /admin, is refused an agency page, and signs out from the sidebar", async ({ page }) => {
  await logIn(page, administrator);
  await expect(page).toHaveURL("/admin");
  await expect(page.getByText("Ringkasan platform muncul di sini")).toBeVisible();

  // A sub-page of the agency section. The page the admin asked for never reaches the browser, not
  // even in the HTML that comes before the redirect; their own pages do (the check is not vacuous).
  const refused = await (await page.request.get("/agency/schedule")).text();
  expect(refused).not.toContain("Ketersediaan agensi Anda per area");
  const allowed = await (await page.request.get("/admin/tickets")).text();
  expect(allowed).toContain("Pertanyaan pelanggan yang diteruskan");
  await page.goto("/agency/schedule");
  await expect(page).toHaveURL("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Dasbor" })).toBeVisible();

  // Staff signed in on the landing page see their chip, which leads back to their dashboard.
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "Uji Admin, dasbor Anda" })).toHaveAttribute(
    "href",
    "/admin",
  );

  await page.goto("/admin");
  await page.getByRole("complementary").getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
});
