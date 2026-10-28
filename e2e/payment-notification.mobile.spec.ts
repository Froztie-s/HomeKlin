import { createHash } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { adminClient } from "../tests/integration/test-project";
import { cancelOrder, lateWindow, ordersAt, type Window } from "./booking-test-data";
import { bookSignedIn } from "./order-test-data";
import { readTestUsers, signedInAs } from "./setup/auth-state";

// T11 on a phone: Midtrans' payment notification decides the order's status. The test plays Midtrans:
// it POSTs notifications signed with the Sandbox server key to the running app's
// /api/payments/midtrans, exactly as Midtrans does once a Sandbox payment succeeds, fails or expires
// (Midtrans cannot reach this machine). The customer then sees the order's new status. A repeat changes
// nothing, a failed or expired payment gives the window's place back, and a forged notification is
// refused. Test data (e2e/booking-test-data.ts): late windows in Jakarta Barat 6 open days before the
// last, which no other spec books; every order made here is deleted again.

const area = "jakarta-barat";
const service = "regular";
const day = 6;
const usedStarts: string[] = [];
const customerId = () => readTestUsers().find((user) => user.role === "customer")?.id;

function serverKey(): string {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) throw new Error("MIDTRANS_SERVER_KEY (Sandbox) is not set: the notification tests sign with it (see .env.example).");
  return key;
}

async function windowAt(time: string): Promise<Window> {
  const window = await lateWindow(area, time, day);
  usedStarts.push(window.startsAt);
  return window;
}

test.afterAll(async () => {
  const id = customerId();
  if (!id) return;
  for (const orderId of await ordersAt(id, area, usedStarts)) await cancelOrder(orderId);
});

async function orderRow(orderId: string) {
  const { data, error } = await adminClient().from("orders").select("status, price_idr, slot_id").eq("id", orderId).single();
  if (error || !data) throw new Error(`Could not read the test order: ${error?.message}`);
  return data as { status: string; price_idr: number; slot_id: string };
}

async function placesTaken(slotId: string): Promise<number> {
  const { data } = await adminClient().from("availability_slots").select("booked").eq("id", slotId).single();
  return data?.booked;
}

/** A notification as Midtrans sends it for this order, signed with the given key. */
async function notification(orderId: string, transactionStatus: string, statusCode: string, key = serverKey()) {
  const amount = `${(await orderRow(orderId)).price_idr}.00`;
  return {
    transaction_time: "2026-10-28 10:15:00",
    transaction_status: transactionStatus,
    transaction_id: crypto.randomUUID(),
    status_message: "midtrans payment notification",
    status_code: statusCode,
    signature_key: createHash("sha512").update(orderId + statusCode + amount + key).digest("hex"),
    payment_type: "bank_transfer",
    order_id: orderId,
    merchant_id: "G000000000",
    gross_amount: amount,
    fraud_status: "accept",
    currency: "IDR",
  };
}

async function notify(request: APIRequestContext, body: object) {
  const response = await request.post("/api/payments/midtrans", { data: body });
  return { status: response.status(), body: await response.json() };
}

const confirmation = (page: Page) => page.getByRole("region", { name: "Pesanan Anda sudah dibuat" });

test.describe("Midtrans' notification, as the customer sees it", () => {
  test.use(signedInAs.customer);
  test.describe.configure({ timeout: 90_000 });

  test("a successful payment shows the order as paid, and the same notification again changes nothing", async ({ page, request }) => {
    const orderId = await bookSignedIn(page, service, area, await windowAt("08.00"));
    const { slot_id } = await orderRow(orderId);
    const taken = await placesTaken(slot_id);
    const paid = await notification(orderId, "settlement", "200");

    expect(await notify(request, paid)).toEqual({ status: 200, body: { result: "paid" } });
    await page.reload();
    await expect(confirmation(page).getByText("Sudah dibayar")).toBeVisible();
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
    await expect(confirmation(page).getByText("Pembayaran gagal")).toBeVisible();
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
    await expect(confirmation(page).getByText("Dibatalkan")).toBeVisible();
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
    await expect(confirmation(page).getByText("Menunggu pembayaran")).toBeVisible();
    expect((await orderRow(orderId)).status).toBe("pending_payment");
  });
});
