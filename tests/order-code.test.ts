import { describe, expect, it, vi } from "vitest";
import { orderConfirmationEmail, sendEmail, senderOf } from "@/lib/email/send";
import { normalisePhone, parseCode, parseGuestOrder } from "@/lib/validation/booking";

// Ordering without sign-up (T9b): the guest order form's validation (phone, email, the emailed code)
// and the email sender (Brevo's HTTPS API, src/lib/email/send.ts).

function guestForm(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    serviceId: "regular",
    areaId: "jakarta-selatan",
    startsAt: "2026-10-26T01:00:00.000Z",
    address: "Jl. Melati No. 10, Kebayoran Baru, Jakarta Selatan",
    phone: "0812-3456-7890",
    email: " Nadia@Example.com ",
    consent: "on",
    locale: "id",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== undefined) data.set(key, value);
  return data;
}

describe("normalisePhone", () => {
  it("turns the usual ways of writing an Indonesian mobile number into +628...", () => {
    for (const input of ["081234567890", "0812-3456-7890", "0812 3456 7890", "62812 3456 7890", "+62 812-3456-7890", "(0812) 3456 7890"]) {
      expect(normalisePhone(input), input).toBe("+6281234567890");
    }
  });

  it("refuses numbers that are not Indonesian mobile numbers", () => {
    for (const input of ["", "12345", "021-1234567", "+6221123456", "+1 415 555 0100", "08123", "0812345678901234", "08a1234567"]) {
      expect(normalisePhone(input), input).toBeNull();
    }
  });
});

describe("parseGuestOrder", () => {
  it("reads the whole order with the email in lower case and the phone in +62 form", () => {
    const parsed = parseGuestOrder(guestForm());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toMatchObject({ email: "nadia@example.com", phone: "+6281234567890", consent: true, serviceId: "regular" });
  });

  it("names every field that needs fixing", () => {
    const parsed = parseGuestOrder(guestForm({ email: "nadia@", phone: "021123", consent: undefined }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors).toEqual({ email: "emailInvalid", phone: "phoneInvalid", consent: "consentRequired" });
  });

  it("asks for an email and a phone when they are left empty", () => {
    const parsed = parseGuestOrder(guestForm({ email: "", phone: "" }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors).toEqual({ email: "emailRequired", phone: "phoneRequired" });
  });
});

describe("parseCode", () => {
  it("accepts the six digits of the emailed code, ignoring spaces", () => {
    expect(parseCode(" 123 456 ")).toBe("123456");
  });

  it("refuses anything else", () => {
    for (const input of ["", "12345", "1234567", "12a456", null]) expect(parseCode(input), String(input)).toBeNull();
  });
});

describe("sendEmail", () => {
  const message = { to: "nadia@example.com", subject: "Pesanan", html: "<p>Halo</p>", text: "Halo" };
  const smtp = { host: "smtp.gmail.com", port: 587, user: "homeklin.demo@gmail.com", pass: "app-password" };

  it("sends over SMTP (Gmail) from the configured sender", async () => {
    const sendMail = vi.fn(async () => ({ messageId: "1" }));
    const createTransport = vi.fn(() => ({ sendMail }));
    const result = await sendEmail(message, { smtp, from: "HomeKlin <homeklin.demo@gmail.com>", createTransport });

    expect(result).toEqual({ sent: true });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.gmail.com", port: 587, secure: false, requireTLS: true, auth: { user: smtp.user, pass: smtp.pass } }),
    );
    expect(sendMail).toHaveBeenCalledWith({
      from: "HomeKlin <homeklin.demo@gmail.com>",
      to: "nadia@example.com",
      subject: "Pesanan",
      html: "<p>Halo</p>",
      text: "Halo",
    });
  });

  it("sends nothing and says so when SMTP is not set (tests and CI)", async () => {
    const createTransport = vi.fn();
    expect(await sendEmail(message, { smtp: undefined, from: "x@example.com", createTransport })).toEqual({
      sent: false,
      reason: "not_configured",
    });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("reports a failed send instead of throwing", async () => {
    const createTransport = vi.fn(() => ({
      sendMail: async () => {
        throw new Error("Invalid login");
      },
    }));
    expect(await sendEmail(message, { smtp, from: "x@example.com", createTransport })).toEqual({ sent: false, reason: "failed" });
  });
});

describe("senderOf", () => {
  it("always sends from the Gmail account, with the name from EMAIL_FROM", () => {
    expect(senderOf("HomeKlin", "demo@gmail.com")).toBe("HomeKlin <demo@gmail.com>");
    expect(senderOf("HomeKlin Demo <other@example.com>", "demo@gmail.com")).toBe("HomeKlin Demo <demo@gmail.com>");
    expect(senderOf("other@example.com", "demo@gmail.com")).toBe("HomeKlin <demo@gmail.com>");
    expect(senderOf(undefined, "demo@gmail.com")).toBe("HomeKlin <demo@gmail.com>");
  });
});

describe("orderConfirmationEmail", () => {
  const order = {
    serviceName: "Pembersihan <Rutin>",
    startsAt: "2026-10-26T01:00:00.000Z",
    endsAt: "2026-10-26T03:00:00.000Z",
    address: "Jl. Melati No. 10",
    priceIdr: 85000,
    orderUrl: "https://home-klin.vercel.app/orders?booked=abc",
  };

  it("writes the order in the customer's language, in Jakarta time, with the full price and the link", () => {
    const id = orderConfirmationEmail(order, "id");
    expect(id.subject).toContain("Pesanan HomeKlin");
    expect(id.text).toContain("Senin, 26 Oktober 2026");
    expect(id.text).toContain("08.00");
    expect(id.text).toMatch(/Rp\s85\.000/);
    expect(id.text).toContain(order.orderUrl);
    const en = orderConfirmationEmail(order, "en");
    expect(en.subject).toContain("HomeKlin order");
    expect(en.text).toContain("Monday, 26 October 2026");
  });

  it("escapes the text it puts into the HTML", () => {
    expect(orderConfirmationEmail(order, "id").html).toContain("Pembersihan &lt;Rutin&gt;");
  });

  it("never names an agency", () => {
    const { html, text, subject } = orderConfirmationEmail(order, "id");
    expect(`${subject} ${html} ${text}`).not.toMatch(/agensi|agency|mitra|partner/i);
  });
});
