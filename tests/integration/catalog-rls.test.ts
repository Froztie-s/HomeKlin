import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listFreeSlots, listServiceAreas, listServices } from "@/lib/catalog/catalog";
import { adminClient, createTestUser, deleteTestUsers, visitorClient, type TestUser } from "./test-project";

// The catalog (T7, supabase/migrations/20261024100000_catalog.sql), checked against the real database
// of the test project. Visitors and customers read the active services and the areas, and the free
// arrival windows of an area combined over the agencies serving it, never which agency is behind them.
// Everything this test creates carries a random prefix, so its answers are exact and the shared demo
// data is left alone. Postgres error 42501 is "insufficient privilege".

const prefix = `t7-${randomUUID().slice(0, 8)}`;
const token = `zq${randomUUID().slice(0, 6)}`; // a word no real service contains
const areas = { north: `${prefix}-north`, both: `${prefix}-both`, none: `${prefix}-none` };
const agencyKeys = { a: `${prefix}-a`, b: `${prefix}-b` };

// Arrival windows two days from now, in Jakarta time (UTC+7): 08.00-10.00, 10.00-12.00, 13.00-15.00.
const day = new Date(Date.now() + 2 * 86_400_000);
const at = (hourWib: number, dayOffset = 0) =>
  new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + dayOffset, hourWib - 7)).toISOString();
const windows = {
  w1: { starts_at: at(8), ends_at: at(10) },
  w2: { starts_at: at(10), ends_at: at(12) },
  w3: { starts_at: at(13), ends_at: at(15) },
};

let customer: TestUser | undefined;

