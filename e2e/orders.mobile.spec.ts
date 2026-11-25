import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUsers, type TestUser } from "../tests/integration/test-project";
import { agencyMarks, cancelOrder, dayText, lateWindow, windowText, type Window } from "./booking-test-data";
import { historyMonths, openHistoryMonthOf } from "./history-months";
import { signInWithPassword } from "./order-test-data";
import { notification, notify } from "./payment-test-data";
import type { StorageState } from "./setup/auth-state";

// T12 on a phone: the customer's own orders, each with its status, and a paid order shows its job slot.
// Since 2026-11-20 they are on two pages: /home lists the orders still to come under "Akan datang"
// (waiting for payment or for the job, the soonest first), and /orders is "Riwayat pesanan" (finished,
// failed, cancelled, or a window that has passed; one month at a time, ?bulan=2026-11, the latest job
// first, with a filter kept in the address as ?filter=selesai or ?filter=tidak-jadi). A row opens the
// order on /orders?order=<id>, which never says the order was just made; step 3 of booking,
// /orders/pay?order=<id>, is the payment, the confirmation and Midtrans' return (its old address
// /orders?booked=<id> leads there). An id the customer has no order with reveals nothing.
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
const backLink = (page: Page) => page.getByRole("link", { name: "Kembali ke riwayat pesanan" });
const backHome = (page: Page) => page.getByRole("link", { name: "Kembali ke Beranda" });

test("a customer without orders sees the empty states", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: "Pesanan Anda" })).toBeVisible();
  await expect(page.getByText("Belum ada pesanan", { exact: true })).toBeVisible();
  await expect(ordersList(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Riwayat pesanan/ })).toHaveCount(0);
  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Riwayat pesanan" })).toBeVisible();
  await expect(page.getByText("Belum ada riwayat pesanan")).toBeVisible();
  await expect(page.locator('a[href^="/orders?order="]')).toHaveCount(0);
});

