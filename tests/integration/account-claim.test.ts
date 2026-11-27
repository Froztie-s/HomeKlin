import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { claimCustomerAccount, setCustomerPassword } from "@/lib/auth/code-session";
import { adminClient, createTestUser, deleteTestUsers, visitorClient, type TestUser } from "./test-project";

// T34, finding H1: someone registers a stranger's email with a password before that person ever orders.
// When the real owner later proves the email with a code (ordering or /login), claimCustomerAccount
// (src/lib/auth/code-session.ts) replaces the password, which ends every session; the owner gets a
// fresh one, the intruder's password and session stop working. Staff keep their password. Against the
// real test project.

const users: TestUser[] = [];

afterAll(async () => {
  await deleteTestUsers(users);
}, 60_000);

/** Signs in with an emailed code the way the order page does, using a code made with the secret key. */
async function signInWithCode(email: string) {
  const { data, error } = await adminClient().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`Could not get a code: ${error.message}`);
  const client = visitorClient();
  const verified = await client.auth.verifyOtp({ email, token: data.properties.email_otp, type: "email" });
  if (verified.error || !verified.data.user) throw new Error(`Could not sign in by code: ${verified.error?.message}`);
  return { client, userId: verified.data.user.id };
}

describe("claimCustomerAccount", { timeout: 60_000 }, () => {
  it("locks out an intruder who registered the customer's email with a password", async () => {
    const intruder = await createTestUser(`t34-claim-${randomUUID().slice(0, 6)}`);
    users.push(intruder);
    // The intruder is signed in and holds a working password.
    expect((await intruder.client.from("profiles").select("id").eq("id", intruder.id)).data).toHaveLength(1);

    const owner = await signInWithCode(intruder.email);
    await claimCustomerAccount(owner.client, adminClient(), owner.userId, intruder.email);

    const again = await visitorClient().auth.signInWithPassword({ email: intruder.email, password: intruder.password });
    expect(again.error).not.toBeNull();
    // The intruder's session is ended too: its refresh token no longer works.
    const { data: session } = await intruder.client.auth.getSession();
    const refreshed = await visitorClient().auth.refreshSession({ refresh_token: session.session?.refresh_token ?? "" });
    expect(refreshed.error).not.toBeNull();
    // The real owner stays signed in, with a session that can still be renewed.
    expect((await owner.client.from("profiles").select("id").eq("id", owner.userId)).data).toHaveLength(1);
    const { data: ownSession } = await owner.client.auth.getSession();
    const renewed = await visitorClient().auth.refreshSession({ refresh_token: ownSession.session?.refresh_token ?? "" });
    expect(renewed.error).toBeNull();
  });

  it("leaves a staff account's password alone", async () => {
    const admin = await createTestUser(`t34-staff-${randomUUID().slice(0, 6)}`);
    users.push(admin);
    await adminClient().from("profiles").update({ role: "admin" }).eq("id", admin.id);
    const codeSession = await signInWithCode(admin.email);
    await claimCustomerAccount(codeSession.client, adminClient(), codeSession.userId, admin.email);
    expect((await visitorClient().auth.signInWithPassword({ email: admin.email, password: admin.password })).error).toBeNull();
  });
});

// Ship review C1 (2026-11-27): with "Confirm email" on, Supabase keeps the FIRST password registered for an
// unconfirmed address and ignores the one a later sign-up sends. The person who types the code must be the one
// who decides the password: setCustomerPassword sets it after the code check and marks the account, so that a
// later code sign-in (claimCustomerAccount) does not replace it again.
describe("setCustomerPassword", { timeout: 90_000 }, () => {
  it("replaces the password an intruder registered first, keeps the owner's own, and survives a later code sign-in", async () => {
    const email = `t34-confirm-${randomUUID().slice(0, 8)}@example.com`;
    const intruderPassword = `intruder-${randomUUID()}`;
    const ownerPassword = `owner-${randomUUID()}`;
    const admin = adminClient();
    // Registered first, not confirmed: what Supabase's public sign-up API does with "Confirm email" on.
    const created = await admin.auth.admin.createUser({ email, password: intruderPassword, email_confirm: false });
    if (created.error || !created.data.user) throw new Error(`Could not create the user: ${created.error?.message}`);
    const userId = created.data.user.id;
    users.push({ id: userId, email, password: intruderPassword, client: visitorClient() });

    // The real owner types the code from the email, and the password they chose with it.
    const owner = await signInWithCode(email);
    await setCustomerPassword(owner.client, admin, userId, email, ownerPassword);

    expect((await visitorClient().auth.signInWithPassword({ email, password: intruderPassword })).error).not.toBeNull();
    expect((await visitorClient().auth.signInWithPassword({ email, password: ownerPassword })).error).toBeNull();
    // The owner stays signed in, with a session that can be renewed.
    const { data: session } = await owner.client.auth.getSession();
    expect((await visitorClient().auth.refreshSession({ refresh_token: session.session?.refresh_token ?? "" })).error).toBeNull();

    // Signing in by code later does not take the owner's password away (the account is marked by the server).
    const later = await signInWithCode(email);
    await claimCustomerAccount(later.client, admin, later.userId, email);
    expect((await visitorClient().auth.signInWithPassword({ email, password: ownerPassword })).error).toBeNull();
  });

  it("leaves a staff account alone", async () => {
    const staff = await createTestUser(`t34-staff2-${randomUUID().slice(0, 6)}`);
    users.push(staff);
    await adminClient().from("profiles").update({ role: "admin" }).eq("id", staff.id);
    const codeSession = await signInWithCode(staff.email);
    await setCustomerPassword(codeSession.client, adminClient(), codeSession.userId, staff.email, `new-${randomUUID()}`);
    expect((await visitorClient().auth.signInWithPassword({ email: staff.email, password: staff.password })).error).toBeNull();
  });
});
