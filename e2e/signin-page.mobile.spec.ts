import { expect, test, type Locator } from "@playwright/test";

// The sign-in page's redesign (the Phone-SignIn mock) on a phone, signed out: the forest panel folds
// into the slim bar, the back link and the heading above the card; the links around the forms; and
// the notice for an email order link that no longer works (/o/<token> sends the customer to
// /login?tautan=tidak-berlaku), in both languages.

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  expect(result).not.toBeNull();
  return result!;
}

test("on a phone the panel folds into the bar, the back link and the heading above the card", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Kirim kode" })).toBeVisible();

  // The desktop panel and its facts are not shown; the bar has the wordmark and the language switch.
  await expect(page.getByRole("complementary", { name: "Tentang HomeKlin" })).toBeHidden();
  await expect(page.getByText("Rekaman tersedia selama 7 hari")).toBeHidden();
  const banner = page.getByRole("banner");
  await expect(banner.getByRole("link", { name: "HomeKlin, halaman depan" })).toHaveAttribute("href", "/");
  await expect(banner.getByRole("group", { name: "Bahasa" })).toBeVisible();

  const back = page.getByRole("main").getByRole("link", { name: "Kembali ke beranda" });
  await expect(back).toHaveAttribute("href", "/");
  const tagline = page.getByRole("main").getByText("Satu pintu untuk semua akun HomeKlin");
  const title = page.getByRole("heading", { level: 1, name: "Masuk", exact: true });
  await expect(tagline).toBeVisible();
  const backBox = await box(back);
  const taglineBox = await box(tagline);
  const titleBox = await box(title);
  expect(backBox.y).toBeLessThan(taglineBox.y);
  expect(taglineBox.y + taglineBox.height).toBeLessThanOrEqual(titleBox.y);
  expect(backBox.height).toBeGreaterThanOrEqual(44);

  // The help line under the card leads to the support page.
  await expect(page.getByRole("link", { name: "Hubungi tim HomeKlin" })).toHaveAttribute("href", "/support");
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(360);
});

test("the password form offers the code instead of a password reset, keeping next", async ({ page }) => {
  await page.goto("/login?next=%2Forders&cara=sandi");
  await expect(page.getByLabel("Kata sandi", { exact: true })).toBeVisible();
  await expect(page.getByText("Gunakan email dan kata sandi akun Anda.", { exact: false })).toBeVisible();
  // No "remember me" box: sessions already persist.
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Lupa kata sandi? Masuk dengan kode email" })).toHaveAttribute(
    "href",
    "/login?next=%2Forders",
  );
});

test("an order link that no longer works shows a notice above the code form", async ({ page }) => {
  await page.goto("/login?tautan=tidak-berlaku&next=%2Forders");
  const notice = page
    .getByRole("main")
    .getByRole("status")
    .filter({ hasText: "Tautan di email ini sudah tidak berlaku." });
  await expect(notice).toHaveText(
    "Tautan di email ini sudah tidak berlaku. Masuk dengan kode yang kami kirim ke email Anda untuk melihat pesanan.",
  );
  // Above the form, which is the code form, and `next` is kept for the password way too.
  const sendCode = page.getByRole("button", { name: "Kirim kode" });
  expect((await box(notice)).y).toBeLessThan((await box(page.getByLabel("Email", { exact: true }))).y);
  await expect(sendCode).toBeVisible();
  await expect(page.getByRole("link", { name: /^Staf & demo/ })).toHaveAttribute(
    "href",
    "/login?next=%2Forders&cara=sandi",
  );

  // Without the parameter there is no notice.
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Kirim kode" })).toBeVisible();
  await expect(page.getByText("Tautan di email ini sudah tidak berlaku.", { exact: false })).toHaveCount(0);
});

test("the notice and the page read in English at /en/login", async ({ page }) => {
  await page.goto("/en/login?tautan=tidak-berlaku");
  await expect(page.getByRole("heading", { level: 1, name: "Log in", exact: true })).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("status").filter({ hasText: "The link in this email no longer works." }),
  ).toHaveText("The link in this email no longer works. Sign in with the code we email you to see your order.");
  await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
  await expect(page.getByRole("main").getByText("One door to every HomeKlin account")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Back to the home page" })).toHaveAttribute("href", "/en");
  await expect(page.getByRole("link", { name: "Contact the HomeKlin team" })).toHaveAttribute("href", "/en/support");
});