async function must<T>(label: string, result: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await result;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

beforeAll(async () => {
  const admin = adminClient();
  await must("areas", admin.from("service_areas").insert([
    { id: areas.north, name_id: "Uji Utara", name_en: "Test North" },
    { id: areas.both, name_id: "Uji Tengah", name_en: "Test Middle" },
    { id: areas.none, name_id: "Uji Kosong", name_en: "Test Empty" },
  ]));
  const agencies = await must("agencies", admin.from("agencies").insert([
    { key: agencyKeys.a, name: "Uji Agensi A" },
    { key: agencyKeys.b, name: "Uji Agensi B" },
  ]).select("id, key"));
  const id = (key: string) => (agencies ?? []).find((agency) => agency.key === key)?.id as string;
  const a = id(agencyKeys.a);
  const b = id(agencyKeys.b);

  // Agency A serves north and both; agency B serves both; nobody serves none.
  await must("coverage", admin.from("agency_areas").insert([
    { agency_id: a, area_id: areas.north },
    { agency_id: a, area_id: areas.both },
    { agency_id: b, area_id: areas.both },
  ]));
  await must("slots", admin.from("availability_slots").insert([
    // north: one free window.
    { agency_id: a, area_id: areas.north, ...windows.w1, capacity: 2, booked: 0 },
    // north: in the past, and too far ahead: never offered.
    { agency_id: a, area_id: areas.north, starts_at: at(8, -3), ends_at: at(10, -3), capacity: 1, booked: 0 },
    { agency_id: a, area_id: areas.north, starts_at: at(8, 70), ends_at: at(10, 70), capacity: 1, booked: 0 },
    // both, w1: A is full, B still has a place, so the window is offered.
    { agency_id: a, area_id: areas.both, ...windows.w1, capacity: 1, booked: 1 },
    { agency_id: b, area_id: areas.both, ...windows.w1, capacity: 1, booked: 0 },
    // both, w2: only A has it, and A is full, so it is not offered.
    { agency_id: a, area_id: areas.both, ...windows.w2, capacity: 1, booked: 1 },
    // both, w3: B has one of two places left.
    { agency_id: b, area_id: areas.both, ...windows.w3, capacity: 2, booked: 1 },
  ]));

  await must("services", admin.from("services").insert([
    {
      id: `${prefix}-alpha`, category: "rooms", sort_order: 900,
      name_id: `Uji Kilap ${token}`, name_en: `Test Shine ${token}`,
      description_id: "Layanan uji.", description_en: "A test service.",
      price_idr: 100000, duration_minutes: 60,
    },
    {
      id: `${prefix}-beta`, category: "fabrics", sort_order: 901, is_active: false,
      name_id: `Uji Nonaktif ${token}`, name_en: `Test Inactive ${token}`,
      description_id: "Layanan uji yang tidak aktif.", description_en: "An inactive test service.",
      price_idr: 100000, duration_minutes: 60,
    },
    {
      id: `${prefix}-gamma`, category: "whole-home", sort_order: 902,
      name_id: `Uji Rumah ${token}`, name_en: `Test Home ${token}`,
      description_id: "Bersih 100% seluruh rumah.", description_en: "A 100% clean home.",
      price_idr: 200000, duration_minutes: 120,
    },
    // A column missing from one row takes its default, not null (a bulk insert unites the columns).
  ], { defaultToNull: false }));

  customer = await createTestUser("t7-customer");
}, 60_000);

afterAll(async () => {
  const admin = adminClient();
  await admin.from("services").delete().like("id", `${prefix}-%`);
  // Deleting the agencies removes their areas and slots too (on delete cascade).
  await admin.from("agencies").delete().like("key", `${prefix}-%`);
  await admin.from("service_areas").delete().like("id", `${prefix}-%`);
  await deleteTestUsers([customer]);
}, 60_000);

function signedIn(user: TestUser | undefined): TestUser {
  if (!user) throw new Error("The test user was not created (see beforeAll).");
  return user;
}

const ownIds = (rows: { id: string }[] | null) => (rows ?? []).map((row) => row.id).filter((id) => id.startsWith(prefix));
const times = (rows: { starts_at: string; ends_at: string }[] | null) =>
  (rows ?? []).map((row) => [new Date(row.starts_at).toISOString(), new Date(row.ends_at).toISOString()]);

describe("services and areas", () => {
  it("lets a visitor read the active services but not the inactive ones", async () => {
    const { data, error } = await visitorClient().from("services").select("id").like("id", `${prefix}-%`).order("id");
    expect(error).toBeNull();
    expect(ownIds(data)).toEqual([`${prefix}-alpha`, `${prefix}-gamma`]);
  });

  it("lets a visitor read the service areas", async () => {
    const { data, error } = await visitorClient().from("service_areas").select("id").like("id", `${prefix}-%`).order("id");
    expect(error).toBeNull();
    expect(ownIds(data)).toEqual([areas.both, areas.none, areas.north]);
  });

  it("refuses a visitor or a customer who tries to change a price or add a service", async () => {
    for (const client of [visitorClient(), signedIn(customer).client]) {
      const update = await client.from("services").update({ price_idr: 1 }).eq("id", `${prefix}-alpha`);
      const insert = await client.from("services").insert({
        id: `${prefix}-evil`, category: "rooms", name_id: "x", name_en: "x",
        description_id: "x", description_en: "x", price_idr: 1, duration_minutes: 60,
      });
      expect(update.error?.code).toBe("42501");
      expect(insert.error?.code).toBe("42501");
    }
    const { data } = await adminClient().from("services").select("price_idr").eq("id", `${prefix}-alpha`).single();
    expect(data?.price_idr).toBe(100000);
  });
});

describe("agency data stays private", () => {
  it("gives a visitor and a customer no access to agencies, their areas or their slots", async () => {
    for (const client of [visitorClient(), signedIn(customer).client]) {
      for (const table of ["agencies", "agency_areas", "availability_slots"]) {
        const { data, error } = await client.from(table).select("*").limit(1);
        expect(error?.code, table).toBe("42501");
        expect(data, table).toBeNull();
      }
    }
  });
});

describe("free_slots", () => {
  const range = { p_from: new Date().toISOString(), p_to: new Date(Date.now() + 90 * 86_400_000).toISOString() };

  it("offers a window when at least one agency serving the area still has a place", async () => {
    const { data, error } = await visitorClient().rpc("free_slots", { p_area: areas.both, ...range });
    expect(error).toBeNull();
    // w1 (A full, B free) and w3 (B free); w2 only A had, and A is full.
    expect(times(data)).toEqual([
      [windows.w1.starts_at, windows.w1.ends_at],
      [windows.w3.starts_at, windows.w3.ends_at],
    ]);
  });

  it("returns times only, never an agency, a capacity or a count", async () => {
    const { data } = await visitorClient().rpc("free_slots", { p_area: areas.both, ...range });
    for (const row of data ?? []) expect(Object.keys(row).sort()).toEqual(["ends_at", "starts_at"]);
  });

  it("leaves out past windows and windows more than 60 days ahead", async () => {
    const { data } = await visitorClient().rpc("free_slots", { p_area: areas.north, ...range });
    expect(times(data)).toEqual([[windows.w1.starts_at, windows.w1.ends_at]]);
  });

  it("offers nothing in an area no agency serves", async () => {
    const { data, error } = await signedIn(customer).client.rpc("free_slots", { p_area: areas.none, ...range });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("knows which areas are served, without saying by whom", async () => {
    const { data, error } = await visitorClient().rpc("served_area_ids");
    expect(error).toBeNull();
    const ids = (data ?? []) as string[];
    expect(ids).toEqual(expect.arrayContaining([areas.north, areas.both]));
    expect(ids).not.toContain(areas.none);
  });
});

describe("search_services", () => {
  const search = async (args: { p_query?: string; p_category?: string; p_area?: string }) => {
    const { data, error } = await visitorClient().rpc("search_services", args);
    expect(error).toBeNull();
    return ownIds(data);
  };

  it("finds a service by a keyword in Indonesian or in English, ignoring case", async () => {
    expect(await search({ p_query: `kilap ${token}` })).toEqual([`${prefix}-alpha`]);
    expect(await search({ p_query: `SHINE ${token}` })).toEqual([`${prefix}-alpha`]);
  });

  it("never returns an inactive service, whatever the keyword", async () => {
    expect(await search({ p_query: token })).toEqual([`${prefix}-alpha`, `${prefix}-gamma`]);
  });

  it("filters by service type", async () => {
    expect(await search({ p_query: token, p_category: "whole-home" })).toEqual([`${prefix}-gamma`]);
  });

  it("offers services only in an area some agency serves", async () => {
    expect(await search({ p_query: token, p_area: areas.both })).toEqual([`${prefix}-alpha`, `${prefix}-gamma`]);
    expect(await search({ p_query: token, p_area: areas.none })).toEqual([]);
  });

  it("comes back through src/lib/catalog in the app's types", async () => {
    const services = (await listServices(visitorClient(), { query: token, areaId: areas.both })).filter((service) =>
      service.id.startsWith(prefix),
    );
    expect(services.map((service) => service.id)).toEqual([`${prefix}-alpha`, `${prefix}-gamma`]);
    expect(services[0]).toMatchObject({
      category: "rooms",
      name: { id: `Uji Kilap ${token}`, en: `Test Shine ${token}` },
      priceIdr: 100000,
      durationMinutes: 60,
    });

    const own = (await listServiceAreas(visitorClient())).filter((area) => area.id.startsWith(prefix));
    expect(own.map(({ id, isServed }) => [id, isServed])).toEqual(
      expect.arrayContaining([[areas.north, true], [areas.both, true], [areas.none, false]]),
    );

    const slots = await listFreeSlots(visitorClient(), areas.both, { days: 7 });
    expect(slots).toEqual([
      { startsAt: windows.w1.starts_at, endsAt: windows.w1.ends_at },
      { startsAt: windows.w3.starts_at, endsAt: windows.w3.ends_at },
    ]);
  });

  it("matches % and _ literally, not as wildcards", async () => {
    expect(await search({ p_query: "100%" })).toEqual([`${prefix}-gamma`]);
    expect(await search({ p_query: `${token.slice(0, 2)}_` })).toEqual([]);
  });
});
