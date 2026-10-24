import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agencies, agencyAreas, seedServices } from "../../scripts/seed-data.mjs";
import { seedCatalog, slotTimes } from "../../scripts/seed.mjs";
import { adminClient, createTestUser, deleteTestUsers, visitorClient, type TestUser } from "./test-project";

// The catalog part of the seed (T7, seedCatalog in scripts/seed.mjs) against the real test project.
// The agencies of this run carry their own key prefix and their own agency users, so the demo agencies
// are left alone; afterAll deletes them (their areas and windows go with them). The areas and services
// are HomeKlin's real catalog and stay: seeding them again changes nothing.

const keyPrefix = `t7s-${randomUUID().slice(0, 8)}-`;
const now = new Date();
const users: TestUser[] = [];
const agencyUserIds: Record<string, string> = {};
let firstRun: Awaited<ReturnType<typeof seedCatalog>>;
let secondRun: Awaited<ReturnType<typeof seedCatalog>>;
let bookedSlotId = "";
let regularPrice = 0;

const agencyIds = async () => {
  const { data, error } = await adminClient().from("agencies").select("id, key, user_id").like("key", `${keyPrefix}%`);
  if (error) throw new Error(error.message);
  return data;
};

beforeAll(async () => {
  for (const agency of agencies) {
    const user = await createTestUser(`t7s-${agency.key}`);
    users.push(user);
    agencyUserIds[agency.key] = user.id;
  }
  const admin = adminClient();
  firstRun = await seedCatalog({ client: admin, agencyUserIds, keyPrefix, now });

  // Between the runs, a customer books a place and admin changes a price: the second run keeps both.
  const [first] = await agencyIds();
  const slot = await admin.from("availability_slots").select("id").eq("agency_id", first.id).limit(1).single();
  if (slot.error) throw new Error(slot.error.message);
  bookedSlotId = slot.data.id;
  await admin.from("availability_slots").update({ booked: 1 }).eq("id", bookedSlotId);
  const service = await admin.from("services").select("price_idr").eq("id", "regular").single();
  if (service.error) throw new Error(service.error.message);
  regularPrice = service.data.price_idr;
  await admin.from("services").update({ price_idr: regularPrice + 1 }).eq("id", "regular");

  secondRun = await seedCatalog({ client: admin, agencyUserIds, keyPrefix, now });
}, 120_000);

afterAll(async () => {
  const admin = adminClient();
  if (regularPrice) await admin.from("services").update({ price_idr: regularPrice }).eq("id", "regular");
  await admin.from("agencies").delete().like("key", `${keyPrefix}%`);
  await deleteTestUsers(users);
}, 60_000);

describe("seedCatalog", () => {
  it("links each partner agency to its agency user", async () => {
    const rows = await agencyIds();
    expect(rows.map(({ key, user_id }) => [key, user_id]).sort()).toEqual(
      agencies.map(({ key }) => [`${keyPrefix}${key}`, agencyUserIds[key]]).sort(),
    );
  });

  it("gives each agency its areas, overlapping where the seed data says", async () => {
    const rows = await agencyIds();
    for (const agency of agencies) {
      const id = rows.find((row) => row.key === `${keyPrefix}${agency.key}`)?.id;
      const { data } = await adminClient().from("agency_areas").select("area_id").eq("agency_id", id);
      expect((data ?? []).map((row) => row.area_id).sort(), agency.key).toEqual([...(agencyAreas[agency.key] ?? [])].sort());
    }
  });

  it("adds every arrival window of the pattern once, and nothing on the second run", async () => {
    const perAgency = slotTimes(now).length;
    const expected = agencies.reduce((sum, { key }) => sum + (agencyAreas[key]?.length ?? 0) * perAgency, 0);
    expect(firstRun.windowsAdded).toBe(expected);
    expect(secondRun.windowsAdded).toBe(0);

    const ids = (await agencyIds()).map((row) => row.id);
    const { count } = await adminClient()
      .from("availability_slots")
      .select("id", { count: "exact", head: true })
      .in("agency_id", ids);
    expect(count).toBe(expected);
  });

  it("keeps a booked place and a changed price when it runs again", async () => {
    const slot = await adminClient().from("availability_slots").select("booked").eq("id", bookedSlotId).single();
    expect(slot.data?.booked).toBe(1);
    const service = await adminClient().from("services").select("price_idr").eq("id", "regular").single();
    expect(service.data?.price_idr).toBe(regularPrice + 1);
  });

  it("seeds every service, so the catalog has them all", async () => {
    const { data } = await visitorClient().from("services").select("id");
    expect((data ?? []).map((row) => row.id)).toEqual(expect.arrayContaining(seedServices.map((service) => service.id)));
  });

  it("leaves an area nobody serves without free windows (the empty state)", async () => {
    const served = new Set(Object.values(agencyAreas).flat());
    const { data } = await visitorClient().rpc("free_slots", {
      p_area: "jakarta-utara",
      p_from: now.toISOString(),
      p_to: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
    });
    expect(served.has("jakarta-utara")).toBe(false);
    expect(data).toEqual([]);
  });
});
