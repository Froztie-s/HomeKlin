import { expect, test, type Page } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUsers, type TestUser } from "../tests/integration/test-project";
import { cancelOrder, lateWindow, ordersAt, type Window } from "./booking-test-data";
import { orderPath } from "./order-test-data";
import { readTestUsers, signedInAs } from "./setup/auth-state";

// T10 on a phone: paying for an order with the Midtrans Sandbox (simulated, no real money). From the
// confirmation (/orders?booked=<id>) "Bayar sekarang" opens Midtrans' payment page; a customer who
// comes back before paying is told the payment is being confirmed and is sent to the same transaction
// again. The order keeps "Menunggu pembayaran" until Midtrans' signed notification (T11). The server
// refuses another customer's order and an order that no longer waits for payment, even when the
// browser sends one. Nothing on Midtrans' page is touched: the test only checks that it opened.
// Test data (e2e/booking-test-data.ts): late windows in Jakarta Barat 7 and 8 open days before the
// last, so they never meet the booking specs' (0 to 2) or the order specs' (3 to 5) when all run at
// once; every order made here is deleted again with its place given back.

const area = "jakarta-barat";
const service = "regular";
const address = "Jl. Contoh Raya No. 12, RT 03/RW 05, Kembangan, Jakarta Barat";
const phone = "0812 3456 7890";
const sandboxPage = /^https:\/\/app\.sandbox\.midtrans\.com\/snap\//;
// Starting a payment asks Midtrans for a transaction, and Midtrans' page then has to load.
const paymentWait = 30_000;

const usedStarts: string[] = [];
const customerId = () => readTestUsers().find((user) => user.role === "customer")?.id;

async function windowFor(time: string, daysBack: number): Promise<Window> {
  const window = await lateWindow(area, time, daysBack);
  usedStarts.push(window.startsAt);
  return window;
}

test.afterAll(async () => {
  // An order left by a test that failed half-way: delete it and give its place back.
  const id = customerId();
  if (!id) return;
  for (const orderId of await ordersAt(id, area, usedStarts)) await cancelOrder(orderId);
});

const payButton = (page: Page) => page.getByRole("button", { name: "Bayar sekarang" });
const confirmation = (page: Page) => page.getByRole("region", { name: "Pesanan Anda sudah dibuat" });

/** Books the window as the signed-in customer, the way a customer does, and returns the order's id. */
async function book(page: Page, window: Window): Promise<string> {
  await page.goto(orderPath(service, area, window.startsAt));
  await page.getByLabel("Alamat lengkap").fill(address);
  await page.getByLabel("Nomor HP").fill(phone);
  await page.getByRole("switch", { name: /Saya setuju/ }).check();
  await page.getByRole("button", { name: "Pesan sekarang" }).click();
  // Booking and the redirect run on the server; under a full parallel run that can take over 5 s.
  await expect(page).toHaveURL(/\/orders\?booked=[0-9a-f-]{36}$/, { timeout: 15_000 });
  return new URL(page.url()).searchParams.get("booked") ?? "";
}

/** Waits until React has taken over the payment form (hydration), so a press runs the action in place. */
async function formReady(page: Page) {
  await page.locator('input[name="orderId"]').evaluate(
    (input) =>
      new Promise<void>((resolve) => {
        const hydrated = () => Object.keys(input).some((key) => key.startsWith("__reactFiber"));
        const check = () => (hydrated() ? resolve() : requestAnimationFrame(check));
        check();
      }),
  );
}

/**
 * Makes the payment form send another order's id, as a tampered browser would. Waits for hydration
 * first, which would write the real id back into the hidden field.
 */
async function sendOrderIdInstead(page: Page, orderId: string) {
  await formReady(page);
  await page.locator('input[name="orderId"]').evaluate((input, id) => {
    (input as HTMLInputElement).value = id;
  }, orderId);
}

/** Presses "Bayar sekarang" and waits for Midtrans' Sandbox payment page; returns its address. */
async function pay(page: Page): Promise<string> {
  await formReady(page);
  await payButton(page).click();
  await page.waitForURL(sandboxPage, { timeout: paymentWait, waitUntil: "domcontentloaded" });
  return page.url();
}

