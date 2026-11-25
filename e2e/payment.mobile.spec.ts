import { expect, test, type Page } from "@playwright/test";
import { adminClient } from "../tests/integration/test-project";
import { cancelOrder, lateWindow, ordersAt, type Window } from "./booking-test-data";
import { bookSignedIn } from "./order-test-data";
import { notification, notify } from "./payment-test-data";
import { readTestUsers, signedInAs } from "./setup/auth-state";

// T10 on a phone: paying for an order on HomeKlin's own payment step with the Midtrans Sandbox
// (simulated, no real money). From the step (/orders/pay?order=<id>) the customer chooses QRIS, a bank's
// virtual account or a card and presses "Bayar sekarang"; the server charges that method at Midtrans and
// the page shows what to pay with (the QR code, the account number) and keeps showing it after a reload.
// Changing method opens a new attempt and the old one can no longer cancel the order. The order changes
// only by Midtrans' signed notification, played here with the Sandbox key (e2e/payment-test-data.ts).
// The server refuses an order that no longer waits for payment, even when the page still offers it.
// Test data (e2e/booking-test-data.ts): late windows in Jakarta Barat 7 and 8 open days before the
// last, so they never meet the booking specs' (0 to 2) or the order specs' (3 to 5) when all run at
// once; every order made here is deleted again with its place given back.

const area = "jakarta-barat";
const service = "regular";
// Starting a payment asks Midtrans for a charge.
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

// The card's own button comes first; the phone bar (./booking-bar.tsx, 2026-11-20) repeats it below.
const payButton = (page: Page) => page.getByRole("button", { name: "Bayar sekarang" }).first();
// Step 3 of ordering (D5, mock Customer-Payment).
const confirmation = (page: Page) => page.getByRole("region", { name: "Pembayaran" });
const book = (page: Page, window: Window) => bookSignedIn(page, service, area, window);

async function payment(orderId: string) {
  const { data } = await adminClient().from("orders").select("status, payment_attempt, payment_details").eq("id", orderId).single();
  return data as { status: string; payment_attempt: number; payment_details: Record<string, string> | null };
}

/** Waits until React has taken over the page (hydration), so a press runs the handler in place. */
async function hydrated(page: Page) {
  await page.getByRole("radio", { name: /QRIS/ }).evaluate(
    (input) =>
      new Promise<void>((resolve) => {
        const ready = () => Object.keys(input).some((key) => key.startsWith("__reactFiber"));
        const check = () => (ready() ? resolve() : requestAnimationFrame(check));
        check();
      }),
  );
}

