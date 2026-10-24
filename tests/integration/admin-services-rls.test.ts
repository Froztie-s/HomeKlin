import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUsers, visitorClient, type TestUser } from "./test-project";

// Who may change HomeKlin's services and prices (T7b, supabase/migrations/20261024120000_admin_services.sql):
// only a signed-in admin, checked by row-level security in the database, whatever the app does. Every
// other role, and visitors, are refused. Admin also sees inactive services, to edit or reactivate them.
// Postgres error 42501 is "insufficient privilege" (also "new row violates row-level security policy").

const prefix = `t7b-${randomUUID().slice(0, 8)}`;
const users: Partial<Record<"admin" | "customer" | "cleaner" | "agency", TestUser>> = {};

const newService = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  category: "rooms",
  name_id: "Uji Layanan",
  name_en: "Test Service",
  description_id: "Layanan uji.",
  description_en: "A test service.",
  price_idr: 100000,
  duration_minutes: 60,
  ...overrides,
});

function user(role: keyof typeof users): TestUser {
  const found = users[role];
  if (!found) throw new Error(`The ${role} test user was not created (see beforeAll).`);
  return found;
}

beforeAll(async () => {
  for (const role of ["admin", "customer", "cleaner", "agency"] as const) {
    const created = await createTestUser(`t7b-${role}`);
    if (role !== "customer") {
      const { error } = await adminClient().from("profiles").update({ role }).eq("id", created.id);
      if (error) throw new Error(`Could not make the test user ${role}: ${error.message}`);
    }
    users[role] = created;
  }
  // One existing service that the other roles will try to change.
  const { error } = await adminClient().from("services").insert(newService(`${prefix}-existing`));
  if (error) throw new Error(`Could not add the test service: ${error.message}`);
}, 90_000);

afterAll(async () => {
  await adminClient().from("services").delete().like("id", `${prefix}-%`);
  await deleteTestUsers(Object.values(users));
}, 60_000);

const priceOf = async (id: string) =>
  (await adminClient().from("services").select("price_idr").eq("id", id).single()).data?.price_idr;

describe("admin changes services and prices", () => {
  it("lets an admin add a service and change its price", async () => {
    const admin = user("admin").client;
    const insert = await admin.from("services").insert(newService(`${prefix}-added`));
    expect(insert.error).toBeNull();

    const update = await admin.from("services").update({ price_idr: 125000 }).eq("id", `${prefix}-added`).select("id");
    expect(update.error).toBeNull();
    expect(update.data).toHaveLength(1);
    expect(await priceOf(`${prefix}-added`)).toBe(125000);
  });

  it("lets an admin switch a service off and still see it, to switch it on again", async () => {
    const admin = user("admin").client;
    await admin.from("services").update({ is_active: false }).eq("id", `${prefix}-existing`);

    const seen = await admin.from("services").select("id, is_active").eq("id", `${prefix}-existing`);
    expect(seen.data).toEqual([{ id: `${prefix}-existing`, is_active: false }]);
    const hidden = await visitorClient().from("services").select("id").eq("id", `${prefix}-existing`);
    expect(hidden.data).toEqual([]);

    await admin.from("services").update({ is_active: true }).eq("id", `${prefix}-existing`);
  });

  it("does not let even an admin delete a service (switching it off keeps past orders intact)", async () => {
    const { error } = await user("admin").client.from("services").delete().eq("id", `${prefix}-existing`);
    expect(error?.code).toBe("42501");
  });
});

describe("everyone else is refused", () => {
  for (const role of ["customer", "cleaner", "agency"] as const) {
    it(`refuses a signed-in ${role} who tries to add a service or change a price`, async () => {
      const client = user(role).client;
      const insert = await client.from("services").insert(newService(`${prefix}-by-${role}`));
      expect(insert.error?.code).toBe("42501");

      // Row-level security hides the row from the update, so nothing changes.
      const update = await client.from("services").update({ price_idr: 1 }).eq("id", `${prefix}-existing`).select("id");
      expect(update.data ?? []).toEqual([]);
      expect(await priceOf(`${prefix}-existing`)).toBe(100000);
    });
  }

  it("refuses a visitor who is not signed in", async () => {
    const insert = await visitorClient().from("services").insert(newService(`${prefix}-by-visitor`));
    const update = await visitorClient().from("services").update({ price_idr: 1 }).eq("id", `${prefix}-existing`);
    expect(insert.error?.code).toBe("42501");
    expect(update.error?.code).toBe("42501");
    expect(await priceOf(`${prefix}-existing`)).toBe(100000);
  });

  it("does not let anyone but admin call the admin check", async () => {
    const { data } = await user("customer").client.rpc("is_admin");
    expect(data).toBe(false);
    const asAdmin = await user("admin").client.rpc("is_admin");
    expect(asAdmin.data).toBe(true);
  });
});
