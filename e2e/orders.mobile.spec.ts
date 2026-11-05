import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUsers, type TestUser } from "../tests/integration/test-project";
import { agencyMarks, cancelOrder, dayText, lateWindow, windowText, type Window } from "./booking-test-data";
import { signInWithPassword } from "./order-test-data";
import { notification, notify } from "./payment-test-data";
import type { StorageState } from "./setup/auth-state";

// T12 on a phone: /orders lists the customer's own orders, newest first, each with its status, and a
// paid order shows its job slot. A row opens the order on /orders?order=<id>, which never says the
// order was just made; /orders?booked=<id> stays the confirmation and Midtrans' return. An id the
// customer has no order with falls back to the list and reveals nothing.
// The spec makes its own customers, so the list holds exactly what it booked, whatever other specs do
// with the shared customer at the same time. The tests build on each other (empty first), so they run
// in order. Paid, failed and cancelled are set with signed notifications (e2e/payment-test-data.ts).
// Test data: late windows in Jakarta Timur, 0 and 1 open days before the last; the other specs book in
// Jakarta Barat only, and the T12 screenshots use days 2 and 3. Every order is deleted again with its
// place given back, and the customers and the switched-off service go with them.

test.describe.configure({ mode: "serial", timeout: 120_000 });

const area = "jakarta-timur";
const service = { id: "regular", name: "Pembersihan Rutin", nameEn: "Regular Cleaning" };
const addressOf = (name: string) => `Jl. Contoh ${name} No. 12, Cakung, Jakarta Timur`;
const agencyWording = /agensi|agency|mitra|partner/i;
const offService = `t12-off-${randomUUID().slice(0, 8)}`;
const midtransOutcome = {
  paid: ["settlement", "200"],
  failed: ["deny", "202"],
  cancelled: ["expire", "407"],
} as const;

let customer: TestUser;
let other: TestUser;
let session: StorageState;
const orders: string[] = [];

test.use({ storageState: async ({}, provide) => provide(session) });

test.beforeAll(async ({ browser, baseURL }) => {
  [customer, other] = await Promise.all([
    createTestUser("t12-customer", { full_name: "Uji Pelanggan" }),
    createTestUser("t12-other", { full_name: "Uji Pelanggan Lain" }),
  ]);
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  await signInWithPassword(await context.newPage(), customer);
  session = await context.storageState();
  await context.close();
});

test.afterAll(async () => {
  for (const id of orders.splice(0)) await cancelOrder(id);
  await adminClient().from("services").delete().eq("id", offService);
  await deleteTestUsers([customer, other]);
});

async function book(user: TestUser, window: Window, address: string): Promise<string> {
  const { data, error } = await user.client.rpc("book_slot", {
    p_service: service.id,
    p_area: area,
    p_starts_at: window.startsAt,
    p_address: address,
    p_phone: "+6281234567891",
    p_consent: true,
  });
  if (error) throw new Error(`Could not book the test order: ${error.message}`);
  const id = (data as { order_id: string }[])[0].order_id;
  orders.push(id);
  return id;
}

const ordersList = (page: Page, name = "Daftar pesanan") => page.getByRole("list", { name });
const rowOf = (page: Page, orderId: string, prefix = "") => page.locator(`a[href="${prefix}/orders?order=${orderId}"]`);
const backLink = (page: Page) => page.getByRole("link", { name: "Kembali ke daftar pesanan" });

test("a customer without orders sees the empty state", async ({ page }) => {
  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Pesanan" })).toBeVisible();
  await expect(page.getByText("Belum ada pesanan")).toBeVisible();
  await expect(ordersList(page)).toHaveCount(0);
});

