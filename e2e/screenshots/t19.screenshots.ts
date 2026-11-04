import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUsers, type TestUser } from "../../tests/integration/test-project";
import { signInWithPassword } from "../order-test-data";

// T19-T21 review screenshots: Help (/support) for a visitor (every question, a search with a match and
// one opened, a search without a match), for a signed-in customer (the ticket form under a search
// without a match, their tickets, and a chat with a reply), and admin's inbox with a chat open beside
// it. Two phone and two desktop widths, both languages.
// Saved to docs/screenshots/t19/:
//   <surface>-<lang>-<width>.png       the whole page, with fixed bars where they really sit
//   <surface>-<lang>-<width>-fold.png  phones only: the first screen exactly as it opens
// A fictional customer and admin are made for the run in the Supabase test project and deleted at the
// end, with their tickets. Admin's inbox also shows any ticket other runs left open at the time.
// Run with: npm run screenshots -- t19

test.describe.configure({ mode: "serial", timeout: 300_000 });

const dir = "docs/screenshots/t19";
type Device = "phone" | "desktop";
const widths: Record<Device, number[]> = { phone: [360, 390], desktop: [1280, 1440] };
const heights: Record<number, number> = { 360: 780, 390: 844, 1280: 800, 1440: 900 };
const languages = [
  ["id", ""],
  ["en", "/en"],
] as const;

let customer: TestUser;
let admin: TestUser;
let urgentTicket = "";

test.beforeAll(async () => {
  const { seedFaq } = await import("../../scripts/seed.mjs");
  await seedFaq({ client: adminClient() });
  [customer, admin] = await Promise.all([
    createTestUser("t19-shots", { full_name: "Uji Pelanggan" }),
    createTestUser("t19-shots-admin", { full_name: "Uji Admin" }),
  ]);
  const role = await adminClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
  if (role.error) throw new Error(`Could not make the screenshot user an admin: ${role.error.message}`);

  const open = async (question: string, urgency: "normal" | "urgent") => {
    const { data, error } = await customer.client.rpc("open_ticket", { p_question: question, p_urgency: urgency, p_order: null });
    if (error) throw new Error(`Could not open the screenshot ticket: ${error.message}`);
    return String(data);
  };
  await open("Bisakah saya menambah layanan setrika di pesanan berikutnya?", "normal");
  urgentTicket = await open("Petugas belum datang, padahal jadwalnya 09.00-11.00. Apakah ada perubahan?", "urgent");
  const say = async (user: TestUser, body: string) => {
    const { error } = await user.client.rpc("post_ticket_message", { p_ticket: urgentTicket, p_body: body });
    if (error) throw new Error(`Could not add the screenshot message: ${error.message}`);
  };
  await say(admin, "Mohon maaf atas keterlambatannya. Petugas Anda sedang dalam perjalanan dan tiba sekitar pukul 09.40.");
  await say(customer, "Baik, terima kasih. Saya tunggu.");
});

test.afterAll(async () => {
  if (customer) await adminClient().from("support_tickets").delete().eq("customer_id", customer.id);
  await deleteTestUsers([customer, admin]);
});

async function newContext(browser: Browser, device: Device, user?: TestUser): Promise<BrowserContext> {
  const width = widths[device][0];
  const mobile = device === "phone";
  const context = await browser.newContext({
    viewport: { width, height: heights[width] },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: "reduce",
  });
  if (user) {
    const page = await context.newPage();
    await signInWithPassword(page, user);
    await page.close();
  }
  return context;
}

async function shoot(page: Page, name: string, width: number, mobile: boolean) {
  await page.setViewportSize({ width, height: heights[width] });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^(Memuat|Loading|Menyambungkan|Connecting)/)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, name).toBeLessThanOrEqual(width);
  if (mobile) await page.screenshot({ path: `${dir}/${name}-${width}-fold.png` });
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: Math.max(pageHeight, heights[width]) });
  await page.screenshot({ path: `${dir}/${name}-${width}.png` });
  await page.setViewportSize({ width, height: heights[width] });
}

async function open(page: Page, path: string) {
  await page.context().clearCookies({ name: "NEXT_LOCALE" });
  await page.goto(path);
}

async function shootAll(browser: Browser, user: TestUser | undefined, surfaces: (prefix: string) => [string, string, ((page: Page) => Promise<void>)?][], devices: Device[] = ["phone", "desktop"]) {
  for (const device of devices) {
    const context = await newContext(browser, device, user);
    const page = await context.newPage();
    for (const [lang, prefix] of languages) {
      for (const [name, path, prepare] of surfaces(prefix)) {
        await open(page, path);
        if (prepare) await prepare(page);
        for (const width of widths[device]) await shoot(page, `${name}-${lang}`, width, device === "phone");
      }
    }
    await context.close();
  }
}

test("Help for a visitor", async ({ browser }) => {
  await shootAll(browser, undefined, (prefix) => [
    ["visitor-faq", `${prefix}/support`],
    [
      "visitor-search",
      `${prefix}/support?q=${prefix ? "recording" : "rekaman"}`,
      async (page) => {
        await page.locator("summary").first().click();
      },
    ],
    ["visitor-no-match", `${prefix}/support?q=setrika`],
  ]);
});

test("Help for a signed-in customer", async ({ browser }) => {
  await shootAll(browser, customer, (prefix) => [
    ["customer-contact", `${prefix}/support?q=${encodeURIComponent(prefix ? "ironing" : "setrika")}`],
    [
      "customer-chat",
      `${prefix}/support?ticket=${urgentTicket}`,
      async (page) => {
        await expect(page.getByText(/^(Tersambung|Connected)$/)).toBeVisible();
      },
    ],
  ]);
});

test("admin's inbox and a chat beside it", async ({ browser }) => {
  await shootAll(browser, admin, (prefix) => [
    ["admin-inbox", `${prefix}/admin/tickets`],
    [
      "admin-chat",
      `${prefix}/admin/tickets?ticket=${urgentTicket}`,
      async (page) => {
        await expect(page.getByText(/^(Tersambung|Connected)$/)).toBeVisible();
      },
    ],
  ]);
});
