import { describe, expect, it } from "vitest";
import {
  amountIdr,
  hasValidSignature,
  parseNotification,
  paymentResult,
} from "@/lib/payment/notification";

// Midtrans' payment notification (T11, src/lib/payment/notification.ts): reading the body, checking
// Midtrans' signature, and what each Midtrans status means for the order. The endpoint around it is
// tested in tests/payment-webhook.test.ts, the database side in tests/integration/payment-result.test.ts.

const serverKey = "SB-Mid-server-not-a-real-key";
const orderId = "0b8f3c1e-1111-4222-8333-944455556666";
// SHA-512 of order_id + status_code + gross_amount + server key, computed outside this code with
// `printf %s "<order_id>" "200" "85000.00" "<key>" | sha512sum`.
const signature =
  "570625b8ac5788223e29137a94066f687a4ac1e196263a103e6a2b8ede908325a645df92ae4ad60e1b1f0342ed827280b4621f8030567fb1b284b68741e1eedb";

const body = {
  transaction_time: "2026-10-28 10:15:00",
  transaction_status: "settlement",
  transaction_id: "57d5293c-e65f-4a29-95e4-5959c3fa335b",
  status_message: "midtrans payment notification",
  status_code: "200",
  signature_key: signature,
  payment_type: "bank_transfer",
  order_id: orderId,
  merchant_id: "G000000000",
  gross_amount: "85000.00",
  fraud_status: "accept",
  currency: "IDR",
};

describe("parseNotification", () => {
  it("reads the fields the order needs and lets Midtrans add others", () => {
    expect(parseNotification({ ...body, va_numbers: [{ bank: "bca", va_number: "123" }] })).toEqual({
      orderId,
      statusCode: "200",
      grossAmount: "85000.00",
      signatureKey: signature,
      transactionStatus: "settlement",
      fraudStatus: "accept",
    });
  });

  it("accepts a notification without fraud_status (not every payment method sends one)", () => {
    const { fraud_status: _omitted, ...withoutFraud } = body;
    expect(parseNotification(withoutFraud)?.fraudStatus).toBeUndefined();
  });

  it.each([
    ["no body", null],
    ["a list", [body]],
    ["no signature", { ...body, signature_key: undefined }],
    ["a signature that is not SHA-512 hex", { ...body, signature_key: "abc" }],
    ["an amount that is not a number", { ...body, gross_amount: "85.000,00" }],
    ["a status code that is not three digits", { ...body, status_code: "OK" }],
    ["no transaction status", { ...body, transaction_status: "" }],
    ["an order id that is far too long", { ...body, order_id: "x".repeat(200) }],
  ])("refuses %s", (_case, input) => {
    expect(parseNotification(input)).toBeNull();
  });
});

describe("hasValidSignature", () => {
  const notification = parseNotification(body);
  if (!notification) throw new Error("the sample notification must parse");

  it("accepts Midtrans' signature", () => {
    expect(hasValidSignature(notification, serverKey)).toBe(true);
  });

  it("accepts the same signature in capitals", () => {
    expect(hasValidSignature({ ...notification, signatureKey: signature.toUpperCase() }, serverKey)).toBe(true);
  });

  it("refuses a signature made with another key", () => {
    expect(hasValidSignature(notification, "SB-Mid-server-someone-else")).toBe(false);
  });

  it.each([
    ["order", { orderId: "0b8f3c1e-1111-4222-8333-000000000000" }],
    ["amount", { grossAmount: "1000.00" }],
    ["status code", { statusCode: "201" }],
  ])("refuses the signature when the %s was changed", (_field, change) => {
    expect(hasValidSignature({ ...notification, ...change }, serverKey)).toBe(false);
  });

  it("refuses an empty server key", () => {
    expect(hasValidSignature(notification, "")).toBe(false);
  });
});

describe("paymentResult", () => {
  it.each([
    ["settlement", undefined, "paid"],
    ["settlement", "accept", "paid"],
    ["capture", "accept", "paid"],
    ["capture", undefined, "paid"],
    ["deny", undefined, "failed"],
    ["failure", undefined, "failed"],
    ["capture", "deny", "failed"],
    ["settlement", "deny", "failed"],
    ["cancel", undefined, "cancelled"],
    ["expire", undefined, "cancelled"],
  ] as const)("%s with fraud status %s makes the order %s", (status, fraud, expected) => {
    expect(paymentResult(status, fraud)).toBe(expected);
  });

  it.each([
    ["pending", undefined],
    ["capture", "challenge"],
    ["settlement", "challenge"],
    ["authorize", undefined],
    ["refund", undefined],
    ["partial_refund", undefined],
    ["chargeback", undefined],
    ["something_new", undefined],
  ])("%s with fraud status %s changes nothing yet", (status, fraud) => {
    expect(paymentResult(status, fraud)).toBeNull();
  });
});

describe("amountIdr", () => {
  it.each([
    ["85000.00", 85000],
    ["85000", 85000],
    ["1", 1],
  ])("reads %s as %i rupiah", (input, expected) => {
    expect(amountIdr(input)).toBe(expected);
  });

  it.each(["85000.50", "0.00", "0"])("refuses %s (rupiah have no cents, an order is never free)", (input) => {
    expect(amountIdr(input)).toBeNull();
  });
});
