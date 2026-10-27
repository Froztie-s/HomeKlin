import { describe, expect, it } from "vitest";
import { cameBackFromPayment } from "@/components/customer/payment-query";

// The confirmation (T10) tells a customer who comes back from Midtrans' payment page that the payment
// is being confirmed. Midtrans sends them back to /orders?booked=<id> with its own fields added
// (order_id, status_code, transaction_status). The page only reads that the customer came back; what
// those fields claim is never trusted as the payment's result (that arrives with Midtrans' signed
// notification, T11), so the order keeps its status until then.

const booked = "0b8c1f0e-4a5d-4f3c-9a7e-2d1b6c8e9f01";

describe("cameBackFromPayment", () => {
  it("is false right after booking, when the address has only the order", () => {
    expect(cameBackFromPayment({ booked })).toBe(false);
  });

  it("is true when Midtrans added its transaction status", () => {
    expect(cameBackFromPayment({ booked, order_id: booked, status_code: "200", transaction_status: "settlement" })).toBe(true);
  });

  it("is true with only the status code, or only the transaction status", () => {
    expect(cameBackFromPayment({ booked, status_code: "201" })).toBe(true);
    expect(cameBackFromPayment({ booked, transaction_status: "pending" })).toBe(true);
  });

  it("is true whatever the status says, since the browser's word is never the result", () => {
    expect(cameBackFromPayment({ booked, transaction_status: "deny" })).toBe(true);
    expect(cameBackFromPayment({ booked, transaction_status: ["pending", "settlement"] })).toBe(true);
  });

  it("ignores empty fields", () => {
    expect(cameBackFromPayment({ booked, status_code: "", transaction_status: "  " })).toBe(false);
    expect(cameBackFromPayment({ booked, transaction_status: [] })).toBe(false);
    expect(cameBackFromPayment({ booked, transaction_status: undefined })).toBe(false);
  });
});
