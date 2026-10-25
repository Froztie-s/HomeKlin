import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listMyOrders } from "@/lib/booking/orders";
import { adminClient, createTestUser, deleteTestUsers, visitorClient, type TestUser } from "./test-project";

// Booking with automatic routing (T9, supabase/migrations/20261025090000_orders.sql), against the real
// test project. book_slot() takes one place in an arrival window of a partner agency serving the area
// and creates the order, in one transaction; two customers racing for the last place cannot both win.
// The answer never says which agency got the order. Everything here carries a random prefix: its own
// areas, agencies, windows and service, so the answers are exact.

const prefix = `t9-${randomUUID().slice(0, 8)}`;
const area = `${prefix}-area`;
const otherArea = `${prefix}-other`;
const serviceId = `${prefix}-svc`;
const address = "Jl. Uji Coba No. 1, Kebayoran Baru, Jakarta Selatan";
const customers: TestUser[] = [];
const others: TestUser[] = [];
let agencyA = "";
let agencyB = "";
let window = 0; // each test books its own windows, so tests do not share capacity

/** A fresh arrival window, days ahead, in whole hours UTC. */
function nextWindow() {
  window += 1;
  const start = new Date(Date.UTC(2030, 0, 1 + window, 1));
  return { starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 2 * 3_600_000).toISOString() };
}

async function addSlots(rows: { agency: string; capacity: number; booked?: number; times: { starts_at: string; ends_at: string } }[]) {
  const { error } = await adminClient()
    .from("availability_slots")
    .insert(rows.map(({ agency, capacity, booked = 0, times }) => ({ agency_id: agency, area_id: area, capacity, booked, ...times })));
  if (error) throw new Error(`Could not add slots: ${error.message}`);
}

const book = (user: TestUser, startsAt: string, overrides: Record<string, unknown> = {}) =>
  user.client.rpc("book_slot", {
    p_service: serviceId,
    p_area: area,
    p_starts_at: startsAt,
    p_address: address,
    p_consent: true,
    ...overrides,
  });

const ordersAt = async (startsAt: string) => {
  const { data } = await adminClient().from("orders").select("agency_id, status").eq("area_id", area).eq("starts_at", startsAt);
  return data ?? [];
};

beforeAll(async () => {
  const admin = adminClient();
  await admin.from("service_areas").insert([
    { id: area, name_id: "Uji Area", name_en: "Test Area" },
    { id: otherArea, name_id: "Uji Lain", name_en: "Test Other" },
  ]);
  const { data: agencies } = await admin
    .from("agencies")
    .insert([{ key: `${prefix}-a`, name: "Uji Agensi A" }, { key: `${prefix}-b`, name: "Uji Agensi B" }])
    .select("id, key");
  agencyA = agencies?.find((row) => row.key === `${prefix}-a`)?.id ?? "";
  agencyB = agencies?.find((row) => row.key === `${prefix}-b`)?.id ?? "";
  await admin.from("agency_areas").insert([
    { agency_id: agencyA, area_id: area },
    { agency_id: agencyB, area_id: area },
  ]);
  await admin.from("services").insert({
    id: serviceId, category: "rooms", name_id: "Uji Pesan", name_en: "Test Booking",
    description_id: "Layanan uji.", description_en: "A test service.", price_idr: 123000, duration_minutes: 60,
  });
  for (let i = 0; i < 3; i += 1) customers.push(await createTestUser(`t9-customer-${i}`));
  for (const role of ["agency", "admin"] as const) {
    const user = await createTestUser(`t9-${role}`);
    await admin.from("profiles").update({ role }).eq("id", user.id);
    others.push(user);
  }
}, 120_000);

afterAll(async () => {
  const admin = adminClient();
  // Orders go with their customers (on delete cascade); then the test's catalog rows.
  await deleteTestUsers([...customers, ...others]);
  await admin.from("agencies").delete().like("key", `${prefix}-%`);
  await admin.from("services").delete().eq("id", serviceId);
  await admin.from("service_areas").delete().like("id", `${prefix}-%`);
}, 60_000);

describe("book_slot routing", () => {
  it("books a free window: the order waits for payment, at the service's price, and names no agency", async () => {
    const times = nextWindow();
    await addSlots([{ agency: agencyA, capacity: 2, times }]);

    const { data, error } = await book(customers[0], times.starts_at);

    expect(error).toBeNull();
    const [order] = data ?? [];
    expect(Object.keys(order).sort()).toEqual(["ends_at", "order_id", "price_idr", "service_id", "starts_at", "status"]);
    expect(order).toMatchObject({ service_id: serviceId, status: "pending_payment", price_idr: 123000 });
    expect(new Date(order.starts_at).toISOString()).toBe(times.starts_at);
    expect(await ordersAt(times.starts_at)).toEqual([{ agency_id: agencyA, status: "pending_payment" }]);
  });

  it("routes to the agency that still has a place when the other is full", async () => {
    const times = nextWindow();
    await addSlots([
      { agency: agencyA, capacity: 1, booked: 1, times },
      { agency: agencyB, capacity: 1, times },
    ]);

    const { error } = await book(customers[0], times.starts_at);

    expect(error).toBeNull();
    expect(await ordersAt(times.starts_at)).toEqual([{ agency_id: agencyB, status: "pending_payment" }]);
  });

  it("spreads bookings over the agencies when several have places", async () => {
    const times = nextWindow();
    await addSlots([
      { agency: agencyA, capacity: 1, times },
      { agency: agencyB, capacity: 1, times },
    ]);

    expect((await book(customers[0], times.starts_at)).error).toBeNull();
    expect((await book(customers[1], times.starts_at)).error).toBeNull();
    const agencies = (await ordersAt(times.starts_at)).map((row) => row.agency_id).sort();
    expect(agencies).toEqual([agencyA, agencyB].sort());
  });

  it("refuses a window where no agency has a place left", async () => {
    const times = nextWindow();
    await addSlots([{ agency: agencyA, capacity: 1, booked: 1, times }]);

    const { data, error } = await book(customers[0], times.starts_at);

    expect(data).toBeNull();
    expect(error?.message).toBe("slot_unavailable");
    expect(await ordersAt(times.starts_at)).toEqual([]);
  });

  it("refuses a window no agency offers at all, and one in another area", async () => {
    const times = nextWindow();
    expect((await book(customers[0], times.starts_at)).error?.message).toBe("slot_unavailable");
    await addSlots([{ agency: agencyA, capacity: 1, times }]);
    expect((await book(customers[0], times.starts_at, { p_area: otherArea })).error?.message).toBe("slot_unavailable");
  });

  it("refuses a window that has already started", async () => {
    const start = new Date(Date.now() - 3_600_000);
    const times = { starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 7_200_000).toISOString() };
    await addSlots([{ agency: agencyA, capacity: 1, times }]);
    expect((await book(customers[0], times.starts_at)).error?.message).toBe("slot_unavailable");
  });
});

