import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUsers, type TestUser } from "../tests/integration/test-project";
import { signInWithPassword } from "./order-test-data";
import { signedInAs } from "./setup/auth-state";

// T20 and T21 across two sessions at a desk: a customer and an admin, each in their own browser. The
// customer escalates a question on /support while the admin has the inbox open: the ticket appears in
// the inbox without a reload. The admin opens it beside the list and replies; the reply appears on the
// customer's chat without a reload, and the customer's answer appears for the admin the same way.
// Closing the ticket reaches the customer at once too, and their send box goes away.
// "Without a reload" is checked with a marker on window, which a page load would wipe.
// The spec makes its own customer and deletes the ticket (its messages go with it) and the customer.

test.describe.configure({ mode: "serial", timeout: 180_000 });

const question = `Petugas belum datang, apakah jadwal saya berubah? (${randomUUID().slice(0, 6)})`;
const reply = "Petugas Anda sedang dalam perjalanan dan tiba dalam 15 menit.";
const answer = "Baik, terima kasih atas kabarnya.";

let customer: TestUser;
let ticketId = "";

test.beforeAll(async () => {
  customer = await createTestUser("t21-customer", { full_name: "Uji Pelanggan Realtime" });
});

test.afterAll(async () => {
  await adminClient().from("support_tickets").delete().eq("customer_id", customer.id);
  await deleteTestUsers([customer]);
});

async function markDocument(page: Page) {
  await page.evaluate(() => Object.assign(window, { sameDocument: true }));
}

async function stillSameDocument(page: Page) {
  expect(await page.evaluate(() => (window as { sameDocument?: boolean }).sameDocument)).toBe(true);
}

test("an escalation reaches the inbox, and replies flow both ways in real time", async ({ browser, baseURL }) => {
  const customerContext = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const adminContext = await browser.newContext({ baseURL, ...signedInAs.admin });
  const customerPage = await customerContext.newPage();
  const adminPage = await adminContext.newPage();
  await signInWithPassword(customerPage, customer);

  // The admin's inbox is open before the question is asked.
  await adminPage.goto("/admin/tickets");
  await expect(adminPage.getByRole("heading", { level: 1, name: "Tiket" })).toBeVisible();
  await expect(adminPage.getByText("Tiket baru muncul otomatis")).toBeVisible();
  await markDocument(adminPage);

  await customerPage.goto(`/support?q=${encodeURIComponent(question)}`);
  const panel = customerPage.getByRole("region", { name: /Hubungi admin/ });
  await panel.getByRole("radio", { name: /Mendesak/ }).check();
  await panel.getByRole("button", { name: "Kirim ke admin" }).click();
  await expect(customerPage).toHaveURL(/\/support\?ticket=[0-9a-f-]{36}$/);
  ticketId = new URL(customerPage.url()).searchParams.get("ticket") ?? "";
  const customerChat = customerPage.getByRole("region", { name: "Percakapan dengan Tim HomeKlin" });
  await expect(customerChat.getByText("Tersambung")).toBeVisible();
  await markDocument(customerPage);

  // The inbox shows it without a reload, with the customer's name, urgency, status and message count.
  const row = adminPage.locator(`a[href="/admin/tickets?ticket=${ticketId}"]`);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row).toContainText("Uji Pelanggan Realtime");
  await expect(row).toContainText(question);
  await expect(row).toContainText("Mendesak");
  await expect(row).toContainText("Menunggu jawaban");
  await expect(row).toContainText("1 pesan");
  await stillSameDocument(adminPage);

  // The admin opens the chat beside the list and replies.
  await row.click();
  await expect(adminPage).toHaveURL(`/admin/tickets?ticket=${ticketId}`);
  await expect(adminPage.getByRole("list", { name: "Daftar tiket" })).toBeVisible();
  const adminChat = adminPage.getByRole("region", { name: "Percakapan dengan pelanggan" });
  await expect(adminChat.getByText(question).first()).toBeVisible();
  await expect(adminChat.getByText("Tersambung")).toBeVisible();
  await markDocument(adminPage);
  await adminChat.getByRole("textbox", { name: "Tulis balasan" }).fill(reply);
  await adminChat.getByRole("button", { name: "Kirim balasan" }).click();
  await expect(adminChat.getByRole("list", { name: "Pesan" }).getByRole("listitem")).toHaveCount(2);

  // The customer sees the reply, from the HomeKlin team, without a reload, and the status changes.
  const customerMessages = customerChat.getByRole("list", { name: "Pesan" });
  await expect(customerMessages.getByRole("listitem")).toHaveCount(2, { timeout: 20_000 });
  await expect(customerMessages.getByRole("listitem").last()).toContainText("Tim HomeKlin");
  await expect(customerMessages.getByRole("listitem").last()).toContainText(reply);
  await expect(customerChat.getByText("Sudah dijawab")).toBeVisible();
  await stillSameDocument(customerPage);

  // The customer answers; the admin sees it without a reload.
  await customerChat.getByRole("textbox", { name: "Tulis pesan" }).fill(answer);
  await customerChat.getByRole("button", { name: "Kirim", exact: true }).click();
  const adminMessages = adminChat.getByRole("list", { name: "Pesan" });
  await expect(adminMessages.getByRole("listitem")).toHaveCount(3, { timeout: 20_000 });
  await expect(adminMessages.getByRole("listitem").last()).toContainText("Uji Pelanggan Realtime");
  await expect(adminMessages.getByRole("listitem").last()).toContainText(answer);
  await stillSameDocument(adminPage);

  // Closing asks once more, then reaches the customer at once.
  await adminChat.getByRole("button", { name: "Tutup tiket" }).click();
  await adminChat.getByRole("button", { name: "Ya, tutup tiket" }).click();
  await expect(adminChat.getByText("Ditutup", { exact: true })).toBeVisible();
  await expect(adminChat.getByRole("textbox", { name: "Tulis balasan" })).toHaveCount(0);
  await expect(row).toContainText("Ditutup");

  await expect(customerChat.getByText("Ditutup", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(customerChat.getByRole("textbox", { name: "Tulis pesan" })).toHaveCount(0);
  await expect(customerChat.getByText(/Percakapan ini sudah ditutup/)).toBeVisible();
  await stillSameDocument(customerPage);

  const stored = await adminClient().from("support_tickets").select("status").eq("id", ticketId).single();
  expect(stored.data?.status).toBe("closed");

  await customerContext.close();
  await adminContext.close();
});

test.describe("the inbox", () => {
  test.use(signedInAs.admin);

  test("an unknown ticket shows not found beside the list, and works in English", async ({ page }) => {
    await page.goto(`/admin/tickets?ticket=${randomUUID()}`);
    await expect(page.getByRole("heading", { name: "Tiket tidak ditemukan" })).toBeVisible();
    await page.goto("/en/admin/tickets");
    await expect(page.getByRole("heading", { level: 1, name: "Tickets" })).toBeVisible();
    await expect(page.getByText("New tickets appear automatically")).toBeVisible();
  });
});