test.describe("as a signed-in customer", () => {
  test.use(signedInAs.customer);
  test.describe.configure({ timeout: 120_000 });

  test("pays from the confirmation on Midtrans' Sandbox page, and comes back to the same payment", async ({ page }) => {
    const target = await windowFor("15.00", 7);
    const orderId = await book(page, target);
    try {
      // The confirmation offers the payment: the total, where it happens, and that no real money moves.
      const card = confirmation(page);
      await expect(card.getByText("Menunggu pembayaran")).toBeVisible();
      await expect(card.getByText(/^Rp\s[\d.]+$/)).toBeVisible();
      await expect(card.getByText(/halaman pembayaran aman Midtrans/)).toBeVisible();
      await expect(card.getByText(/Pembayaran simulasi, tidak ada uang sungguhan/)).toBeVisible();
      await expect(card.getByText(/Pembayaran akan segera dapat dilakukan/)).toHaveCount(0);
      // Right after booking nothing is being confirmed yet.
      await expect(page.getByText("Pembayaran sedang dikonfirmasi")).toHaveCount(0);

      const first = await pay(page);
      expect(first).toMatch(sandboxPage);

      // Back on HomeKlin the way Midtrans sends the customer back: the order still waits, and the page
      // says the payment is being confirmed instead of claiming it is paid.
      await page.goto(`/orders?booked=${orderId}&order_id=${orderId}&status_code=201&transaction_status=pending`);
      const note = page.getByRole("status").filter({ hasText: "Pembayaran sedang dikonfirmasi" });
      await expect(note).toBeVisible();
      await expect(note).toContainText("Status pesanan ini akan berubah dalam beberapa saat");
      await expect(confirmation(page).getByText("Menunggu pembayaran")).toBeVisible();
      await expect(confirmation(page).getByText(/^(Sudah dibayar|Lunas)$/)).toHaveCount(0);

      // Pressing again leads to the same transaction, not a second one.
      const second = await pay(page);
      expect(second).toBe(first);

      const { data } = await adminClient().from("orders").select("status, payment_url").eq("id", orderId).single();
      expect(data?.status).toBe("pending_payment");
      expect(data?.payment_url).toBe(first);
    } finally {
      await cancelOrder(orderId);
    }
  });

  test("cannot pay another customer's order, nor an order that no longer waits for payment", async ({ page }) => {
    const own = await windowFor("10.00", 7);
    const theirs = await lateWindow(area, "13.00", 8);
    let other: TestUser | undefined;
    let otherOrder = "";
    const orderId = await book(page, own);
    try {
      other = await createTestUser("t10-other", { full_name: "Uji Pelanggan Lain" });
      const booked = await other.client.rpc("book_slot", {
        p_service: service,
        p_area: area,
        p_starts_at: theirs.startsAt,
        p_address: address,
        p_phone: "+6281234567891",
        p_consent: true,
      });
      expect(booked.error).toBeNull();
      otherOrder = (booked.data as { order_id: string }[])[0].order_id;

      // The browser sends the other customer's order instead of its own: the server finds no such
      // order for this customer, and nothing is started for it.
      await expect(payButton(page)).toBeVisible();
      await sendOrderIdInstead(page, otherOrder);
      await payButton(page).click();
      const alert = page.getByRole("alert").filter({ hasText: "Pesanan ini tidak ditemukan di akun Anda" });
      await expect(alert).toBeVisible({ timeout: paymentWait });
      await expect(page).toHaveURL(/\/orders\?booked=/);
      await expect(payButton(page)).toBeEnabled();
      const theirRow = await adminClient().from("orders").select("payment_url").eq("id", otherOrder).single();
      expect(theirRow.data?.payment_url).toBeNull();

      // The own order stops waiting for payment while the page is open: the server refuses it.
      await page.reload();
      await formReady(page);
      await adminClient().from("orders").update({ status: "cancelled" }).eq("id", orderId);
      await payButton(page).click();
      await expect(page.getByRole("alert").filter({ hasText: "Pesanan ini tidak lagi menunggu pembayaran" })).toBeVisible({
        timeout: paymentWait,
      });
      // Once reloaded, the page shows the status and no payment button.
      await page.reload();
      await expect(confirmation(page).getByText("Dibatalkan")).toBeVisible();
      await expect(payButton(page)).toHaveCount(0);
    } finally {
      await cancelOrder(orderId);
      if (otherOrder) await cancelOrder(otherOrder);
      await deleteTestUsers([other]);
    }
  });

  test("offers the payment in English, without sideways scrolling at 360 px", async ({ page }) => {
    const target = await windowFor("08.00", 7);
    const orderId = await book(page, target);
    try {
      await page.setViewportSize({ width: 360, height: 740 });
      for (const prefix of ["", "/en"]) {
        await page.goto(`${prefix}/orders?booked=${orderId}&status_code=200&transaction_status=settlement`);
        await expect(page.getByRole("button", { name: prefix ? "Pay now" : "Bayar sekarang" })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      }
      const card = page.getByRole("region", { name: "Your order has been placed" });
      await expect(card.getByText("Awaiting payment")).toBeVisible();
      await expect(card.getByText(/Midtrans’ secure payment page/)).toBeVisible();
      await expect(card.getByText(/Simulated payment, no real money/)).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "Your payment is being confirmed" })).toBeVisible();
    } finally {
      await cancelOrder(orderId);
    }
  });
});