test.describe("with an order of each status", () => {
  const ids = { waiting: "", paid: "", failed: "", cancelled: "", past: "", off: "", others: "" };
  const windows: Partial<Record<"waiting" | "paid" | "failed" | "cancelled", Window>> = {};
  const windowOf = (name: keyof typeof windows): Window => {
    const window = windows[name];
    if (!window) throw new Error(`The ${name} order was not booked`);
    return window;
  };
  const arrival = (window: Window, language: "id" | "en" = "id") =>
    `${dayText(window.startsAt, language)}, ${windowText(window)} WIB`;
  // A whole hour 40 days back, two hours long.
  const pastStart = Math.floor((Date.now() - 40 * 86_400_000) / 3_600_000) * 3_600_000;
  const past: Window = {
    startsAt: new Date(pastStart).toISOString(),
    endsAt: new Date(pastStart + 7_200_000).toISOString(),
  };

  test.beforeAll(async ({ request }) => {
    windows.waiting = await lateWindow(area, "08.00");
    windows.paid = await lateWindow(area, "10.00");
    windows.failed = await lateWindow(area, "13.00");
    windows.cancelled = await lateWindow(area, "15.00");

    // The order of booking matters: the list shows the newest first. Each outcome is applied right after
    // its booking, because a customer may hold at most 3 unpaid orders (T34 security review, M2).
    const settle = async (id: string, [status, code]: readonly [string, string]) => {
      expect((await notify(request, await notification(id, status, code))).status).toBe(200);
      return id;
    };
    ids.past = await settle(await book(customer, await lateWindow(area, "08.00", 1), addressOf("Lampau")), midtransOutcome.paid);
    ids.off = await book(customer, await lateWindow(area, "10.00", 1), addressOf("Dimatikan"));
    ids.cancelled = await settle(await book(customer, windowOf("cancelled"), addressOf("Batal")), midtransOutcome.cancelled);
    ids.failed = await settle(await book(customer, windowOf("failed"), addressOf("Gagal")), midtransOutcome.failed);
    ids.paid = await settle(await book(customer, windowOf("paid"), addressOf("Lunas")), midtransOutcome.paid);
    ids.waiting = await book(customer, windowOf("waiting"), addressOf("Menunggu"));
    ids.others = await book(other, await lateWindow(area, "13.00", 1), addressOf("Rahasia Orang Lain"));

    // An order whose window has passed, and one for a service switched off since booking. The window
    // of the first moves only in the order: its place in the seeded window is given back as usual.
    const admin = adminClient();
    const moved = await admin
      .from("orders")
      .update({ starts_at: past.startsAt, ends_at: past.endsAt })
      .eq("id", ids.past);
    expect(moved.error).toBeNull();
    const added = await admin.from("services").insert({
      id: offService,
      category: "rooms",
      name_id: "Layanan Uji Nonaktif",
      name_en: "Switched Off Test Service",
      description_id: "Layanan uji",
      description_en: "Test service",
      price_idr: 50_000,
      duration_minutes: 60,
      is_active: false,
      sort_order: 9_999,
    });
    expect(added.error).toBeNull();
    const switched = await admin.from("orders").update({ service_id: offService }).eq("id", ids.off);
    expect(switched.error).toBeNull();
  });

  test.afterAll(async () => {
    // The order first: it holds the switched-off service.
    if (ids.off) await cancelOrder(ids.off);
  });

  test("lists every order newest first, each with the right status word", async ({ page }) => {
    await page.goto("/orders");
    const list = ordersList(page);
    await expect(list.getByRole("listitem")).toHaveCount(6);
    const hrefs = await list.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs).toEqual(
      [ids.waiting, ids.paid, ids.failed, ids.cancelled, ids.off, ids.past].map((id) => `/orders?order=${id}`),
    );

    for (const [id, word] of [
      [ids.waiting, "Menunggu pembayaran"],
      [ids.paid, "Sudah dibayar"],
      [ids.failed, "Pembayaran gagal"],
      [ids.cancelled, "Dibatalkan"],
    ]) {
      const row = rowOf(page, id);
      await expect(row.getByText(word, { exact: true })).toBeVisible();
      await expect(row.getByText(service.name, { exact: true })).toBeVisible();
      await expect(row.getByText(/^Rp\s[\d.]+$/)).toBeVisible();
    }
    await expect(rowOf(page, ids.waiting)).toContainText(arrival(windowOf("waiting")));
    await expect(rowOf(page, ids.failed)).toContainText(arrival(windowOf("failed")));
  });

  test("a paid order shows its job slot on a labelled line; the others do not", async ({ page }) => {
    await page.goto("/orders");
    const slot = rowOf(page, ids.paid).getByTestId("job-slot");
    await expect(slot).toContainText("Jadwal kedatangan");
    await expect(slot).toContainText(arrival(windowOf("paid")));
    for (const id of [ids.waiting, ids.failed, ids.cancelled]) {
      await expect(rowOf(page, id).getByTestId("job-slot")).toHaveCount(0);
    }
  });

  test("a past order shows its real date, and a switched-off service the fallback name", async ({ page }) => {
    await page.goto("/orders");
    const row = rowOf(page, ids.past);
    await expect(row).toContainText(arrival(past));
    await expect(row).not.toContainText(/Hari ini|Besok/);
    await expect(rowOf(page, ids.off).getByText("Layanan HomeKlin", { exact: true })).toBeVisible();
    await expect(page.getByText("Layanan Uji Nonaktif")).toHaveCount(0);
  });

  test("a row opens the order's details, which do not say it was just made, and leads back", async ({ page }) => {
    await page.goto("/orders");
    await rowOf(page, ids.paid).click();
    await expect(page).toHaveURL(`/orders?order=${ids.paid}`);
    const details = page.getByRole("region", { name: "Detail pesanan" });
    await expect(details.getByText("Sudah dibayar")).toBeVisible();
    await expect(details.getByText(addressOf("Lunas"))).toBeVisible();
    await expect(details.getByText(arrival(windowOf("paid")))).toBeVisible();
    await expect(page.getByText("Pesanan Anda sudah dibuat")).toHaveCount(0);
    await expect(details.getByRole("button", { name: "Bayar sekarang" })).toHaveCount(0);

    await backLink(page).click();
    await expect(page).toHaveURL("/orders");
    await expect(ordersList(page)).toBeVisible();
  });

  test("a waiting order still offers Bayar sekarang from its details", async ({ page }) => {
    await page.goto(`/orders?order=${ids.waiting}`);
    const details = page.getByRole("region", { name: "Detail pesanan" });
    await expect(details.getByText("Menunggu pembayaran")).toBeVisible();
    await expect(details.getByRole("button", { name: "Bayar sekarang" })).toBeVisible();
  });

  test("a failed order's details do not promise the slot", async ({ page }) => {
    await page.goto(`/orders?order=${ids.failed}`);
    const details = page.getByRole("region", { name: "Detail pesanan" });
    await expect(details.getByText("Pembayaran gagal")).toBeVisible();
    await expect(details.getByText("sudah kami simpan")).toHaveCount(0);
    await expect(details.getByText("Setelah pembayaran")).toHaveCount(0);
  });

  test("the confirmation stays as it was, Midtrans' return included, and leads to the list", async ({ page }) => {
    await page.goto(`/orders?booked=${ids.waiting}`);
    const confirmation = page.getByRole("region", { name: "Pesanan Anda sudah dibuat" });
    await expect(confirmation.getByText("Menunggu pembayaran")).toBeVisible();
    await expect(confirmation.getByRole("button", { name: "Bayar sekarang" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Pembayaran sedang dikonfirmasi" })).toHaveCount(0);

    await page.goto(`/orders?booked=${ids.waiting}&order_id=${ids.waiting}&status_code=201&transaction_status=pending`);
    await expect(page.getByRole("status").filter({ hasText: "Pembayaran sedang dikonfirmasi" })).toBeVisible();

    await backLink(page).click();
    await expect(page).toHaveURL("/orders");
    await expect(ordersList(page)).toBeVisible();
  });

  test("another customer's order is not listed, and its id or an unknown id reveals nothing", async ({ page }) => {
    await page.goto("/orders");
    await expect(ordersList(page)).toBeVisible();
    await expect(rowOf(page, ids.others)).toHaveCount(0);
    expect(await page.content()).not.toContain(ids.others);

    for (const param of ["order", "booked"]) {
      for (const id of [ids.others, randomUUID()]) {
        await page.goto(`/orders?${param}=${id}`);
        await expect(ordersList(page).getByRole("listitem")).toHaveCount(6);
        await expect(page.getByRole("region", { name: /Detail pesanan|Pesanan Anda sudah dibuat/ })).toHaveCount(0);
        const html = await (await page.request.get(page.url())).text();
        for (const text of [await page.content(), html]) expect(text).not.toContain("Rahasia Orang Lain");
      }
    }
  });

  test("works in English, with the status, the slot, the details and the way back", async ({ page }) => {
    await page.goto("/en/orders");
    const list = ordersList(page, "Your orders");
    await expect(list.getByRole("listitem")).toHaveCount(6);
    const paid = rowOf(page, ids.paid, "/en");
    await expect(paid.getByText("Paid", { exact: true })).toBeVisible();
    await expect(paid.getByText(service.nameEn, { exact: true })).toBeVisible();
    await expect(paid.getByTestId("job-slot")).toContainText("Arrival time");
    await expect(paid.getByTestId("job-slot")).toContainText(arrival(windowOf("paid"), "en"));
    await expect(rowOf(page, ids.waiting, "/en").getByText("Awaiting payment", { exact: true })).toBeVisible();
    await expect(rowOf(page, ids.failed, "/en").getByText("Payment failed", { exact: true })).toBeVisible();
    await expect(rowOf(page, ids.cancelled, "/en").getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(rowOf(page, ids.off, "/en").getByText("HomeKlin service", { exact: true })).toBeVisible();

    await rowOf(page, ids.waiting, "/en").click();
    await expect(page).toHaveURL(`/en/orders?order=${ids.waiting}`);
    const details = page.getByRole("region", { name: "Order details" });
    await expect(details.getByRole("button", { name: "Pay now" })).toBeVisible();
    await page.getByRole("link", { name: "Back to your orders" }).click();
    await expect(page).toHaveURL("/en/orders");
  });

  test.describe("at 360 px", () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test("the filled list and the details have no sideways scroll and name no agency, in both languages", async ({ page }) => {
      const marks = await agencyMarks();
      for (const prefix of ["", "/en"]) {
        for (const path of [`${prefix}/orders`, `${prefix}/orders?order=${ids.waiting}`]) {
          await page.context().clearCookies({ name: "NEXT_LOCALE" });
          await page.goto(path);
          await expect(page.getByText(/Rp\s[\d.]+/).first()).toBeVisible();
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow).toBeLessThanOrEqual(0);

          const served = await (await page.request.get(path)).text();
          for (const html of [await page.content(), served]) {
            expect(html).not.toMatch(agencyWording);
            for (const mark of marks) expect(html).not.toContain(mark);
          }
          expect(await page.evaluate(() => document.body.innerText)).not.toMatch(agencyWording);
        }
      }
    });
  });
});
