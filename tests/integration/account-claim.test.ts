import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { claimCustomerAccount } from "@/lib/auth/code-session";
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
