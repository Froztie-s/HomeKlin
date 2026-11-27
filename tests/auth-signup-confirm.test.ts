import { beforeEach, describe, expect, it, vi } from "vitest";

// Signing up with "Confirm email" on (user decision 2026-11-27): Supabase makes the account but gives
// no session, the customer gets a 6-digit code by email, and the sign-up form shows a code step.
// signUp (src/lib/auth/actions.ts) answers with that step; confirmSignUp checks the code and signs the
// customer in; resendSignUpCode asks for a new code. With confirmation off (the test project), signUp
// still returns a session at once and redirects, as before.

const signUpMock = vi.fn();
const verifyOtp = vi.fn();
const resend = vi.fn();
const signOut = vi.fn();
const redirectMock = vi.fn();
let profile: { role: string } | null = null;

// Who holds the password after the code is typed (ship review C1, 2026-11-27): Supabase keeps the FIRST
// password registered for an unconfirmed address, so the one typed on the form may not be the stored
// one. confirmSignUp therefore sets the password the person typed together with the code
// (setCustomerPassword), or, when none came along, replaces it with a random one (claimCustomerAccount).
const { claimCustomerAccount, setCustomerPassword } = vi.hoisted(() => ({
  claimCustomerAccount: vi.fn(),
  setCustomerPassword: vi.fn(),
}));
vi.mock("@/lib/auth/code-session", () => ({ claimCustomerAccount, setCustomerPassword }));
vi.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signUp: signUpMock, verifyOtp, resend, signOut },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }) }),
  }),
}));
vi.mock("@/i18n/navigation", () => ({ redirect: redirectMock }));

const { signUp, confirmSignUp, resendSignUpCode } = await import("@/lib/auth/actions");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ locale: "id", ...values })) data.set(key, value);
  return data;
}

const newCustomer = { fullName: "Nadia Uji", email: "Nadia@Example.com", password: "kata-sandi-uji-1" };
const user = { id: "u1", identities: [{ id: "i1" }] };

beforeEach(() => {
  vi.clearAllMocks();
  profile = { role: "customer" };
});

