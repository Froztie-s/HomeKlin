import { expect, test, type Page } from "@playwright/test";
import { adminClient } from "../tests/integration/test-project";
import { jakartaClock, jobPhone } from "./job-test-data";
import { createMonitorWorld, type MonitorWorld } from "./monitor-test-data";
import { signedInAs } from "./setup/auth-state";

// D1: the admin order detail page after the user's mocks "Admin-Order" and "Admin-Order-Issue", at
// /admin/orders/<order number>. The spec makes its own agency, cleaners, jobs and streams (the monitor
// world), one finished job and one help chat about the live order, and removes them at the end (the
// chat goes with the world's customer). The live order also gets a customer note, an assignment time
// and a payment method, as booking, assign_cleaner and the payment notification would write them (B2).

test.describe.configure({ mode: "serial", timeout: 120_000 });

let data: MonitorWorld;
let finishedCode: string;
const question = "Uji pertanyaan tentang pesanan ini dari pelanggan";
const note = "Uji catatan: mohon lepas sepatu di pintu masuk.";

test.beforeAll(async () => {
  test.setTimeout(180_000);
  data = await createMonitorWorld("d1o");
  const admin = adminClient();
  const cleaner = await data.world.cleaner(data.agencyId, "Uji Petugas Detail Selesai");
  const job = await data.world.job({ agencyId: data.agencyId, cleaner, startsIn: -200, address: "Jl. Uji Detail Selesai", completedMinutesAgo: 20 });
  const { data: row, error: codeError } = await admin.from("orders").select("code").eq("id", job.id).single<{ code: string }>();
  if (codeError || !row) throw new Error(`Could not read the order number: ${codeError?.message}`);
  finishedCode = row.code;
  // As open_ticket writes it: the ticket, and the question as its first message.
  const { data: ticket, error } = await admin
    .from("support_tickets")
    .insert({ customer_id: data.world.customer.id, order_id: data.live.active.id, question, urgency: "urgent" })
    .select("id")
    .single<{ id: string }>();
  if (error || !ticket) throw new Error(`Could not set up the help chat: ${error?.message}`);
  const { error: messageError } = await admin.from("ticket_messages").insert({ ticket_id: ticket.id, from_admin: false, body: question });
  if (messageError) throw new Error(`Could not set up the first message: ${messageError.message}`);
  const { error: orderError } = await admin
    .from("orders")
    .update({ customer_note: note, assigned_at: new Date(Date.now() - 30 * 60_000).toISOString(), payment_type: "gopay" })
    .eq("id", data.live.active.id);
  if (orderError) throw new Error(`Could not set up the order's details: ${orderError.message}`);
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  await data?.cleanup();
});

test.use(signedInAs.admin);

const card = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

test("a live order shows its video, facts, people, payment and status steps", async ({ page }) => {
  const job = data.live.active;
  await page.goto(`/admin/orders/${job.code}`);
  await expect(page.getByRole("heading", { level: 1, name: "Pembersihan Rutin" })).toBeVisible();
  await expect(page.getByRole("status").first()).toHaveText("Sedang berlangsung");
  await expect(page.getByText(new RegExp(`^Pesanan ${job.code}, `))).toBeVisible();
  await expect(page.getByRole("link", { name: "Kembali ke pemantauan langsung" })).toHaveAttribute("href", "/admin/monitor");

  const video = card(page, "Siaran langsung");
  await expect(video.locator("video")).toHaveCount(1);
  await expect(video.getByRole("button", { name: `Buka siaran ${job.cleaner} dalam layar penuh` })).toBeVisible();
  await expect(video).toContainText("Rekaman tersimpan 7 hari");

  const facts = card(page, "Detail pesanan");
  await expect(facts).toContainText("Pembersihan Rutin");
  await expect(facts).toContainText("Jakarta Timur");
  await expect(facts).toContainText("Jl. Uji Pantau active, Cakung, Jakarta Timur");
  await expect(facts).toContainText(note);

  const customer = card(page, "Pelanggan");
  await expect(customer).toContainText("Uji Pelanggan Pekerjaan");
  await expect(customer.getByRole("link", { name: `Telepon ${jobPhone}` })).toHaveAttribute("href", `tel:${jobPhone}`);

  const people = card(page, "Petugas dan agensi");
  await expect(people).toContainText(job.cleaner);
  await expect(people).toContainText(data.agencyName);

  // The booked price and its split (70% by default); an estimate until check-out writes the real fee.
  const payment = card(page, "Pembayaran");
  await expect(payment).toContainText(/Harga pelanggan\s*Rp\s150\.000/);
  await expect(payment).toContainText(/Imbalan agensi \(70%\)\s*\(perkiraan\)\s*Rp\s105\.000/);
  await expect(payment).toContainText(/Pendapatan HomeKlin\s*\(perkiraan\)\s*Rp\s45\.000/);
  await expect(payment).toContainText("Lunas");
  await expect(payment).toContainText("Dibayar dengan GoPay");
  await expect(payment).not.toContainText("daftar harga");

  const steps = card(page, "Status pekerjaan");
  await expect(steps.locator("[data-step='created']")).toHaveAttribute("data-state", "done");
  await expect(steps.locator("[data-step='paid']")).toHaveAttribute("data-state", "done");
  await expect(steps.locator("[data-step='assigned']")).toHaveAttribute("data-state", "done");
  await expect(steps.locator("[data-step='assigned']")).toContainText(/\d{2}\.\d{2}/);
  await expect(steps.locator("[data-step='checkedIn']")).toHaveAttribute("data-state", "done");
  await expect(steps.locator("[data-step='completed']")).toContainText("Belum");
  // Each step carries an icon beside its word, never colour alone.
  await expect(steps.locator("li svg")).toHaveCount(5);
});

