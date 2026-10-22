import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createTestUser,
  deleteTestUsers,
  visitorClient,
  type TestUser,
} from "./test-project";

// Row-level security on public.profiles (T5, supabase/migrations/20261022120000_profiles_and_roles.sql),
// checked against the real database of the test project: a user reads only their own profile, nobody
// can give themselves a role, and visitors who are not signed in read nothing.
// Postgres error 42501 is "insufficient privilege".

let alice: TestUser | undefined;
let bruno: TestUser | undefined;

beforeAll(async () => {
  // Alice tries to sign up as an admin through the metadata a visitor controls.
  alice = await createTestUser("alice", { full_name: "Uji Alice", role: "admin" });
  bruno = await createTestUser("bruno", { full_name: "Uji Bruno" });
}, 60_000);

afterAll(async () => {
  await deleteTestUsers([alice, bruno]);
}, 60_000);

function signedIn(user: TestUser | undefined): TestUser {
  if (!user) throw new Error("The test user was not created (see beforeAll).");
  return user;
}

describe("profiles row-level security", () => {
  it("creates a customer profile at sign-up and ignores a role in the sign-up metadata", async () => {
    const { data, error } = await adminClient()
      .from("profiles")
      .select("role, full_name")
      .eq("id", signedIn(alice).id)
      .single();

    expect(error).toBeNull();
    expect(data).toEqual({ role: "customer", full_name: "Uji Alice" });
  });

  it("lets a user read their own profile and no other", async () => {
    const user = signedIn(alice);
    const { data, error } = await user.client.from("profiles").select("id, role");

    expect(error).toBeNull();
    expect(data).toEqual([{ id: user.id, role: "customer" }]);
  });

  it("returns nothing when a user asks for someone else's profile", async () => {
    const { data, error } = await signedIn(alice)
      .client.from("profiles")
      .select("id")
      .eq("id", signedIn(bruno).id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("refuses a user who tries to make themselves an admin", async () => {
    const user = signedIn(alice);
    const { error } = await user.client.from("profiles").update({ role: "admin" }).eq("id", user.id);

    expect(error?.code).toBe("42501");
    const { data } = await adminClient().from("profiles").select("role").eq("id", user.id).single();
    expect(data?.role).toBe("customer");
  });

  it("refuses a user who tries to add or delete profiles", async () => {
    const user = signedIn(alice);
    const insert = await user.client.from("profiles").insert({ id: crypto.randomUUID(), role: "admin" });
    const remove = await user.client.from("profiles").delete().eq("id", signedIn(bruno).id);

    expect(insert.error?.code).toBe("42501");
    expect(remove.error?.code).toBe("42501");
  });

  it("gives a visitor who is not signed in no access at all", async () => {
    const { data, error } = await visitorClient().from("profiles").select("id");

    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("lets only the service role change a role, which the user then sees", async () => {
    const user = signedIn(bruno);
    const update = await adminClient().from("profiles").update({ role: "agency" }).eq("id", user.id);
    expect(update.error).toBeNull();

    const { data } = await user.client.from("profiles").select("role").eq("id", user.id).single();
    expect(data?.role).toBe("agency");
  });
});
