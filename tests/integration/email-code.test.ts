import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { adminClient, visitorClient } from "./test-project";

// Signing in with an emailed code (T9b), against the real test project. Its auth emails go to Ethereal
// (npm run supabase -- smtp test), which accepts mail and delivers nothing, so the test reads the code
// the way the e2e suite does: auth.admin.generateLink issues a fresh code for the address (the secret
// key; tests only), which replaces the one that was emailed.

const email = `t9b-${randomUUID().slice(0, 8)}@example.com`;
const created: string[] = [];

afterAll(async () => {
  for (const id of created) await adminClient().auth.admin.deleteUser(id);
}, 30_000);

/** The current code for an address, as the e2e helper gets it. */
async function codeFor(address: string): Promise<string> {
  const { data, error } = await adminClient().auth.admin.generateLink({ type: "magiclink", email: address });
  if (error) throw new Error(`Could not get a code for ${address}: ${error.message}`);
  return data.properties.email_otp;
}

describe("email code", () => {
  it("does not create an account when a code is asked for to sign in", async () => {
    const { error } = await visitorClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    expect(error).not.toBeNull();
    const { data } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(data.users.some((user) => user.email === email)).toBe(false);
  }, 30_000);

  it("emails a code when ordering, and the code creates a customer account and signs it in", async () => {
    const asked = await visitorClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    expect(asked.error).toBeNull();

    const code = await codeFor(email);
    expect(code).toMatch(/^[0-9]{6}$/);

    const browser = visitorClient();
    const { data, error } = await browser.auth.verifyOtp({ email, token: code, type: "email" });
    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
    created.push(data.user?.id ?? "");

    const { data: profile } = await browser.from("profiles").select("role").single();
    expect(profile?.role).toBe("customer");
  }, 30_000);

  it("refuses a wrong code", async () => {
    const { error } = await visitorClient().auth.verifyOtp({ email, token: "000000", type: "email" });
    expect(error).not.toBeNull();
  });
});