test.describe("as a signed-in customer", () => {
  test.use(signedInAs.customer);
  test.describe.configure({ timeout: 180_000 });

  test("offers the ways to pay on the page, and pays with QRIS, then a bank, changing method in between", async ({ page, request }) => {
    const target = await windowFor("15.00", 7);
    const orderId = await book(page, target);
    try {
      const step = confirmation(page);
      await expect(step.getByText("Menunggu pembayaran", { exact: true })).toBeVisible();
      await expect(step.getByText(/^Rp\s[\d.]+$/)).toBeVisible();
      await expect(page.getByText(/Pembayaran simulasi, tidak ada uang sungguhan/)).toBeVisible();
      await expect(page.getByText("Pembayaran sedang dikonfirmasi")).toHaveCount(0);
      // The three ways, QRIS chosen to begin with; the card option needs Midtrans' public key.
      await expect(page.getByRole("radio", { name: /QRIS/ })).toBeChecked();
      await expect(page.getByRole("radio", { name: /Virtual account/ })).not.toBeChecked();
      await expect(page.getByRole("radio", { name: /Kartu kredit atau debit/ })).not.toBeChecked();
      await hydrated(page);

      // On a phone the card's button is far below the methods: a bar keeps the chosen method, the
      // price and its own "Bayar sekarang" in reach, and steps aside once the card's button is on screen.
      const bar = page.getByRole("region", { name: "Pilihan Anda" });
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(bar).toBeVisible();
      await expect(bar).toContainText("QRIS");
      await page.getByRole("radio", { name: /Virtual account/ }).check();
      await expect(bar).toContainText("Virtual account BCA");
      await page.getByRole("radio", { name: /QRIS/ }).check();
      await payButton(page).scrollIntoViewIfNeeded();
      await expect(bar).toHaveCount(0);
      await expect(page.getByTestId("booking-bar")).toHaveAttribute("data-shown", "false");

      // 1. QRIS: the QR code appears on this page, and nothing took the customer to Midtrans.
      await payButton(page).click();
      await expect(page.getByRole("heading", { name: "Scan kode QR untuk membayar" })).toBeVisible({ timeout: paymentWait });
      await expect(page.getByRole("img", { name: "Kode QRIS untuk membayar pesanan ini" })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/orders/pay\\?order=${orderId}`));
      let state = await payment(orderId);
      expect(state).toMatchObject({ status: "pending_payment", payment_attempt: 1, payment_details: { method: "qris" } });
      await expect(payButton(page)).toHaveCount(0);

      // A reload shows the same payment, not a second charge.
      await page.reload();
      await expect(page.getByRole("heading", { name: "Scan kode QR untuk membayar" })).toBeVisible();
      expect((await payment(orderId)).payment_attempt).toBe(1);

      // 2. Changing method: the choices come back, and the QRIS charge is left behind.
      await page.getByRole("button", { name: "Ganti cara bayar" }).click();
      await expect(page.getByRole("radio", { name: /QRIS/ })).toBeVisible({ timeout: paymentWait });
      state = await payment(orderId);
      expect(state).toMatchObject({ payment_attempt: 2, payment_details: null });

      // 3. A virtual account at BNI: its number is on the page and kept on the order.
      await hydrated(page);
      await page.getByRole("radio", { name: /Virtual account/ }).check();
      await page.getByRole("radio", { name: "BNI" }).check();
      await payButton(page).click();
      await expect(page.getByRole("heading", { name: "Transfer ke virtual account BNI" })).toBeVisible({ timeout: paymentWait });
      state = await payment(orderId);
      expect(state).toMatchObject({ payment_attempt: 3, payment_details: { method: "bank", bank: "bni" } });
      const number = state.payment_details?.vaNumber ?? "";
      expect(number).toMatch(/^\d{10,}$/);
      await expect(page.getByText(number, { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Buka simulator Midtrans" })).toHaveAttribute("href", /simulator\.sandbox\.midtrans\.com/);

      // The cancellation of the QRIS charge (attempt 1) arrives late: the order keeps waiting.
      const late = await notify(request, await notification(orderId, "cancel", "200", undefined, `${orderId}_1`));
      expect(late).toEqual({ status: 200, body: { result: "pending_payment" } });
      expect((await payment(orderId)).status).toBe("pending_payment");

      // Midtrans reports the payment of the current attempt: this page turns into the confirmation by itself.
      const paid = await notify(request, await notification(orderId, "settlement", "200", undefined, `${orderId}_3`));
      expect(paid).toEqual({ status: 200, body: { result: "paid" } });
      await expect(page.getByRole("heading", { name: "Pembayaran berhasil" }).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText("Virtual account", { exact: true }).first()).toBeVisible();
    } finally {
      await cancelOrder(orderId);
    }
  });

  test("pays with a card: the number goes to Midtrans only, the server gets a token", async ({ page }) => {
    const target = await windowFor("13.00", 7);
    const orderId = await book(page, target);
    try {
      await hydrated(page);
      await page.getByRole("radio", { name: /Kartu kredit atau debit/ }).check();

      // Fields that do not look like a card are refused on the page, before Midtrans is asked.
      await page.getByLabel("Nomor kartu").fill("4811");
      await payButton(page).click();
      await expect(page.getByRole("alert").filter({ hasText: "Isi nomor kartu, tanggal berlaku, dan CVV dengan benar" })).toBeVisible();
      expect((await payment(orderId)).payment_attempt).toBe(0);

      // Midtrans' test card, with a future expiry.
      const sent: string[] = [];
      page.on("request", (request) => {
        if (request.method() === "POST") sent.push(request.postData() ?? "");
      });
      await page.getByLabel("Nomor kartu").fill("4811 1111 1111 1114");
      await page.getByLabel("Berlaku sampai (BB/TT)").fill("12/30");
      await page.getByLabel("CVV").fill("123");
      await payButton(page).click();

      // The bank's check opens over the page (or, when the bank asks nothing more, the card is processed).
      await expect(page.getByRole("dialog", { name: "Verifikasi kartu dari bank" }).or(page.getByRole("heading", { name: "Pembayaran kartu sedang diproses" }))).toBeVisible({
        timeout: paymentWait,
      });
      const state = await payment(orderId);
      expect(state).toMatchObject({ payment_attempt: 1, payment_details: { method: "card" } });
      // Nothing HomeKlin received (the form's action, any request it made) holds the card number or CVV.
      expect(sent.join("\n")).not.toMatch(/4811\s?1111\s?1111\s?1114/);
      // The order changes only by Midtrans' signed notification.
      expect(["pending_payment", "paid"]).toContain(state.status);
    } finally {
      await cancelOrder(orderId);
    }
  });

  test("refuses an order that stopped waiting for payment while the page was open", async ({ page }) => {
    // Another customer's order and the attempt limit are refused by the database and by the action
    // (tests/integration/payment-attempts.test.ts, tests/payment-actions.test.ts): the page has no order
    // id to change any more, so what remains to check here is the page itself.
    const own = await windowFor("10.00", 7);
    const orderId = await book(page, own);
    try {
      await hydrated(page);
      await adminClient().from("orders").update({ status: "cancelled" }).eq("id", orderId);
      await payButton(page).click();
      await expect(page.getByRole("alert").filter({ hasText: "Pesanan ini tidak lagi menunggu pembayaran" })).toBeVisible({ timeout: paymentWait });
      expect((await payment(orderId)).payment_attempt).toBe(0);
      // Once reloaded, the page shows the status and no payment button.
      await page.reload();
      await expect(confirmation(page).getByText("Dibatalkan", { exact: true })).toBeVisible();
      await expect(payButton(page)).toHaveCount(0);
    } finally {
      await cancelOrder(orderId);
    }
  });

  test("offers the payment in English, without sideways scrolling at 360 px", async ({ page }) => {
    const target = await windowFor("08.00", 7);
    const orderId = await book(page, target);
    try {
      await page.setViewportSize({ width: 360, height: 740 });
      for (const prefix of ["", "/en"]) {
        await page.goto(`${prefix}/orders/pay?order=${orderId}&status_code=200&transaction_status=settlement`);
        await expect(page.getByRole("button", { name: prefix ? "Pay now" : "Bayar sekarang" }).first()).toBeVisible();
        // Every way is open to read at this width, the card's fields included.
        await page.getByRole("radio", { name: /Kartu|card/i }).check();
        await expect(page.getByLabel(prefix ? "Card number" : "Nomor kartu")).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      }
      const card = page.getByRole("region", { name: "Payment" });
      await expect(card.getByText("Awaiting payment", { exact: true })).toBeVisible();
      await expect(page.getByText(/Simulated payment, no real money/)).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "Your payment is being confirmed" })).toBeVisible();
    } finally {
      await cancelOrder(orderId);
    }
  });
});