describe("signUp", () => {
  it("signs the customer in at once when the project confirms nothing (a session comes back)", async () => {
    signUpMock.mockResolvedValue({ data: { user, session: { access_token: "t" } }, error: null });

    await signUp(null, form({ ...newCustomer, next: "/orders" }));

    expect(signUpMock).toHaveBeenCalledWith({
      email: "nadia@example.com",
      password: "kata-sandi-uji-1",
      options: { data: { full_name: "Nadia Uji" } },
    });
    expect(redirectMock).toHaveBeenCalledWith({ href: "/orders", locale: "id" });
  });

  it("opens the customer home when there is no next page", async () => {
    signUpMock.mockResolvedValue({ data: { user, session: { access_token: "t" } }, error: null });
    await signUp(null, form({ ...newCustomer, locale: "en" }));
    expect(redirectMock).toHaveBeenCalledWith({ href: "/home", locale: "en" });
  });

  it("shows the code step when Supabase made the account but gave no session, keeping name and email", async () => {
    signUpMock.mockResolvedValue({ data: { user, session: null }, error: null });

    const state = await signUp(null, form(newCustomer));

    expect(state).toEqual({ codeSent: true, values: { email: "Nadia@Example.com", fullName: "Nadia Uji" } });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("never sends the password back to the page", async () => {
    signUpMock.mockResolvedValue({ data: { user, session: null }, error: null });
    const state = await signUp(null, form(newCustomer));
    expect(JSON.stringify(state)).not.toContain(newCustomer.password);
  });

  it("still says the email is taken when Supabase hides it behind an empty user (Confirm email on)", async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: "fake", identities: [] }, session: null }, error: null });
    expect(await signUp(null, form(newCustomer))).toMatchObject({ formError: "emailTaken" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("still says the email is taken when Supabase answers with an error (Confirm email off)", async () => {
    signUpMock.mockResolvedValue({ data: { user: null, session: null }, error: { status: 422, code: "user_already_exists" } });
    expect(await signUp(null, form(newCustomer))).toMatchObject({ formError: "emailTaken" });
  });

  it("says when the confirmation email could not be sent because of too many tries", async () => {
    signUpMock.mockResolvedValue({ data: { user: null, session: null }, error: { status: 429, code: "over_email_send_rate_limit" } });
    expect(await signUp(null, form(newCustomer))).toMatchObject({ formError: "rateLimited" });
  });

  it("refuses invalid input before asking Supabase", async () => {
    expect(await signUp(null, form({ ...newCustomer, email: "nadia@", password: "pendek" }))).toMatchObject({
      fieldErrors: { email: "emailInvalid", password: "passwordTooShort" },
    });
    expect(signUpMock).not.toHaveBeenCalled();
  });
});

describe("confirmSignUp", () => {
  it("checks the code as a sign-up code, signs the customer in and sends them on to `next`", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    await confirmSignUp(null, form({ email: "Nadia@Example.com", code: "123456", next: "/orders" }));

    expect(verifyOtp).toHaveBeenCalledWith({ email: "nadia@example.com", token: "123456", type: "email" });
    expect(redirectMock).toHaveBeenCalledWith({ href: "/orders", locale: "id" });
  });

  it("opens the customer home when there is no next page, in the visitor's language", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await confirmSignUp(null, form({ email: "nadia@example.com", code: "123456", locale: "en" }));
    expect(redirectMock).toHaveBeenCalledWith({ href: "/home", locale: "en" });
  });

  it("sets the password typed together with the code, so the password registered first no longer works", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await confirmSignUp(null, form({ email: "Nadia@Example.com", code: "123456", password: "kata-sandi-uji-1" }));
    expect(setCustomerPassword).toHaveBeenCalledTimes(1);
    expect(setCustomerPassword.mock.calls[0]?.slice(2)).toEqual(["u1", "nadia@example.com", "kata-sandi-uji-1"]);
    expect(claimCustomerAccount).not.toHaveBeenCalled();
  });

  it("claims the account (random password) when no password came with the code, e.g. posted before the script ran", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await confirmSignUp(null, form({ email: "nadia@example.com", code: "123456" }));
    expect(claimCustomerAccount).toHaveBeenCalledTimes(1);
    expect(claimCustomerAccount.mock.calls[0]?.slice(2)).toEqual(["u1", "nadia@example.com"]);
    expect(setCustomerPassword).not.toHaveBeenCalled();
  });

  it("does not trust a password that fails the sign-up rules: it claims the account instead", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await confirmSignUp(null, form({ email: "nadia@example.com", code: "123456", password: "short" }));
    expect(setCustomerPassword).not.toHaveBeenCalled();
    expect(claimCustomerAccount).toHaveBeenCalledTimes(1);
  });

  it("changes no password when the code is wrong", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { status: 403, code: "otp_expired", message: "invalid" } });
    const state = await confirmSignUp(null, form({ email: "nadia@example.com", code: "654321", password: "kata-sandi-uji-1" }));
    expect(setCustomerPassword).not.toHaveBeenCalled();
    expect(claimCustomerAccount).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).not.toContain("kata-sandi-uji-1");
  });

  it("ignores spaces in the code", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await confirmSignUp(null, form({ email: "nadia@example.com", code: "123 456" }));
    expect(verifyOtp).toHaveBeenCalledWith({ email: "nadia@example.com", token: "123456", type: "email" });
  });

  it("does not use a next page that leaves the site", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await confirmSignUp(null, form({ email: "nadia@example.com", code: "123456", next: "https://evil.example/" }));
    expect(redirectMock).toHaveBeenCalledWith({ href: "/home", locale: "id" });
  });

  it("stays on the code step with a wrong code", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { status: 403, code: "otp_expired", message: "Token has expired or is invalid" } });
    expect(await confirmSignUp(null, form({ email: "nadia@example.com", code: "654321" }))).toMatchObject({
      formError: "codeInvalid",
      codeSent: true,
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("stays on the code step with an expired code", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { status: 403, code: "otp_expired" } });
    expect(await confirmSignUp(null, form({ email: "nadia@example.com", code: "111111" }))).toMatchObject({
      formError: "codeInvalid",
      codeSent: true,
    });
  });

  it("says when there were too many attempts, still on the code step", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { status: 429, code: "over_request_rate_limit" } });
    expect(await confirmSignUp(null, form({ email: "nadia@example.com", code: "123456" }))).toMatchObject({
      formError: "rateLimited",
      codeSent: true,
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("refuses a malformed code without asking Supabase", async () => {
    for (const code of ["12", "abcdef", "1234567", ""]) {
      expect(await confirmSignUp(null, form({ email: "nadia@example.com", code }))).toMatchObject({
        formError: "codeInvalid",
        codeSent: true,
      });
    }
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("refuses an invalid email without asking Supabase", async () => {
    expect(await confirmSignUp(null, form({ email: "nadia@", code: "123456" }))).toMatchObject({
      fieldErrors: { email: "emailInvalid" },
    });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("signs out and refuses an account that has no profile", async () => {
    profile = null;
    verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    expect(await confirmSignUp(null, form({ email: "nadia@example.com", code: "123456" }))).toMatchObject({ formError: "unavailable" });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("resendSignUpCode", () => {
  it("asks Supabase to send the sign-up code again", async () => {
    resend.mockResolvedValue({ data: {}, error: null });
    expect(await resendSignUpCode(null, form({ email: "Nadia@Example.com" }))).toMatchObject({ codeSent: true });
    expect(resend).toHaveBeenCalledWith({ type: "signup", email: "nadia@example.com" });
  });

  it("says when a new code was asked for too soon, still on the code step", async () => {
    resend.mockResolvedValue({ data: {}, error: { status: 429, code: "over_email_send_rate_limit" } });
    expect(await resendSignUpCode(null, form({ email: "nadia@example.com" }))).toMatchObject({
      formError: "rateLimited",
      codeSent: true,
    });
  });

  it("says so when the code could not be sent for another reason", async () => {
    resend.mockResolvedValue({ data: {}, error: { status: 500, code: "unexpected_failure" } });
    expect(await resendSignUpCode(null, form({ email: "nadia@example.com" }))).toMatchObject({
      formError: "unavailable",
      codeSent: true,
    });
  });

  it("refuses an invalid email without asking Supabase", async () => {
    expect(await resendSignUpCode(null, form({ email: "nadia@" }))).toMatchObject({ fieldErrors: { email: "emailInvalid" } });
    expect(resend).not.toHaveBeenCalled();
  });
});
