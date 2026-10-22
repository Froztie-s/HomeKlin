import { describe, expect, it } from "vitest";
import { parseSignIn, parseSignUp } from "@/lib/validation/auth";

// The sign-in and sign-up forms are checked on the server with Zod (CONSTRAINTS.md: every server
// action parses its input). Errors come back as message keys per field, which each language translates.
function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("parseSignIn", () => {
  it("accepts an email and password, trimming and lower-casing the email", () => {
    const result = parseSignIn(form({ email: "  Rina@Example.COM ", password: "rahasia-123", locale: "id" }));
    expect(result).toEqual({
      ok: true,
      data: { email: "rina@example.com", password: "rahasia-123", locale: "id", next: undefined },
    });
  });

  it("keeps the requested next page and the language", () => {
    const result = parseSignIn(form({ email: "a@b.co", password: "x", locale: "en", next: "/orders" }));
    expect(result).toMatchObject({ ok: true, data: { locale: "en", next: "/orders" } });
  });

  it("reports a missing or malformed email and a missing password", () => {
    expect(parseSignIn(form({ email: "", password: "", locale: "id" }))).toEqual({
      ok: false,
      locale: "id",
      fieldErrors: { email: "emailRequired", password: "passwordRequired" },
    });
    expect(parseSignIn(form({ email: "not-an-email", password: "x", locale: "id" }))).toMatchObject({
      ok: false,
      fieldErrors: { email: "emailInvalid" },
    });
  });

  it("refuses passwords longer than 72 bytes' worth of characters (the hashing limit)", () => {
    expect(parseSignIn(form({ email: "a@b.co", password: "x".repeat(73), locale: "id" }))).toMatchObject({
      ok: false,
      fieldErrors: { password: "passwordTooLong" },
    });
  });

  it("falls back to Indonesian for an unknown language and never trusts it", () => {
    expect(parseSignIn(form({ email: "a@b.co", password: "x", locale: "fr" }))).toMatchObject({
      ok: true,
      data: { locale: "id" },
    });
  });

  it("drops an over-long next value instead of failing the form", () => {
    expect(parseSignIn(form({ email: "a@b.co", password: "x", locale: "id", next: `/${"a".repeat(600)}` })))
      .toMatchObject({ ok: true, data: { next: undefined } });
  });
});

describe("parseSignUp", () => {
  it("accepts a name, an email and a password of at least 8 characters", () => {
    const result = parseSignUp(
      form({ fullName: "  Rina Kartika  ", email: "Rina@Example.com", password: "rahasia-123", locale: "en" }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        fullName: "Rina Kartika",
        email: "rina@example.com",
        password: "rahasia-123",
        locale: "en",
        next: undefined,
      },
    });
  });

  it("reports each problem on its own field", () => {
    expect(parseSignUp(form({ fullName: " ", email: "x", password: "short", locale: "id" }))).toEqual({
      ok: false,
      locale: "id",
      fieldErrors: { fullName: "nameRequired", email: "emailInvalid", password: "passwordTooShort" },
    });
  });

  it("limits the name to 120 characters", () => {
    expect(
      parseSignUp(form({ fullName: "a".repeat(121), email: "a@b.co", password: "12345678", locale: "id" })),
    ).toMatchObject({ ok: false, fieldErrors: { fullName: "nameTooLong" } });
  });
});
