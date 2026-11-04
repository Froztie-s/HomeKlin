import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, visitorClient } from "./test-project";
import { createWorld, hours, type World } from "./world";

// The agency's own windows (T27, supabase/migrations/20261104150000_agency_back_office.sql) against
// the real test project: an agency adds, resizes and removes windows only in its own areas; the
// customer's combined free windows follow; agency A never touches agency B's windows; no agency writes
// services or prices.

let world: World;
let start = Date.now() + hours(24 * 20);

beforeAll(async () => {
  world = await createWorld("t27");
}, 180_000);

afterAll(async () => {
  await world.cleanup();
}, 120_000);

function nextWindow() {
  start += hours(3);
  const startsAt = new Date(Math.floor(start / 60_000) * 60_000);
  return { p_starts_at: startsAt.toISOString(), p_ends_at: new Date(startsAt.getTime() + hours(2)).toISOString() };
}

const add = (client = world.users.agencyA.client, overrides: Record<string, unknown> = {}) =>
  client.rpc("add_slot", { p_area: world.area, ...nextWindow(), p_capacity: 2, ...overrides });

async function freeStarts() {
  const { data } = await visitorClient().rpc("free_slots", {
    p_area: world.area,
    p_from: new Date().toISOString(),
    p_to: new Date(Date.now() + hours(24 * 59)).toISOString(),
  });
  return (data ?? []).map((row: { starts_at: string }) => new Date(row.starts_at).toISOString());
}

describe("an agency's windows", { timeout: 30_000 }, () => {
  it("adds a window in its own area that customers then see free", async () => {
    const window = nextWindow();
    const { data: slotId, error } = await world.users.agencyA.client.rpc("add_slot", { p_area: world.area, ...window, p_capacity: 2 });
    expect(error).toBeNull();
    expect(await freeStarts()).toContain(window.p_starts_at);
    const { data, error: listError } = await world.users.agencyA.client.rpc("agency_slots");
    expect(listError).toBeNull();
    expect((data ?? []).find((row: { slot_id: string }) => row.slot_id === slotId)).toMatchObject({ capacity: 2, booked: 0 });

    const mine = await world.users.agencyA.client.rpc("my_agency");
    expect(mine.data?.[0]).toMatchObject({ agency_id: world.agencies.A, area_ids: [world.area] });
  });

  it("refuses an area it does not serve, a bad window, a bad capacity and a duplicate", async () => {
    expect((await add(undefined, { p_area: "jakarta-utara" })).error?.message).toBe("area_not_served");
    const past = new Date(Date.now() - hours(2)).toISOString();
    expect((await add(undefined, { p_starts_at: past, p_ends_at: new Date().toISOString() })).error?.message).toBe("window_invalid");
    const window = nextWindow();
    expect((await add(undefined, { ...window, p_ends_at: window.p_starts_at })).error?.message).toBe("window_invalid");
    expect((await add(undefined, { p_capacity: 0 })).error?.message).toBe("capacity_invalid");
    const twice = nextWindow();
    expect((await add(undefined, twice)).error).toBeNull();
    expect((await add(undefined, twice)).error?.message).toBe("slot_exists");
  });

  it("resizes a window but never below what is booked, and removes only an unbooked one", async () => {
    const { data: slotId } = await add();
    const agency = world.users.agencyA.client;
    expect((await agency.rpc("set_slot_capacity", { p_slot: slotId, p_capacity: 5 })).error).toBeNull();
    await adminClient().from("availability_slots").update({ booked: 3 }).eq("id", slotId);
    expect((await agency.rpc("set_slot_capacity", { p_slot: slotId, p_capacity: 2 })).error?.message).toBe("capacity_below_booked");
    expect((await agency.rpc("delete_slot", { p_slot: slotId })).error?.message).toBe("slot_booked");
    await adminClient().from("availability_slots").update({ booked: 0 }).eq("id", slotId);
    expect((await agency.rpc("delete_slot", { p_slot: slotId })).error).toBeNull();
  });

  it("never lets agency A see or change agency B's windows", async () => {
    const { data: theirs } = await add(world.users.agencyB.client);
    const a = world.users.agencyA.client;
    expect(((await a.rpc("agency_slots")).data ?? []).map((row: { slot_id: string }) => row.slot_id)).not.toContain(theirs);
    expect((await a.rpc("set_slot_capacity", { p_slot: theirs, p_capacity: 9 })).error?.message).toBe("slot_not_found");
    expect((await a.rpc("delete_slot", { p_slot: theirs })).error?.message).toBe("slot_not_found");
    expect((await a.from("availability_slots").update({ capacity: 9 }).eq("id", theirs).select()).data ?? []).toEqual([]);
    expect((await a.rpc("delete_slot", { p_slot: randomUUID() })).error?.message).toBe("slot_not_found");
  });

  it("is for agencies only, and no agency writes services or prices", async () => {
    for (const client of [world.users.customer.client, world.users.cleanerA.client, world.users.admin.client]) {
      expect((await add(client)).error?.code).toBe("42501");
    }
    const agency = world.users.agencyA.client;
    expect((await agency.from("services").update({ price_idr: 1 }).eq("id", world.serviceId).select()).data ?? []).toEqual([]);
    expect((await agency.from("services").insert({ id: `${world.prefix}-x`, category: "rooms", name_id: "x", name_en: "x", description_id: "x", description_en: "x", price_idr: 1, duration_minutes: 60 })).error).not.toBeNull();
    const { data } = await adminClient().from("services").select("price_idr").eq("id", world.serviceId).single();
    expect(data?.price_idr).toBe(world.price);
  });
});
