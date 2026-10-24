import { expect, test as setup } from "@playwright/test";
import { adminClient } from "../../tests/integration/test-project";

// Runs before the suite (the "setup" project in playwright.config.ts): makes sure the test project has
// HomeKlin's catalog, the services, areas and demo agencies, and free arrival windows for the coming
// three weeks, so the catalog specs (T8) see free slots whenever CI runs. The seed adds only what is
// missing: it keeps prices, booked places and each agency's sign-in account as they are.
setup("keeps the catalog and its free windows up to date", async () => {
  // Loaded with import(): Playwright compiles static imports to require(), which cannot load this
  // ES module (it uses import.meta).
  const { seedCatalog } = await import("../../scripts/seed.mjs");
  const result = await seedCatalog({ client: adminClient() });
  console.log(`Catalog ready: ${result.agencies} agencies, ${result.windowsAdded} new arrival windows`);
  expect(result.agencies).toBeGreaterThan(0);
});