test.describe("with an order of each status", () => {
  const ids = { waiting: "", paid: "", failed: "", cancelled: "", past: "", off: "", others: "" };
  const windows: Partial<Record<"waiting" | "paid" | "failed" | "cancelled" | "off", Window>> = {};
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
    windows.off = await lateWindow(area, "10.00", 1);

    // The order of booking matters: the list shows the newest first. Each outcome is applied right after
    // its booking, because a customer may hold at most 3 unpaid orders (T34 security review, M2).
    const settle = async (id: string, [status, code]: readonly [string, string]) => {
      expect((await notify(request, await notification(id, status, code))).status).toBe(200);
      return id;
    };
    ids.past = await settle(await book(customer, await lateWindow(area, "08.00", 1), addressOf("Lampau")), midtransOutcome.paid);
    ids.off = await book(customer, windowOf("off"), addressOf("Dimatikan"));
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

  const hrefsOf = (page: Page, name?: string) =>
    ordersList(page, name)
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  const historyHrefs = (page: Page) =>
    page.locator('main a[href*="/orders?order="]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  const filterLink = (page: Page, name: string) => page.getByRole("navigation", { name: "Saring riwayat" }).getByRole("link", { name: new RegExp(`^${name}`) });

  test("the home lists the orders still to come under Akan datang, the soonest first", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Akan datang" })).toBeVisible();
    await expect(ordersList(page).getByRole("listitem")).toHaveCount(3);
    const soonest = (["waiting", "paid", "off"] as const).toSorted(
      (a, b) => Date.parse(windowOf(a).startsAt) - Date.parse(windowOf(b).startsAt),
    );
    expect(await hrefsOf(page)).toEqual(soonest.map((name) => `/orders?order=${ids[name]}`));

    for (const [id, word] of [
      [ids.waiting, "Menunggu pembayaran"],
      [ids.paid, "Sudah dibayar"],
    ]) {
      const row = rowOf(page, id);
      await expect(row.getByText(word, { exact: true })).toBeVisible();
      await expect(row.getByText(service.name, { exact: true })).toBeVisible();
      await expect(row.getByText(/^Rp\s[\d.]+$/)).toBeVisible();
    }
    await expect(rowOf(page, ids.waiting)).toContainText(arrival(windowOf("waiting")));
    // The finished ones are only linked, to their own page.
    for (const id of [ids.failed, ids.cancelled, ids.past]) await expect(rowOf(page, id)).toHaveCount(0);
    await page.getByRole("link", { name: /^Riwayat pesanan/ }).click();
    await expect(page).toHaveURL("/orders");
  });

  test("Riwayat pesanan holds the failed, cancelled and passed orders, one month at a time, with a filter", async ({ page }) => {
    await page.goto("/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Riwayat pesanan" })).toBeVisible();
    await expect(page.getByText("3 pesanan masih berjalan.")).toBeVisible();
    // The latest month opens first: the failed and cancelled orders' windows are still to come, the
    // passed order's window is 40 days back, in an earlier month.
    expect(await historyHrefs(page)).toEqual([ids.cancelled, ids.failed].map((id) => `/orders?order=${id}`));
    const months = await historyMonths(page);
    expect(months).toHaveLength(2);
    await expect(page.getByLabel("Pilih bulan")).toHaveValue(months[0]);
    for (const [id, word] of [
      [ids.failed, "Pembayaran gagal"],
      [ids.cancelled, "Dibatalkan"],
    ]) {
      await expect(rowOf(page, id).getByText(word, { exact: true })).toBeVisible();
    }
    await expect(rowOf(page, ids.failed)).toContainText(`${windowText(windowOf("failed"))} WIB`);

    // The arrow and the select both change the month, kept in the address.
    await page.getByRole("link", { name: /^Bulan sebelumnya/ }).click();
    await expect(page).toHaveURL(`/orders?bulan=${months[1]}`);
    expect(await historyHrefs(page)).toEqual([`/orders?order=${ids.past}`]);
    // Paid, but its window passed with no check-in: the pill says where the order is (order-stage.ts).
    await expect(rowOf(page, ids.past).getByText("Tidak terlaksana", { exact: true })).toBeVisible();
    await page.getByLabel("Pilih bulan").selectOption(months[0]);
    await expect(page).toHaveURL(`/orders?bulan=${months[0]}`);
    await expect(rowOf(page, ids.failed)).toBeVisible();

    await expect(filterLink(page, "Semua")).toHaveAttribute("aria-current", "page");
    await filterLink(page, "Tidak jadi").click();
    await expect(page).toHaveURL(`/orders?filter=tidak-jadi&bulan=${months[0]}`);
    await expect(filterLink(page, "Tidak jadi")).toHaveAttribute("aria-current", "page");
    expect(await historyHrefs(page)).toEqual([ids.cancelled, ids.failed].map((id) => `/orders?order=${id}`));
    await filterLink(page, "Selesai").click();
    await expect(page.getByText("Tidak ada pesanan di sini")).toBeVisible();
    expect(await historyHrefs(page)).toEqual([]);

    // Back from an order, the same filter and month are open.
    await filterLink(page, "Tidak jadi").click();
    await rowOf(page, ids.failed).click();
    await expect(page).toHaveURL(`/orders?order=${ids.failed}`);
    await page.goBack();
    await expect(page).toHaveURL(/\/orders\?filter=tidak-jadi/);
    await expect(rowOf(page, ids.failed)).toBeVisible();
  });

  test("a paid order shows its job slot on a labelled line; the others do not", async ({ page }) => {
    await page.goto("/home");
    const slot = rowOf(page, ids.paid).getByTestId("job-slot");
    await expect(slot).toContainText("Jadwal kedatangan");
    await expect(slot).toContainText(arrival(windowOf("paid")));
    await expect(rowOf(page, ids.waiting).getByTestId("job-slot")).toHaveCount(0);
  });

  test("a past order shows its real date, and a switched-off service the fallback name", async ({ page }) => {
    await openHistoryMonthOf(page, ids.past);
    const row = rowOf(page, ids.past);
    await expect(row).toBeVisible();
    await expect(row).toContainText(`${windowText(past)} WIB`);
    await expect(row).not.toContainText(/Hari ini|Besok/);
    await page.goto("/home");
    await expect(rowOf(page, ids.off).getByText("Layanan HomeKlin", { exact: true })).toBeVisible();
    await expect(page.getByText("Layanan Uji Nonaktif")).toHaveCount(0);
  });

  test("a row opens the order's details, which do not say it was just made, and leads back", async ({ page }) => {
    await page.goto("/home");
    await rowOf(page, ids.paid).click();
    await expect(page).toHaveURL(`/orders?order=${ids.paid}`);
    const details = page.getByRole("region", { name: "Detail pesanan" });
    await expect(details.getByText("Sudah dibayar")).toBeVisible();
    await expect(details.getByText(addressOf("Lunas"))).toBeVisible();
    await expect(details.getByText(arrival(windowOf("paid")))).toBeVisible();
    await expect(page.getByRole("region", { name: "Pembayaran" })).toHaveCount(0);
    await expect(details.getByRole("button", { name: "Bayar sekarang" })).toHaveCount(0);

    // A paid order still to come is listed on the home, so its way back leads there.
    await backHome(page).click();
    await expect(page).toHaveURL("/home");
    await expect(ordersList(page)).toBeVisible();
  });

  test("a finished order leads back to the history", async ({ page }) => {
    await page.goto(`/orders?order=${ids.past}`);
    await backLink(page).click();
    await expect(page).toHaveURL("/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Riwayat pesanan" })).toBeVisible();
  });

  test("a waiting order still leads to paying from its details (step 3 lets the customer choose how)", async ({ page }) => {
    await page.goto(`/orders?order=${ids.waiting}`);
    const details = page.getByRole("region", { name: "Detail pesanan" });
    await expect(details.getByText("Menunggu pembayaran")).toBeVisible();
    await details.getByRole("link", { name: "Bayar sekarang" }).click();
    await expect(page).toHaveURL(`/orders/pay?order=${ids.waiting}`);
    await expect(page.getByRole("button", { name: "Bayar sekarang" }).first()).toBeVisible();
  });

  test("a failed order's details do not promise the slot", async ({ page }) => {
    await page.goto(`/orders?order=${ids.failed}`);
    const details = page.getByRole("region", { name: "Detail pesanan" });
    await expect(details.getByText("Pembayaran gagal")).toBeVisible();
    await expect(details.getByText("sudah kami simpan")).toHaveCount(0);
    await expect(details.getByText("Setelah pembayaran")).toHaveCount(0);
  });

  test("the confirmation stays as it was, Midtrans' return included, and leads to the list", async ({ page }) => {
    // The old address (in emails already sent) opens the payment page.
    await page.goto(`/orders?booked=${ids.waiting}`);
    await expect(page).toHaveURL(`/orders/pay?order=${ids.waiting}`);
    const confirmation = page.getByRole("region", { name: "Pembayaran" });
    await expect(confirmation.getByText("Menunggu pembayaran")).toBeVisible();
    await expect(confirmation.getByRole("button", { name: "Bayar sekarang" }).first()).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Pembayaran sedang dikonfirmasi" })).toHaveCount(0);

    await page.goto(`/orders?booked=${ids.waiting}&order_id=${ids.waiting}&status_code=201&transaction_status=pending`);
    await expect(page).toHaveURL(`/orders/pay?order=${ids.waiting}&order_id=${ids.waiting}&status_code=201&transaction_status=pending`);
    await expect(page.getByRole("status").filter({ hasText: "Pembayaran sedang dikonfirmasi" })).toBeVisible();

    // The booking flow's header leads to the home, where the placed order waits (2026-11-20).
    await page.getByRole("banner").getByRole("link", { name: "Ke pesanan Anda" }).click();
    await expect(page).toHaveURL("/home");
    await expect(ordersList(page)).toBeVisible();
  });

  test("another customer's order is not listed, and its id or an unknown id reveals nothing", async ({ page }) => {
    for (const path of ["/home", "/orders"]) {
      await page.goto(path);
      await expect(page.locator('main a[href^="/orders?order="]').first()).toBeVisible();
      await expect(rowOf(page, ids.others)).toHaveCount(0);
      expect(await page.content()).not.toContain(ids.others);
    }

    // The order's page shows the list in its place; the payment page (and its old address) leads to it.
    for (const address of ["/orders?order=", "/orders?booked=", "/orders/pay?order="]) {
      for (const id of [ids.others, randomUUID()]) {
        await page.goto(`${address}${id}`);
        if (address === "/orders?order=") {
          // The history page in its place, on its latest month: the failed and cancelled orders.
          await expect(page.locator('main a[href^="/orders?order="]')).toHaveCount(2);
        } else {
          // The payment page (and its old address) leads to the home, with the orders still to come.
          await expect(page).toHaveURL("/home");
          await expect(ordersList(page).getByRole("listitem")).toHaveCount(3);
        }
        await expect(page.getByRole("region", { name: /Detail pesanan|Pembayaran/ })).toHaveCount(0);
        const html = await (await page.request.get(`${address}${id}`)).text();
        for (const text of [await page.content(), html]) expect(text).not.toContain("Rahasia Orang Lain");
      }
    }
  });

  test("works in English, with the status, the slot, the details and the way back", async ({ page }) => {
    await page.goto("/en/home");
    await expect(page.getByRole("heading", { name: "Upcoming" })).toBeVisible();
    await expect(ordersList(page, "Your orders").getByRole("listitem")).toHaveCount(3);
    const paid = rowOf(page, ids.paid, "/en");
    await expect(paid.getByText("Paid", { exact: true })).toBeVisible();
    await expect(paid.getByText(service.nameEn, { exact: true })).toBeVisible();
    await expect(paid.getByTestId("job-slot")).toContainText("Arrival time");
    await expect(paid.getByTestId("job-slot")).toContainText(arrival(windowOf("paid"), "en"));
    await expect(rowOf(page, ids.waiting, "/en").getByText("Awaiting payment", { exact: true })).toBeVisible();
    await expect(rowOf(page, ids.off, "/en").getByText("HomeKlin service", { exact: true })).toBeVisible();

    await page.goto("/en/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Order history" })).toBeVisible();
    await expect(rowOf(page, ids.failed, "/en").getByText("Payment failed", { exact: true })).toBeVisible();
    await expect(rowOf(page, ids.cancelled, "/en").getByText("Cancelled", { exact: true })).toBeVisible();
    await openHistoryMonthOf(page, ids.past, "/en");
    await expect(rowOf(page, ids.past, "/en").getByText("Did not take place", { exact: true })).toBeVisible();
    await page.goto("/en/orders");
    await rowOf(page, ids.failed, "/en").click();
    await page.getByRole("link", { name: "Back to your order history" }).click();
    await expect(page).toHaveURL("/en/orders");

    // An order still to come leads back to the home.
    await page.goto("/en/home");
    await rowOf(page, ids.waiting, "/en").click();
    await expect(page).toHaveURL(`/en/orders?order=${ids.waiting}`);
    const details = page.getByRole("region", { name: "Order details" });
    await expect(details.getByRole("link", { name: "Pay now" })).toBeVisible();
    await page.getByRole("link", { name: "Back to Home" }).click();
    await expect(page).toHaveURL("/en/home");
  });

  test.describe("at 360 px", () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test("the filled list and the details have no sideways scroll and name no agency, in both languages", async ({ page }) => {
      const marks = await agencyMarks();
      for (const prefix of ["", "/en"]) {
        for (const path of [`${prefix}/home`, `${prefix}/orders`, `${prefix}/orders?order=${ids.waiting}`]) {
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
