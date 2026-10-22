import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoUsers, listAllUsers, seed, SEED_MARKER } from "../../scripts/seed.mjs";
import { adminClient, visitorClient } from "./test-project";

// The seed script (T6, scripts/seed.mjs) against the real test project. Every e-mail of this run starts
// with its own prefix, so the run touches no other account, and afterAll deletes, by id, every account
// the run created. The demo password is a fresh random one per run, not the one in .env.

type SeedResult = Awaited<ReturnType<typeof seed>>[number];

const run = `t6-${randomUUID().slice(0, 8)}`;
const seededPrefix = `${run}-a-`;
const blockedPrefix = `${run}-b-`;
const newPassword = () => randomBytes(18).toString("base64url");
const secondPassword = newPassword();

let firstRun: SeedResult[] = [];
let secondRun: SeedResult[] = [];

beforeAll(async () => {
  const admin = adminClient();
  firstRun = await seed({ client: admin, password: newPassword(), emailPrefix: seededPrefix });

  // Between the runs, someone changes a cleaner's role and name: the second run must put them back.
  const cleaner = firstRun.find((result) => result.role === "cleaner");
  if (!cleaner) throw new Error("The first run seeded no cleaner.");
  const drift = await admin.from("profiles").update({ role: "customer", full_name: "Diubah" }).eq("id", cleaner.id);
  if (drift.error) throw new Error(`Could not change the cleaner's profile: ${drift.error.message}`);

  secondRun = await seed({ client: admin, password: secondPassword, emailPrefix: seededPrefix });
}, 120_000);

afterAll(async () => {
  const admin = adminClient();
  const created = (await listAllUsers(admin)).filter((user) => user.email?.startsWith(`${run}-`));
  const failures: string[] = [];
  for (const user of created) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) failures.push(`${user.email}: ${error.message}`);
  }
  if (failures.length > 0) throw new Error(`Could not delete test users: ${failures.join("; ")}`);
}, 120_000);

describe("seed against the test project", () => {
  it("creates every demo user on the first run and updates the same accounts on the second", () => {
    const expected = demoUsers(seededPrefix).map((user) => user.email);

    expect(firstRun.map((result) => [result.email, result.status])).toEqual(
      expected.map((email) => [email, "created"]),
    );
    expect(secondRun.map((result) => [result.email, result.status])).toEqual(
      expected.map((email) => [email, "updated"]),
    );
    expect(secondRun.map((result) => result.id)).toEqual(firstRun.map((result) => result.id));
  });

  it("leaves each demo e-mail on exactly one account, marked as made by the seed", async () => {
    const accounts = (await listAllUsers(adminClient())).filter((user) => user.email?.startsWith(seededPrefix));

    expect(accounts.map((user) => user.email).sort()).toEqual(
      demoUsers(seededPrefix)
        .map((user) => user.email)
        .sort(),
    );
    for (const account of accounts) {
      expect(account.app_metadata[SEED_MARKER]).toBe(true);
    }
  });

  it("gives every demo user the right role and name, even after someone changed them", async () => {
    const ids = secondRun.map((result) => result.id);
    const { data, error } = await adminClient().from("profiles").select("id, role, full_name").in("id", ids);

    expect(error).toBeNull();
    const byId = new Map((data ?? []).map((profile) => [profile.id, profile]));
    for (const result of secondRun) {
      expect(byId.get(result.id)).toEqual({ id: result.id, role: result.role, full_name: result.fullName });
    }
  });

  it("lets one seeded user per role sign in with the demo password of the latest run", async () => {
    for (const role of ["customer", "admin", "agency", "cleaner"]) {
      const user = secondRun.find((result) => result.role === role);
      if (!user) throw new Error(`No seeded ${role}.`);
      const client = visitorClient();

      const signIn = await client.auth.signInWithPassword({ email: user.email, password: secondPassword });
      expect(signIn.error).toBeNull();
      expect(signIn.data.user?.id).toBe(user.id);

      // Signed in, the user reads their own role through row-level security, as the app does.
      const { data } = await client.from("profiles").select("role, full_name").single();
      expect(data).toEqual({ role, full_name: user.fullName });
    }
  }, 60_000);

  it("refuses an unmarked account that holds a demo e-mail, and leaves it a customer", async () => {
    const admin = adminClient();
    const adminEmail = demoUsers(blockedPrefix).find((user) => user.role === "admin")?.email;
    if (!adminEmail) throw new Error("No demo admin.");
    // Someone signed up with the demo admin's e-mail before the seed ran (sign-up is open).
    const squatter = await admin.auth.admin.createUser({
      email: adminEmail,
      password: newPassword(),
      email_confirm: true,
      user_metadata: { full_name: "Penyusup" },
    });
    if (squatter.error || !squatter.data.user) throw new Error(`Could not pre-register: ${squatter.error?.message}`);
    const squatterId = squatter.data.user.id;

    await expect(seed({ client: admin, password: newPassword(), emailPrefix: blockedPrefix })).rejects.toThrow(
      adminEmail,
    );

    const profile = await admin.from("profiles").select("role, full_name").eq("id", squatterId).single();
    expect(profile.data).toEqual({ role: "customer", full_name: "Penyusup" });
    const account = await admin.auth.admin.getUserById(squatterId);
    expect(account.data.user?.app_metadata[SEED_MARKER]).toBeUndefined();
    // The seed decides everything before it changes anything: no other demo user of this prefix exists.
    const prefixed = (await listAllUsers(admin)).filter((user) => user.email?.startsWith(blockedPrefix));
    expect(prefixed.map((user) => user.id)).toEqual([squatterId]);
  }, 60_000);
});
