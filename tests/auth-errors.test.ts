import { describe, expect, it } from "vitest";
import { authFailureKey } from "@/lib/auth/errors";

// Supabase Auth errors become one of a few plain messages (Auth.errors.<key> in src/messages).
// Error codes: https://supabase.com/docs/guides/auth/debugging/error-codes
describe("authFailureKey", () => {
  it("reports a wrong email or password without saying which one was wrong", () => {
    expect(authFailureKey({ code: "invalid_credentials" })).toBe("invalidCredentials");
  });

  it("reports an email that already has an account", () => {
    expect(authFailureKey({ code: "user_already_exists" })).toBe("emailTaken");
    expect(authFailureKey({ code: "email_exists" })).toBe("emailTaken");
  });

  it("reports too many attempts", () => {
    expect(authFailureKey({ code: "over_request_rate_limit" })).toBe("rateLimited");
    expect(authFailureKey({ code: "over_email_send_rate_limit" })).toBe("rateLimited");
    expect(authFailureKey({ status: 429 })).toBe("rateLimited");
  });

  it("reports a password Supabase rejects as too weak", () => {
    expect(authFailureKey({ code: "weak_password" })).toBe("weakPassword");
  });

  it("reports an email address Supabase refuses", () => {
    expect(authFailureKey({ code: "email_address_invalid" })).toBe("emailRejected");
  });

  it("treats anything else, or no error at all, as the service being unavailable", () => {
    expect(authFailureKey({ code: "unexpected_failure" })).toBe("unavailable");
    expect(authFailureKey({})).toBe("unavailable");
    expect(authFailureKey(null)).toBe("unavailable");
  });
});
