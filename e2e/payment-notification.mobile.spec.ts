import { expect, test, type Page } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUsers, type TestUser } from "../tests/integration/test-project";
import { cancelOrder, lateWindow, ordersAt, type Window } from "./booking-test-data";
import { sessionOf } from "./job-test-data";
import { bookSignedIn } from "./order-test-data";
import { notification, notify, orderRow } from "./payment-test-data";
import type { StorageState } from "./setup/auth-state";

// T11 on a phone: Midtrans' payment notification decides the order's status. The test plays Midtrans:
// it POSTs notifications signed with the Sandbox server key to the running app's
// /api/payments/midtrans, exactly as Midtrans does once a Sandbox payment succeeds, fails or expires
// (Midtrans cannot reach this machine). The customer then sees the order's new status. A repeat changes
// nothing, a failed or expired payment gives the window's place back, and a forged notification is
// refused. Test data (e2e/booking-test-data.ts): late windows in Jakarta Barat 6 open days before the
// last, which no other spec books; every order made here is deleted again. The customer is the spec's
// own (made in beforeAll, deleted in afterAll), never the shared one: a customer may hold at most 3 unpaid
// orders (too_many_unpaid), which other specs' open orders on the shared customer could reach in a parallel run.

const area = "jakarta-barat";
const service = "regular";
const day = 6;
const usedStarts: string[] = [];
let customer: TestUser;
let session: StorageState;

async function windowAt(time: string): Promise<Window> {
  const window = await lateWindow(area, time, day);
  usedStarts.push(window.startsAt);
  return window;
}

test.beforeAll(async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  customer = await createTestUser("payn-customer", { full_name: "Uji Pelanggan Notifikasi" });
  session = await sessionOf(browser, baseURL, customer);
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  // An order left by a test that failed half-way: delete it and give its place back.
  if (customer) for (const orderId of await ordersAt(customer.id, area, usedStarts)) await cancelOrder(orderId);
  await deleteTestUsers([customer]);
});

async function placesTaken(slotId: string): Promise<number> {
  const { data } = await adminClient().from("availability_slots").select("booked").eq("id", slotId).single();
  return data?.booked;
}

// Step 3 (D5): "Pembayaran" while the order waits, "Pembayaran berhasil" once it is paid.
const confirmation = (page: Page) => page.getByRole("region", { name: "Pembayaran" });

test.describe("Midtrans' notification, as the customer sees it", () => {
  test.use({ storageState: async ({}, provide) => provide(session) });
  test.describe.configure({ timeout: 90_000 });

  test("a successful payment shows the order as paid, and the same notification again changes nothing", async ({ page, request }) => {
    const orderId = await bookSignedIn(page, service, area, await windowAt("08.00"));
    const { slot_id } = await orderRow(orderId);
    const taken = await placesTaken(slot_id);
    const paid = await notification(orderId, "settlement", "200");

    expect(await notify(request, paid)).toEqual({ status: 200, body: { result: "paid" } });
    await page.reload();
    await expect(confirmation(page).getByText("Sudah dibayar", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bayar sekarang" })).toHaveCount(0);

    expect(await notify(request, paid)).toEqual({ status: 200, body: { result: "paid" } });
    expect((await orderRow(orderId)).status).toBe("paid");
    expect(await placesTaken(slot_id)).toBe(taken);
  });

  test("a failed payment shows the order as failed and gives the window's place back, once", async ({ page, request }) => {
    const orderId = await bookSignedIn(page, service, area, await windowAt("10.00"));
    const { slot_id } = await orderRow(orderId);
    const taken = await placesTaken(slot_id);
    const denied = await notification(orderId, "deny", "202");

    expect(await notify(request, denied)).toEqual({ status: 200, body: { result: "failed" } });
    expect(await notify(request, denied)).toEqual({ status: 200, body: { result: "failed" } });
    await page.reload();
    await expect(confirmation(page).getByText("Pembayaran gagal", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bayar sekarang" })).toHaveCount(0);
    expect(await placesTaken(slot_id)).toBe(taken - 1);
  });

  test("a payment not made in time cancels the order and gives the window's place back", async ({ page, request }) => {
    const orderId = await bookSignedIn(page, service, area, await windowAt("13.00"));
    const { slot_id } = await orderRow(orderId);
    const taken = await placesTaken(slot_id);

    expect(await notify(request, await notification(orderId, "expire", "407"))).toEqual({
      status: 200,
      body: { result: "cancelled" },
    });
    await page.reload();
    await expect(confirmation(page).getByText("Dibatalkan", { exact: true })).toBeVisible();
    expect(await placesTaken(slot_id)).toBe(taken - 1);
  });

  test("a notification not signed by Midtrans is refused and the order keeps waiting for payment", async ({ page, request }) => {
    const orderId = await bookSignedIn(page, service, area, await windowAt("15.00"));
    const forged = await notification(orderId, "settlement", "200", "SB-Mid-server-not-the-real-key");

    expect(await notify(request, forged)).toEqual({ status: 403, body: { error: "signature_invalid" } });
    // A correctly signed notification with another amount is refused too.
    const cheaper = { ...(await notification(orderId, "settlement", "200")), gross_amount: "1000.00" };
    expect((await notify(request, cheaper)).status).toBe(403);

    await page.reload();
    await expect(confirmation(page).getByText("Menunggu pembayaran", { exact: true })).toBeVisible();
    expect((await orderRow(orderId)).status).toBe("pending_payment");
  });
});
