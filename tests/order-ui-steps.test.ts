import { describe, expect, it } from "vitest";
import { stepAfter } from "@/components/auth/code-steps";
import { intentFor, viewAfter, type OrderView } from "@/components/customer/order-steps";

// The emailed-code screens (T9b): the order form and the sign-in page each have a form step and a
// code step on one page. These pure rules decide which step the page shows after each answer from
// the server, and which action the main button sends.

describe("stepAfter (sign-in by code, and the order's code)", () => {
  it("opens the code step once the code is sent", () => {
    expect(stepAfter("form", "send", { codeSent: true })).toBe("code");
    expect(stepAfter("code", "resend", { codeSent: true })).toBe("code");
  });

  it("stays on the code step for a wrong code", () => {
    expect(stepAfter("code", "verify", { codeSent: true, formError: "codeInvalid" })).toBe("code");
    expect(stepAfter("code", "verify", { codeSent: true, fieldErrors: { code: "codeInvalid" } })).toBe("code");
  });

  it("goes back to the form when a field of the form has to be fixed", () => {
    expect(stepAfter("form", "send", { fieldErrors: { email: "emailInvalid" } })).toBe("form");
    expect(stepAfter("code", "resend", { fieldErrors: { email: "emailInvalid" } })).toBe("form");
  });

  it("keeps the step for a problem that is not the visitor's to fix (too many tries, a fault)", () => {
    expect(stepAfter("form", "send", { formError: "rateLimited" })).toBe("form");
    expect(stepAfter("code", "resend", { formError: "rateLimited" })).toBe("code");
    expect(stepAfter("code", "verify", { formError: "unavailable" })).toBe("code");
  });

  it("changes nothing before the first answer", () => {
    expect(stepAfter("form", "send", null)).toBe("form");
  });
});

describe("the order's steps", () => {
  const guestForm: OrderView = { step: "form", signedIn: false };
  const guestCode: OrderView = { step: "code", signedIn: false };
  const customer: OrderView = { step: "form", signedIn: true };

  it("sends the code for a guest, places the order on the code step, books for a customer", () => {
    expect(intentFor(guestForm)).toBe("send");
    expect(intentFor(guestCode)).toBe("place");
    expect(intentFor(customer)).toBe("book");
  });

  it("moves a guest to the code step and keeps them there for a wrong code", () => {
    expect(viewAfter(guestForm, "send", { codeSent: true })).toEqual(guestCode);
    expect(viewAfter(guestCode, "place", { codeSent: true, fieldErrors: { code: "codeInvalid" } })).toEqual(guestCode);
    expect(viewAfter(guestCode, "resend", { codeSent: true })).toEqual(guestCode);
  });

  it("switches to the signed-in path when the code was right but the order failed", () => {
    expect(viewAfter(guestCode, "place", { signedIn: true, formError: "slotUnavailable" })).toEqual(customer);
  });

  it("keeps a signed-in customer on the form whatever the answer", () => {
    expect(viewAfter(customer, "book", { formError: "slotUnavailable" })).toEqual(customer);
    expect(viewAfter(customer, "book", { fieldErrors: { phone: "phoneInvalid" } })).toEqual(customer);
  });

  it("goes back to the form when the order itself has a problem", () => {
    expect(viewAfter(guestCode, "place", { fieldErrors: { address: "addressTooShort" } })).toEqual(guestForm);
    expect(viewAfter(guestForm, "send", { fieldErrors: { phone: "phoneRequired" } })).toEqual(guestForm);
  });
});