test("the help chat about the order opens from the page", async ({ page }) => {
  await page.goto(`/admin/orders/${data.live.active.code}`);
  await page.getByRole("link", { name: "Buka obrolan pelanggan" }).click();
  await expect(page).toHaveURL(/\/admin\/tickets\?ticket=/);
  await expect(page.getByRole("region", { name: "Percakapan dengan pelanggan" }).getByText(question).first()).toBeVisible();
});

test("a disconnected order says so in the chip, the frame and the steps", async ({ page }) => {
  await page.goto(`/admin/orders/${data.live.disconnected.code}`);
  await expect(page.getByRole("status").first()).toHaveText("Terputus");
  const video = card(page, "Siaran langsung");
  await expect(video.getByText("Siaran terputus", { exact: true })).toBeVisible();
  await expect(video).toContainText(/Siaran terputus pukul \d{2}\.\d{2}\./);
  await expect(card(page, "Status pekerjaan").locator("[data-step='disconnected']")).toHaveAttribute("data-state", "problem");
  // No help chat about this order: no chat button, but the customer's card is there all the same.
  await expect(page.getByRole("link", { name: "Buka obrolan pelanggan" })).toHaveCount(0);
  await expect(card(page, "Pelanggan")).toContainText("Uji Pelanggan Pekerjaan");
  // No note and no payment method on this order.
  await expect(card(page, "Detail pesanan")).toContainText("Tidak ada catatan.");
  await expect(card(page, "Pembayaran")).not.toContainText("Dibayar dengan");
});

// 2026-11-20 (UX audit item 18): when the stream drops, admin can call the cleaner from the page.
test("a disconnected order offers to call the cleaner, once their agency has set a phone", async ({ page }) => {
  const admin = adminClient();
  const { data: row } = await admin.from("orders").select("cleaner_id").eq("code", data.live.disconnected.code).single<{ cleaner_id: string }>();
  const cleanerId = row?.cleaner_id ?? "";
  const phone = "+6281298765432";
  try {
    await admin.from("cleaners").update({ phone: null }).eq("user_id", cleanerId);
    await page.goto(`/admin/orders/${data.live.disconnected.code}`);
    await expect(page.getByRole("link", { name: /^Telepon petugas/ })).toHaveCount(0);
    await expect(card(page, "Petugas dan agensi")).toContainText("Agensi belum mengisi nomor HP petugas ini.");

    await admin.from("cleaners").update({ phone }).eq("user_id", cleanerId);
    await page.reload();
    await expect(card(page, "Siaran langsung").getByRole("link", { name: `Telepon petugas ${phone}` })).toHaveAttribute("href", `tel:${phone}`);
    await expect(card(page, "Petugas dan agensi").getByRole("link", { name: `Telepon ${phone}` })).toHaveAttribute("href", `tel:${phone}`);
  } finally {
    await admin.from("cleaners").update({ phone: null }).eq("user_id", cleanerId);
  }
});

test("an order not checked in yet shows its start time and no video", async ({ page }) => {
  await page.goto(`/admin/orders/${data.waiting.code}`);
  await expect(page.getByText("Belum check-in", { exact: true })).toBeVisible();
  const video = card(page, "Siaran langsung");
  await expect(video).toContainText(`Mulai pukul ${jakartaClock(data.waiting.startsAt)} WIB`);
  await expect(video.locator("video")).toHaveCount(0);
  await expect(card(page, "Status pekerjaan").locator("[data-step='checkedIn']")).toHaveAttribute("data-state", "pending");
});

test("a finished order shows when it finished and that it has no recording", async ({ page }) => {
  await page.goto(`/admin/orders/${finishedCode}`);
  await expect(page.getByRole("heading", { level: 1, name: "Pembersihan Rutin" })).toBeVisible();
  const video = card(page, "Siaran langsung");
  await expect(video).toContainText(/Pekerjaan selesai pukul \d{2}\.\d{2}\./);
  await expect(video).toContainText("Pekerjaan ini tidak memiliki rekaman.");
  await expect(card(page, "Status pekerjaan").locator("[data-step='completed']")).toHaveAttribute("data-state", "done");
  // Finished, but the fee row is not written in this test data, so the split is still an estimate.
  await expect(card(page, "Pembayaran")).toContainText("perkiraan");
});

test("an unknown or malformed order number shows a plain message", async ({ page }) => {
  for (const code of ["HK-999999999", "not-an-order"]) {
    await page.goto(`/admin/orders/${code}`);
    await expect(page.getByRole("heading", { level: 2, name: "Pesanan tidak ditemukan" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Kembali ke pemantauan langsung" })).toBeVisible();
  }
});

test("reads in English", async ({ page }) => {
  await page.goto(`/en/admin/orders/${data.live.weak.code}`);
  await expect(page.getByRole("heading", { level: 1, name: "Regular Cleaning" })).toBeVisible();
  await expect(page.getByRole("status").first()).toHaveText("Weak signal");
  await expect(page.getByText(new RegExp(`^Order ${data.live.weak.code}, `))).toBeVisible();
  await expect(card(page, "Job status").locator("[data-step='weak']")).toContainText("Weak signal");
  await expect(card(page, "Payment")).toContainText(/Agency fee \(70%\)\s*\(estimate\)/);
  await expect(card(page, "Order details")).toContainText("No note.");
  await expect(page.getByRole("link", { name: "Back to live monitoring" })).toHaveAttribute("href", "/en/admin/monitor");
});
