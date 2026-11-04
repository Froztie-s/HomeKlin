import { expect, test as setup } from "@playwright/test";
import { adminClient } from "../../tests/integration/test-project";

// Runs before the suite (the "setup" project in playwright.config.ts): makes sure the test project has
// HomeKlin's catalog, the services, areas and demo agencies, and free arrival windows for the coming
// three weeks, so the catalog specs (T8) see free slots whenever CI runs. The seed adds only what is
// missing: it keeps prices, booked places and each agency's sign-in account as they are.
// Then it gives back places no order holds. A run that stopped halfway can leave them: deleting a test
// customer deletes their orders (on delete cascade) but not the place each took, and after a few such
// runs the specs find no free window late enough. Only the seeded areas are repaired; the integration
// tests keep exact counts in areas of their own, and may run at the same time.
setup("keeps the catalog and its free windows up to date", async () => {
  // Loaded with import(): Playwright compiles static imports to require(), which cannot load this
  // ES module (it uses import.meta).
  const { seedCatalog } = await import("../../scripts/seed.mjs");
  const { seedAreas } = await import("../../scripts/seed-data.mjs");
  const admin = adminClient();
  const result = await seedCatalog({ client: admin });
  console.log(`Catalog ready: ${result.agencies} agencies, ${result.windowsAdded} new arrival windows`);
  expect(result.agencies).toBeGreaterThan(0);

  const areaIds = seedAreas.map((area: { id: string }) => area.id);
  const now = new Date().toISOString();
  const { data: slots, error } = await admin
    .from("availability_slots")
    .select("id, booked")
    .in("area_id", areaIds)
    .gt("booked", 0)
    .gte("starts_at", now);
  if (error) throw new Error(`Could not read the booked windows: ${error.message}`);
  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("slot_id")
    .in("area_id", areaIds)
    .in("status", ["pending_payment", "paid"])
    .gte("starts_at", now);
  if (ordersError) throw new Error(`Could not read the orders: ${ordersError.message}`);

  let given = 0;
  for (const slot of slots ?? []) {
    const held = (orders ?? []).filter((order) => order.slot_id === slot.id).length;
    if (slot.booked <= held) continue;
    // Only lowers, and only to what is held, so a booking made meanwhile keeps its place.
    const { error: updateError } = await admin
      .from("availability_slots")
      .update({ booked: held })
      .eq("id", slot.id)
      .eq("booked", slot.booked);
    if (updateError) throw new Error(`Could not give the places back: ${updateError.message}`);
    given += slot.booked - held;
  }
  console.log(`Gave back ${given} places no order held`);
});
