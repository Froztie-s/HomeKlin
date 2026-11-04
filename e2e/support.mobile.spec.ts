import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUsers, type TestUser } from "../tests/integration/test-project";
import { signInWithPassword } from "./order-test-data";
import { signedOut, type StorageState } from "./setup/auth-state";

// T19 and T20 on a phone. /support is public: anyone searches HomeKlin's FAQ (from the database, in
// the page's language) with a plain GET form (?q=), so it works without JavaScript too. When nothing
// matches, the "Hubungi admin" panel stands out; a visitor is asked to sign in first, a signed-in
// customer escalates the question into a chat ticket and lands on its chat (/support?ticket=<id>).
// Another customer opening that address finds nothing and learns nothing about it.
// The spec makes its own customers, so their ticket lists hold exactly what it made, and deletes the
// tickets again (their messages go with them) and then the customers. The FAQ is brought up to date
// with the seed first (an upsert; entries admin added are left alone).

test.describe.configure({ mode: "serial", timeout: 120_000 });

const agencyWording = /agensi|agency|mitra|partner/i;
// A question no FAQ entry contains, word for word (the search matches the whole phrase).
const question = `Bisakah petugas menyiram tanaman di balkon saya? (${randomUUID().slice(0, 6)})`;

let customer: TestUser;
let other: TestUser;
let customerSession: StorageState;
let otherSession: StorageState;
let ticketId = "";

async function sessionOf(browser: import("@playwright/test").Browser, baseURL: string | undefined, user: TestUser) {
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  await signInWithPassword(await context.newPage(), user);
  const state = await context.storageState();
  await context.close();
  return state;
}

test.beforeAll(async ({ browser, baseURL }) => {
  // Loaded with import(): Playwright compiles static imports to require(), which cannot load this ES
  // module (it uses import.meta).
  const { seedFaq } = await import("../scripts/seed.mjs");
  await seedFaq({ client: adminClient() });
  [customer, other] = await Promise.all([
    createTestUser("t20-customer", { full_name: "Uji Pelanggan Bantuan" }),
    createTestUser("t20-other", { full_name: "Uji Pelanggan Lain" }),
  ]);
  [customerSession, otherSession] = await Promise.all([
    sessionOf(browser, baseURL, customer),
    sessionOf(browser, baseURL, other),
  ]);
});

test.afterAll(async () => {
  const admin = adminClient();
  await admin.from("support_tickets").delete().in("customer_id", [customer?.id, other?.id].filter(Boolean));
  await deleteTestUsers([customer, other]);
});

const searchBox = (page: Page, name = "Cari pertanyaan") => page.getByRole("searchbox", { name });
const contactPanel = (page: Page, name = /Hubungi admin/) => page.getByRole("region", { name });

