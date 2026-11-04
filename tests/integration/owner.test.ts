import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUsers, visitorClient, type TestUser } from "./test-project";
import { createWorld, hours, type World } from "./world";

// The owner (T29b, T29c; supabase/migrations/20261104160000_owner_role.sql and 20261104160100_owner.sql)
// against the real test project: only the owner reads the business numbers, oversees agencies and
// lists admins; nobody becomes an owner by signing up; a suspended agency gets no booking and its
// windows vanish, while the routing to active agencies is unchanged.

let world: World;
let owner: TestUser | undefined;
let start = Date.now() + hours(24 * 25);

function ownerUser(): TestUser {
  if (!owner) throw new Error("The owner test user was not created (see beforeAll).");
  return owner;
}

beforeAll(async () => {
  world = await createWorld("t29b");
  owner = await createTestUser("t29b-owner");
  await adminClient().from("profiles").update({ role: "owner" }).eq("id", owner.id);
}, 180_000);

afterAll(async () => {
  await deleteTestUsers([owner]);
  await world.cleanup();
}, 120_000);

function window() {
  start += hours(3);
  const startsAt = new Date(Math.floor(start / 60_000) * 60_000);
  return { startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + hours(2)).toISOString() };
}

async function slotsAt(times: { startsAt: string; endsAt: string }, agencies: ("A" | "B")[]) {
  const rows = agencies.map((agency) => ({
    agency_id: world.agencies[agency], area_id: world.area, starts_at: times.startsAt, ends_at: times.endsAt, capacity: 1,
  }));
  const { error } = await adminClient().from("availability_slots").insert(rows);
  if (error) throw new Error(`Could not add the windows: ${error.message}`);
}

const book = (startsAt: string) =>
  world.users.customer.client.rpc("book_slot", {
    p_service: world.serviceId, p_area: world.area, p_starts_at: startsAt,
    p_address: "Jl. Uji Pemilik No. 29, Jakarta", p_phone: "+6281234567890", p_consent: true,
  });

const setStatus = (agency: "A" | "B", status: string) =>
  ownerUser().client.rpc("owner_set_agency_status", { p_agency: world.agencies[agency], p_status: status });

describe("the owner's numbers", { timeout: 30_000 }, () => {
  it("adds up paid orders, by status and per agency, with no customer data", async () => {
    await world.job({ startsAt: new Date(Date.now() - hours(5)), completed: true });
    await world.job({ startsAt: new Date(Date.now() + hours(5)), agency: "B", cleaner: world.users.cleanerB });
    await world.job({ startsAt: new Date(Date.now() + hours(6)), status: "failed" });
    const { data, error } = await ownerUser().client.rpc("owner_numbers");
    expect(error).toBeNull();
    expect(data.revenue_idr).toBeGreaterThanOrEqual(2 * world.price);
    expect(Object.keys(data.by_status).sort()).toEqual(["cancelled", "failed", "paid", "pending_payment"]);
    expect(data.trend).toHaveLength(30);
    const agencyA = data.agencies.find((row: { agency_id: string }) => row.agency_id === world.agencies.A);
    expect(agencyA).toMatchObject({ jobs: 1, completed: 1, revenue_idr: world.price, status: "active" });
    const text = JSON.stringify(data);
    for (const secret of [world.users.customer.email, "+6281234567890", "Uji Pelanggan", "Jl. Uji"]) expect(text).not.toContain(secret);
  });

  it("is refused to every other role, and to a visitor", async () => {
    for (const user of [world.users.customer, world.users.cleanerA, world.users.agencyA, world.users.admin]) {
      for (const fn of ["owner_numbers", "owner_agencies", "owner_admins"]) {
        expect((await user.client.rpc(fn)).error?.code, `${user.email} ${fn}`).toBe("42501");
      }
      expect((await user.client.rpc("owner_set_agency_status", { p_agency: world.agencies.A, p_status: "suspended" })).error?.code).toBe("42501");
    }
    expect((await visitorClient().rpc("owner_numbers")).error?.code).toBe("42501");
  });

  it("cannot be reached by signing up with an owner role in the metadata", async () => {
    const intruder = await createTestUser("t29b-intruder", { role: "owner", full_name: "Bukan Pemilik" });
    try {
      const { data } = await adminClient().from("profiles").select("role").eq("id", intruder.id).single();
      expect(data?.role).toBe("customer");
      expect((await intruder.client.rpc("owner_numbers")).error?.code).toBe("42501");
    } finally {
      await deleteTestUsers([intruder]);
    }
  });
});

