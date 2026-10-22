import { expect, test, type Browser, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { adminClient } from "../../tests/integration/test-project";

// T5 review screenshots: the sign-in and sign-up pages (signed out, with error states), and the
// account corner once signed in (customer app bar and account page, landing header, back-office
// sidebar and narrow menu), at two phone and two desktop widths. Saved to docs/screenshots/t5/:
//   <surface>-<width>.png       the whole page, with fixed bars where they really sit
//   <surface>-<width>-fold.png  phones only: the first screen exactly as it opens
// The signed-in pictures sign in once per device type through the form (Supabase limits sign-ins per
// address) and reuse that browser for both widths. The users are fictional, made for this run in the
// Supabase test project, and deleted at the end.
// Run with: npm run screenshots -- t5

const dir = "docs/screenshots/t5";
type Device = "phone" | "desktop";
const widths: Record<Device, number[]> = { phone: [360, 390], desktop: [1280, 1440] };
const heights: Record<number, number> = { 360: 780, 390: 844, 1280: 800, 1440: 900 };

type Account = { email: string; password: string };
const createdIds: string[] = [];

async function createAccount(role: "customer" | "agency", name: string): Promise<Account> {
  const email = `homeklin-shot-${role}-${randomUUID().slice(0, 8)}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !data.user) throw new Error(`Could not create the ${role} screenshot user: ${error?.message}`);
  createdIds.push(data.user.id);
  if (role !== "customer") {
    const update = await admin.from("profiles").update({ role }).eq("id", data.user.id);
    if (update.error) throw new Error(`Could not make the screenshot user a ${role}: ${update.error.message}`);
  }
  return { email, password };
}

let customer: Account;
let agency: Account;

test.beforeAll(async () => {
  customer = await createAccount("customer", "Uji Pelanggan");
  agency = await createAccount("agency", "Uji Staf");
});

test.afterAll(async () => {
  const admin = adminClient();
  for (const id of createdIds.splice(0)) await admin.auth.admin.deleteUser(id);
});

async function newPage(browser: Browser, device: Device) {
  const width = widths[device][0];
  const mobile = device === "phone";
  const context = await browser.newContext({
    viewport: { width, height: heights[width] },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: "reduce",
  });
  return { context, page: await context.newPage() };
}

async function signIn(page: Page, account: Account) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

/** The first screen (phones) and the whole page at the current width; checks there is no sideways scroll. */
async function shoot(page: Page, name: string, width: number, mobile: boolean) {
  await page.setViewportSize({ width, height: heights[width] });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width);
  // Lazy images only load near the viewport: the first screen's now, the rest once the viewport grows.
  await page.waitForFunction(() =>
    [...document.images]
      .filter((img) => img.getBoundingClientRect().top < window.innerHeight)
      .every((img) => img.complete && img.naturalWidth > 0),
  );
  if (mobile) await page.screenshot({ path: `${dir}/${name}-${width}-fold.png` });

  // Grow the viewport to the page so fixed bars sit where a tall screen shows them (see t4).
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>('[class*="dvh"]')) {
      const { minHeight, maxHeight } = getComputedStyle(element);
      element.style.minHeight = minHeight;
      element.style.maxHeight = maxHeight;
    }
  });
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.max(pageHeight, heights[width]) });
  await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
  await page.screenshot({ path: `${dir}/${name}-${width}.png` });
  await page.setViewportSize({ width, height: heights[width] });
}

for (const device of ["phone", "desktop"] as const) {
  const mobile = device === "phone";

  test(`sign-in pages on a ${device}`, async ({ browser }) => {
    const { context, page } = await newPage(browser, device);
    for (const [name, path] of [
      ["login-id", "/login"],
      ["login-en", "/en/login"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: /^(Masuk|Log in)$/ })).toBeVisible();
      for (const width of widths[device]) await shoot(page, name, width, mobile);
    }
    await context.close();
  });

  test(`sign-up with field errors on a ${device}`, async ({ browser }) => {
    const { context, page } = await newPage(browser, device);
    for (const [name, path, submit] of [
      ["signup-errors-id", "/signup", "Buat akun"],
      ["signup-errors-en", "/en/signup", "Create account"],
    ] as const) {
      await page.goto(path);
      await page.getByLabel(/^(Email)$/).fill("nama@");
      await page.getByRole("button", { name: submit, exact: true }).click();
      await expect(page.locator('[aria-invalid="true"]')).toHaveCount(3);
      // The cursor sits in the first field to fix; blur it so the picture shows the resting error state.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      for (const width of widths[device]) await shoot(page, name, width, mobile);
    }
    await context.close();
  });

  test(`a customer signed in on a ${device}`, async ({ browser }) => {
    const { context, page } = await newPage(browser, device);
    await signIn(page, customer);
    await expect(page).toHaveURL("/home");
    // The account chip streams in just after the rest of the page.
    await expect(page.getByRole("banner").getByRole("link", { name: "Uji Pelanggan, akun Anda" })).toBeVisible();
    for (const width of widths[device]) await shoot(page, "home-signed-in", width, mobile);
    await page.goto("/account");
    await expect(page.getByRole("button", { name: "Keluar" })).toBeVisible();
    for (const width of widths[device]) await shoot(page, "account-signed-in", width, mobile);
    if (!mobile) {
      await page.goto("/");
      await expect(page.getByRole("banner").getByRole("link", { name: "Uji Pelanggan, akun Anda" })).toBeVisible();
      for (const width of widths[device]) await shoot(page, "landing-signed-in", width, mobile);
    }
    await context.close();
  });

  test(`agency staff signed in on a ${device}`, async ({ browser }) => {
    const { context, page } = await newPage(browser, device);
    await signIn(page, agency);
    await expect(page).toHaveURL("/agency");
    if (mobile) {
      await page.getByRole("button", { name: "Menu" }).click();
      await expect(page.getByRole("button", { name: "Keluar" })).toBeVisible();
    } else {
      await expect(page.getByRole("complementary").getByRole("button", { name: "Keluar" })).toBeVisible();
    }
    for (const width of widths[device]) await shoot(page, mobile ? "agency-menu-signed-in" : "agency-signed-in", width, mobile);
    await context.close();
  });
}

test("a wrong password on a phone", async ({ browser }) => {
  const { context, page } = await newPage(browser, "phone");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(customer.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Email atau kata sandi salah");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await shoot(page, "login-wrong-password", 360, true);
  await context.close();
});