test.describe("as a visitor", () => {
  test.use(signedOut);

  test("finds a seeded entry by a keyword in Indonesian, and reads its answer", async ({ page }) => {
    await page.goto("/support");
    await expect(page.getByRole("heading", { level: 1, name: "Bantuan" })).toBeVisible();
    // Every entry before a search.
    await expect(page.getByText("Metode pembayaran apa saja yang tersedia?")).toBeVisible();

    await searchBox(page).fill("rekaman");
    await page.getByRole("button", { name: "Cari", exact: true }).click();
    await expect(page).toHaveURL("/support?q=rekaman");
    const entry = page.getByText("Berapa lama rekaman disimpan?");
    await expect(entry).toBeVisible();
    await expect(page.getByText("Metode pembayaran apa saja yang tersedia?")).toHaveCount(0);

    await entry.click();
    await expect(page.getByText(/bisa diputar ulang selama 7 hari/)).toBeVisible();
    // The contact panel is always there, quietly, below the answers.
    await expect(contactPanel(page)).toBeVisible();
  });

  test("finds a seeded entry by a keyword in English", async ({ page }) => {
    await page.goto("/en/support");
    await searchBox(page, "Search the questions").fill("payment");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL("/en/support?q=payment");
    await expect(page.getByText("Which payment methods can I use?")).toBeVisible();
    await expect(page.getByText("Metode pembayaran apa saja yang tersedia?")).toHaveCount(0);
    await page.getByText("Which payment methods can I use?").click();
    await expect(page.getByText(/Payment goes through Midtrans/)).toBeVisible();
  });

  test("a search without a match says so and puts the contact panel forward, with sign-in first", async ({ page }) => {
    await page.goto("/support?q=zzzzqq");
    await expect(page.getByRole("heading", { name: "Belum ada jawaban untuk pencarian ini" })).toBeVisible();
    const panel = contactPanel(page);
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("data-emphasis", "strong");
    const signIn = panel.getByRole("link", { name: "Masuk untuk bertanya" });
    await expect(signIn).toHaveAttribute("href", "/login?next=%2Fsupport");
    await expect(panel.getByRole("textbox")).toHaveCount(0);

    await page.goto("/en/support?q=zzzzqq");
    await expect(page.getByRole("heading", { name: "No answer for this search yet" })).toBeVisible();
    await expect(contactPanel(page, /Contact admin/).getByRole("link", { name: "Sign in to ask" })).toHaveAttribute(
      "href",
      "/en/login?next=%2Fsupport",
    );
  });

  test("a ticket address asks a visitor to sign in and shows nothing of the ticket", async ({ page }) => {
    await page.goto(`/support?ticket=${randomUUID()}`);
    await expect(page.getByRole("link", { name: "Masuk untuk bertanya" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Pesan" })).toHaveCount(0);
  });
});

test.describe("as a signed-in customer", () => {
  test.use({ storageState: async ({}, provide) => provide(customerSession) });

  test("has no tickets at first", async ({ page }) => {
    await page.goto("/support");
    await expect(page.getByText("Belum ada pertanyaan ke admin")).toBeVisible();
    await expect(page.getByRole("list", { name: "Pertanyaan Anda ke admin" })).toHaveCount(0);
  });

  test("escalates an unanswered question and lands on its chat", async ({ page }) => {
    await page.goto(`/support?q=${encodeURIComponent(question)}`);
    await expect(page.getByRole("heading", { name: "Belum ada jawaban untuk pencarian ini" })).toBeVisible();
    const panel = contactPanel(page);
    // The question is carried over from the search.
    const field = panel.getByRole("textbox", { name: "Pertanyaan Anda" });
    await expect(field).toHaveValue(question);
    await panel.getByRole("radio", { name: /Mendesak/ }).check();
    await panel.getByRole("button", { name: "Kirim ke admin" }).click();

    await expect(page).toHaveURL(/\/support\?ticket=[0-9a-f-]{36}$/);
    ticketId = new URL(page.url()).searchParams.get("ticket") ?? "";
    const chat = page.getByRole("region", { name: "Percakapan dengan Tim HomeKlin" });
    await expect(chat.getByText("Menunggu jawaban")).toBeVisible();
    await expect(chat.getByText("Mendesak", { exact: true })).toBeVisible();
    const messages = chat.getByRole("list", { name: "Pesan" });
    await expect(messages.getByRole("listitem")).toHaveCount(1);
    await expect(messages.getByRole("listitem").first()).toContainText("Anda");
    await expect(messages.getByRole("listitem").first()).toContainText(question);
    await expect(chat.getByText("Tersambung")).toBeVisible();

    const saved = await adminClient().from("support_tickets").select("question, urgency, customer_id").eq("id", ticketId).single();
    expect(saved.data).toEqual({ question, urgency: "urgent", customer_id: customer.id });
  });

  test("adds a message to the chat, which shows without a reload", async ({ page }) => {
    await page.goto(`/support?ticket=${ticketId}`);
    const chat = page.getByRole("region", { name: "Percakapan dengan Tim HomeKlin" });
    await expect(chat.getByText("Tersambung")).toBeVisible();
    await page.evaluate(() => Object.assign(window, { sameDocument: true }));

    const box = chat.getByRole("textbox", { name: "Tulis pesan" });
    await chat.getByRole("button", { name: "Kirim", exact: true }).click();
    // An empty message is refused on the spot, with words.
    await expect(chat.getByText("Tulis pesan Anda dulu.")).toBeVisible();

    await box.fill("Tanamannya ada lima pot.");
    await chat.getByRole("button", { name: "Kirim", exact: true }).click();
    const messages = chat.getByRole("list", { name: "Pesan" });
    await expect(messages.getByRole("listitem")).toHaveCount(2);
    await expect(messages.getByRole("listitem").last()).toContainText("Tanamannya ada lima pot.");
    await expect(box).toHaveValue("");
    expect(await page.evaluate(() => (window as { sameDocument?: boolean }).sameDocument)).toBe(true);
  });

  test("lists the ticket with its status under the contact panel, and leads back to it", async ({ page }) => {
    await page.goto("/support");
    const list = page.getByRole("list", { name: "Pertanyaan Anda ke admin" });
    await expect(list.getByRole("listitem")).toHaveCount(1);
    const row = list.getByRole("link");
    await expect(row).toHaveAttribute("href", `/support?ticket=${ticketId}`);
    await expect(row).toContainText(question);
    await expect(row).toContainText("Menunggu jawaban");
    await row.click();
    await expect(page).toHaveURL(`/support?ticket=${ticketId}`);
    await page.getByRole("link", { name: "Kembali ke Bantuan" }).click();
    await expect(page).toHaveURL("/support");
  });

  test("works in English", async ({ page }) => {
    await page.goto(`/en/support?ticket=${ticketId}`);
    const chat = page.getByRole("region", { name: "Chat with the HomeKlin team" });
    await expect(chat.getByText("Waiting for a reply")).toBeVisible();
    await expect(chat.getByText("Urgent", { exact: true })).toBeVisible();
    await expect(chat.getByRole("list", { name: "Messages" }).getByRole("listitem").first()).toContainText("You");
    await expect(chat.getByRole("textbox", { name: "Write a message" })).toBeVisible();

    await page.goto("/en/support?q=zzzzqq");
    const panel = contactPanel(page, /Contact admin/);
    await expect(panel.getByRole("textbox", { name: "Your question" })).toHaveValue("zzzzqq");
    await expect(page.getByRole("list", { name: "Your questions to admin" }).getByRole("listitem")).toHaveCount(1);
  });

  test.describe("at 360 px", () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test("the search, the form, the list and the chat have no sideways scroll and name no agency", async ({ page }) => {
      for (const prefix of ["", "/en"]) {
        for (const path of [`${prefix}/support?q=zzzzqq`, `${prefix}/support`, `${prefix}/support?ticket=${ticketId}`]) {
          await page.context().clearCookies({ name: "NEXT_LOCALE" });
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expect(page.getByText(/^(Memuat…|Loading…)$/)).toHaveCount(0);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow, path).toBeLessThanOrEqual(0);
          expect(await page.evaluate(() => document.body.innerText)).not.toMatch(agencyWording);
          expect(await page.content()).not.toMatch(agencyWording);
        }
      }
    });
  });
});

test.describe("as another customer", () => {
  test.use({ storageState: async ({}, provide) => provide(otherSession) });

  test("cannot open the first customer's ticket, and learns nothing about it", async ({ page }) => {
    for (const id of [ticketId, randomUUID(), "not-a-ticket"]) {
      await page.goto(`/support?ticket=${id}`);
      await expect(page.getByRole("heading", { name: "Percakapan tidak ditemukan" })).toBeVisible();
      await expect(page.getByRole("list", { name: "Pesan" })).toHaveCount(0);
      const served = await (await page.request.get(`/support?ticket=${id}`)).text();
      for (const html of [await page.content(), served]) expect(html).not.toContain(question);
    }

    await page.goto("/support");
    await expect(page.getByText("Belum ada pertanyaan ke admin")).toBeVisible();
    expect(await page.content()).not.toContain(ticketId);
  });
});
