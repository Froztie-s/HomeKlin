import { beforeEach, describe, expect, it, vi } from "vitest";

// Signing in with an emailed code (T9b, sendLoginCode and verifyLoginCode in src/lib/auth/actions.ts).
// Customers have no password since T9b: ordering creates their account, and they come back by code.
// The code step never creates an account and never says whether an email has one.

const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const signOut = vi.fn();
const redirectMock = vi.fn();
let profile: { role: string } | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signInWithOtp, verifyOtp, signOut },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }) }),
  }),
}));
vi.mock("@/i18n/navigation", () => ({ redirect: redirectMock }));

const { sendLoginCode, verifyLoginCode } = await import("@/lib/auth/actions");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ locale: "id", ...values })) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  profile = { role: "customer" };
});

describe("sendLoginCode", () => {
  it("emails a code to an existing account only, never creating one", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    expect(await sendLoginCode(null, form({ email: "Nadia@Example.com" }))).toMatchObject({ codeSent: true });
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "nadia@example.com", options: { shouldCreateUser: false } });
  });

  it("answers the same for an email without an account, so the form reveals nobody", async () => {
    signInWithOtp.mockResolvedValue({ error: { status: 422, code: "otp_disabled", message: "Signups not allowed for otp" } });
    expect(await sendLoginCode(null, form({ email: "nobody@example.com" }))).toMatchObject({ codeSent: true });
  });

  it("refuses an invalid email before asking Supabase, and says when there were too many attempts", async () => {
    expect(await sendLoginCode(null, form({ email: "nadia@" }))).toMatchObject({ fieldErrors: { email: "emailInvalid" } });
    expect(signInWithOtp).not.toHaveBeenCalled();
    signInWithOtp.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit" } });
    expect(await sendLoginCode(null, form({ email: "nadia@example.com" }))).toMatchObject({ formError: "rateLimited" });
  });
});

describe("verifyLoginCode", () => {
  it("checks the code and sends the user to `next` when their role may open it", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    await verifyLoginCode(null, form({ email: "nadia@example.com", code: "123456", next: "/orders" }));

    expect(verifyOtp).toHaveBeenCalledWith({ email: "nadia@example.com", token: "123456", type: "email" });
    expect(redirectMock).toHaveBeenCalledWith({ href: "/orders", locale: "id" });
  });

  it("sends staff who sign in by code to their own home", async () => {
    profile = { role: "admin" };
    verifyOtp.mockResolvedValue({ data: { user: { id: "u2" } }, error: null });
    await verifyLoginCode(null, form({ email: "admin@example.com", code: "123456" }));
    expect(redirectMock).toHaveBeenCalledWith({ href: "/admin", locale: "id" });
  });

  it("refuses a wrong or malformed code and stays on the code step", async () => {
    expect(await verifyLoginCode(null, form({ email: "nadia@example.com", code: "12" }))).toMatchObject({
      formError: "codeInvalid",
      codeSent: true,
    });
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { status: 403, code: "otp_expired" } });
    expect(await verifyLoginCode(null, form({ email: "nadia@example.com", code: "654321" }))).toMatchObject({
      formError: "codeInvalid",
      codeSent: true,
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