describe("partner agencies", { timeout: 30_000 }, () => {
  it("lists the agencies with their numbers, adds one, and lists the admins", async () => {
    const { data: newAgency, error } = await ownerUser().client.rpc("owner_add_agency", { p_name: `Uji Mitra ${world.prefix}`, p_areas: [world.area] });
    expect(error).toBeNull();
    const { data } = await ownerUser().client.rpc("owner_agencies");
    const added = (data ?? []).find((row: { agency_id: string }) => row.agency_id === newAgency);
    expect(added).toMatchObject({ status: "active", area_ids: [world.area], cleaners: 0, has_sign_in: false });
    await adminClient().from("agencies").delete().eq("id", newAgency);

    expect((await ownerUser().client.rpc("owner_add_agency", { p_name: "x", p_areas: [] })).error?.message).toBe("name_invalid");
    expect((await ownerUser().client.rpc("owner_add_agency", { p_name: "Uji Tanpa Area", p_areas: ["no-such-area"] })).error?.message).toBe("area_not_found");

    const admins = await ownerUser().client.rpc("owner_admins");
    expect((admins.data ?? []).map((row: { user_id: string }) => row.user_id)).toContain(world.users.admin.id);
  });

  it("gives a suspended agency no booking and hides its windows; reactivating brings them back", async () => {
    const onlyB = window();
    await slotsAt(onlyB, ["B"]);
    const free = async () => {
      const { data } = await visitorClient().rpc("free_slots", {
        p_area: world.area, p_from: new Date().toISOString(), p_to: new Date(Date.now() + hours(24 * 59)).toISOString(),
      });
      return (data ?? []).map((row: { starts_at: string }) => new Date(row.starts_at).toISOString());
    };
    expect(await free()).toContain(onlyB.startsAt);

    expect((await setStatus("B", "suspended")).error).toBeNull();
    try {
      expect(await free()).not.toContain(onlyB.startsAt);
      expect((await book(onlyB.startsAt)).error?.message).toBe("slot_unavailable");

      const both = window();
      await slotsAt(both, ["A", "B"]);
      const { data, error } = await book(both.startsAt);
      expect(error).toBeNull();
      const { data: order } = await adminClient().from("orders").select("agency_id").eq("id", data?.[0]?.order_id).single();
      expect(order?.agency_id).toBe(world.agencies.A);
    } finally {
      expect((await setStatus("B", "active")).error).toBeNull();
    }
    expect(await free()).toContain(onlyB.startsAt);
    expect((await book(onlyB.startsAt)).error).toBeNull();
  });

  it("keeps the jobs a suspended agency already has", async () => {
    const job = await world.job({ startsAt: new Date(Date.now() + hours(9)), agency: "B", cleaner: world.users.cleanerB });
    await setStatus("B", "suspended");
    try {
      const jobs = await world.users.agencyB.client.rpc("agency_jobs");
      expect((jobs.data ?? []).map((row: { order_id: string }) => row.order_id)).toContain(job);
    } finally {
      await setStatus("B", "active");
    }
  });

  it("refuses an unknown status or agency", async () => {
    expect((await setStatus("A", "closed")).error?.message).toBe("status_invalid");
    expect((await ownerUser().client.rpc("owner_set_agency_status", { p_agency: "00000000-0000-4000-8000-000000000000", p_status: "active" })).error?.message).toBe("agency_not_found");
  });
});
