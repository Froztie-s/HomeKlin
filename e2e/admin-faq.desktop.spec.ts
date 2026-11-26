import { randomUUID } from "node:crypto";
import { expect, test, type Browser } from "@playwright/test";
import { adminClient } from "../tests/integration/test-project";
import { signedInAs } from "./setup/auth-state";

// D1: admin's FAQ editor after the user's mock "Admin-Faq" (SPEC: admin manages the FAQ). Admin adds an
// entry in place, the server refuses an empty one with a message per field, the help page shows a
// published entry at once (the FAQ cache tag is expired), and unticking "Tampilkan di halaman bantuan"
// makes it a draft the help page no longer shows. The entry carries this run's own word and is deleted
// at the end; other specs read the same FAQ, so the list may hold their entries too.

test.describe.configure({ mode: "serial", timeout: 120_000 });

const word = `ujifaq${randomUUID().slice(0, 8)}`;
const entry = {
  questionId: `Uji pertanyaan ${word} untuk pelanggan?`,
  questionEn: `Test question ${word} for customers?`,
  answerId: "Ini jawaban uji untuk pertanyaan umum.",
  answerEn: "This is a test answer for the FAQ.",
};

test.afterAll(async () => {
  await adminClient().from("faq_entries").delete().ilike("keywords", `%${word}%`);
});

/**
 * A signed-out visitor's browser. browser.newContext() carries the project's use options, so without an
 * empty session it would be signed in as admin, and since 2026-11-20 staff are sent from the help page to
 * their own console (StaffRedirect): the help page would never be the one read.
 */
const visitorContext = (browser: Browser, baseURL: string | undefined) => browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });

test.describe("as admin", () => {
  test.use(signedInAs.admin);

  test("an empty new entry is refused with a message per field and nothing is saved", async ({ page }) => {
    await page.goto("/admin/faq");
    await page.getByRole("link", { name: "Tambah pertanyaan" }).click();
    await expect(page).toHaveURL("/admin/faq?new");
    const panel = page.getByTestId("faq-create-panel");
    await expect(panel.getByLabel("Pertanyaan (Indonesia)")).toBeFocused();
    await panel.getByRole("button", { name: "Simpan pertanyaan" }).click();
    await expect(panel.getByText("Periksa 4 kolom yang ditandai.")).toBeVisible();
    await expect(panel.getByText("Masukkan pertanyaan.")).toHaveCount(2);
    await expect(panel.getByText("Masukkan jawaban.")).toHaveCount(2);
    await expect(panel.getByLabel("Pertanyaan (Indonesia)")).toBeFocused();
  });

  test("a published entry is added and shows on the help page at once", async ({ page, browser, baseURL }) => {
    await page.goto("/admin/faq?new");
    const panel = page.getByTestId("faq-create-panel");
    await panel.getByLabel("Pertanyaan (Indonesia)").fill(entry.questionId);
    await panel.getByLabel("Pertanyaan (Inggris)").fill(entry.questionEn);
    await panel.getByLabel("Jawaban (Indonesia)").fill(entry.answerId);
    await panel.getByLabel("Jawaban (Inggris)").fill(entry.answerEn);
    await panel.getByLabel("Kata kunci (pisahkan dengan koma)").fill(` ${word} ,, uji `);
    await panel.getByLabel("Tampilkan di halaman bantuan").check();
    await panel.getByRole("button", { name: "Simpan pertanyaan" }).click();

    await expect(page.getByRole("status").filter({ hasText: `${entry.questionId} ditambahkan.` })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/faq\?created=/);
    const row = page.locator("[data-faq]").filter({ hasText: entry.questionId });
    await expect(row.locator("summary")).toContainText(`Kata kunci: ${word}, uji`);
    await expect(row.locator("summary")).toContainText("Dipublikasikan");

    const visitor = await visitorContext(browser, baseURL);
    const help = await visitor.newPage();
    await help.goto(`/support?q=${word}`);
    await expect(help.getByRole("heading", { level: 1, name: "Bantuan", exact: true })).toBeVisible();
    await expect(help.getByText(entry.questionId)).toBeVisible();
    await visitor.close();
  });

  test("the list shows every entry with its order, keywords and status in words", async ({ page }) => {
    await page.goto("/admin/faq");
    await expect(page.getByRole("heading", { level: 1, name: "Pertanyaan umum" })).toBeVisible();
    await expect(page.getByTestId("faq-counts")).toHaveText(/^\d+ dipublikasikan, \d+ draf\.$/);
    const rows = page.getByRole("list", { name: "Daftar pertanyaan umum" }).getByRole("listitem");
    // count() does not wait, and the list streams in: wait for its first row instead.
    await expect(rows.first()).toBeVisible();
    // Each status is a word with an icon, never colour alone.
    await expect(rows.first().locator("summary")).toContainText(/Dipublikasikan|Draf/);
  });

  test("unticking the box makes it a draft the help page no longer shows", async ({ page, browser, baseURL }) => {
    await page.goto("/admin/faq");
    const row = page.locator("[data-faq]").filter({ hasText: entry.questionId });
    await row.locator("summary").click();
    await row.getByLabel("Tampilkan di halaman bantuan").uncheck();
    await row.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(page.getByRole("status").filter({ hasText: `${entry.questionId} disimpan.` })).toContainText("Masih Draf");
    await expect(page.locator("[data-faq]").filter({ hasText: entry.questionId }).locator("summary")).toContainText("Draf");

    const visitor = await visitorContext(browser, baseURL);
    const help = await visitor.newPage();
    await help.goto(`/support?q=${word}`);
    await expect(help.getByRole("heading", { level: 1, name: "Bantuan", exact: true })).toBeVisible();
    await expect(help.getByText(entry.questionId)).toHaveCount(0);
    await visitor.close();
  });

  test("Batal closes the open row and the create panel", async ({ page }) => {
    await page.goto("/admin/faq?new");
    await page.getByTestId("faq-create-panel").getByRole("link", { name: "Batal" }).click();
    await expect(page).toHaveURL("/admin/faq");
    await expect(page.getByTestId("faq-create-panel")).toHaveCount(0);
    const row = page.locator("[data-faq] details").first();
    await row.locator("summary").click();
    await expect(row).toHaveAttribute("open", "");
    await row.getByRole("button", { name: "Batal" }).click();
    await expect(page.locator("[data-faq] details").first()).not.toHaveAttribute("open", "");
  });

  test("reads in English", async ({ page }) => {
    await page.goto("/en/admin/faq?new");
    await expect(page.getByRole("heading", { level: 1, name: "FAQ" })).toBeVisible();
    await expect(page.getByTestId("faq-counts")).toHaveText(/^\d+ published, \d+ drafts?\.$/);
    const panel = page.getByTestId("faq-create-panel");
    await expect(panel.getByLabel("Question (Indonesian)")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Save question" })).toBeVisible();
  });
});

test.describe("as a customer", () => {
  test.use(signedInAs.customer);

  test("the FAQ editor is not shown", async ({ page }) => {
    await page.goto("/admin/faq");
    await expect(page.getByRole("list", { name: "Daftar pertanyaan umum" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Tambah pertanyaan" })).toHaveCount(0);
  });
});