describe("book_slot race safety", () => {
  it("lets exactly one of two customers take the last place, every time", async () => {
    for (let round = 0; round < 5; round += 1) {
      const times = nextWindow();
      await addSlots([{ agency: agencyA, capacity: 1, times }]);

      const results = await Promise.all([book(customers[0], times.starts_at), book(customers[1], times.starts_at)]);

      const won = results.filter((result) => result.error === null);
      const lost = results.filter((result) => result.error !== null);
      expect(won, `round ${round}`).toHaveLength(1);
      expect(lost.map((result) => result.error?.message), `round ${round}`).toEqual(["slot_unavailable"]);
      expect(await ordersAt(times.starts_at), `round ${round}`).toHaveLength(1);
    }
  }, 60_000);

  it("never books more places than an agency offers, even with three customers at once", async () => {
    const times = nextWindow();
    await addSlots([{ agency: agencyA, capacity: 2, times }]);

    const results = await Promise.all(customers.map((customer) => book(customer, times.starts_at)));

    expect(results.filter((result) => result.error === null)).toHaveLength(2);
    const { data } = await adminClient().from("availability_slots").select("booked, capacity").eq("agency_id", agencyA).eq("starts_at", times.starts_at).single();
    expect(data).toEqual({ booked: 2, capacity: 2 });
  });
});

describe("book_slot refusals", () => {
  it("requires the streaming consent", async () => {
    const times = nextWindow();
    await addSlots([{ agency: agencyA, capacity: 1, times }]);
    const { error } = await book(customers[0], times.starts_at, { p_consent: false });
    expect(error?.message).toBe("consent_required");
    expect(await ordersAt(times.starts_at)).toEqual([]);
  });

  it("refuses an address that is too short or too long", async () => {
    const times = nextWindow();
    await addSlots([{ agency: agencyA, capacity: 1, times }]);
    expect((await book(customers[0], times.starts_at, { p_address: "Jl. A" })).error?.message).toBe("address_invalid");
    expect((await book(customers[0], times.starts_at, { p_address: "x".repeat(301) })).error?.message).toBe("address_invalid");
  });

  it("refuses a service that is switched off or does not exist", async () => {
    const times = nextWindow();
    await addSlots([{ agency: agencyA, capacity: 1, times }]);
    expect((await book(customers[0], times.starts_at, { p_service: `${prefix}-none` })).error?.message).toBe("service_unavailable");
  });

  it("lets only customers book: not an agency, not admin, not a visitor", async () => {
    const times = nextWindow();
    await addSlots([{ agency: agencyA, capacity: 3, times }]);
    for (const user of others) expect((await book(user, times.starts_at)).error?.message).toBe("not_customer");
    const visitor = await visitorClient().rpc("book_slot", {
      p_service: serviceId, p_area: area, p_starts_at: times.starts_at, p_address: address, p_consent: true,
    });
    expect(visitor.error?.code).toBe("42501");
    expect(await ordersAt(times.starts_at)).toEqual([]);
  });
});

describe("orders stay private", () => {
  it("gives customers no direct access to the orders table, which holds the agency", async () => {
    const { data, error } = await customers[0].client.from("orders").select("*").limit(1);
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("lists a customer's own orders through my_orders(), without the agency", async () => {
    const times = nextWindow();
    await addSlots([{ agency: agencyA, capacity: 2, times }]);
    const mine = await book(customers[2], times.starts_at);
    await book(customers[1], times.starts_at);

    const { data, error } = await customers[2].client.rpc("my_orders");
    expect(error).toBeNull();
    const own = (data ?? []).filter((row: { starts_at: string }) => new Date(row.starts_at).toISOString() === times.starts_at);
    expect(own.map((row: { order_id: string }) => row.order_id)).toEqual([mine.data?.[0]?.order_id]);
    for (const row of data ?? []) {
      expect(Object.keys(row)).not.toContain("agency_id");
      expect(Object.keys(row)).not.toContain("slot_id");
    }

    // The same through src/lib/booking/orders.ts, in the app's types.
    const orders = (await listMyOrders(customers[2].client)).filter((order) => order.startsAt === times.starts_at);
    expect(orders).toEqual([
      expect.objectContaining({ id: mine.data?.[0]?.order_id, serviceId, areaId: area, address, priceIdr: 123000, status: "pending_payment" }),
    ]);
  });
});
