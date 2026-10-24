import { cacheLife, cacheTag } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { catalogCacheTag, listServiceAreas, listServices, type ServiceCategory } from "./catalog";

// The catalog as the customer pages read it (T8): HomeKlin's services and the service areas, cached
// and tagged with catalogCacheTag. Pages that read them outside any request-time data (the landing
// page, /home) are prerendered with them; when admin changes a service or a price (T7b), its action
// calls updateTag(catalogCacheTag), so the next visit shows the change at once. The hourly lifetime is
// only a safety net for changes made outside the app (the seed, the database console).
// Free arrival windows are not cached here: they change with every booking (T9), so the pages read
// them with listFreeSlots at request time, behind <Suspense>.
// Sources: node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md,
// 04-functions/cacheTag.md and 04-functions/cacheLife.md

/** The active services, optionally of one type or matching a keyword, in admin's order. */
export async function getCatalogServices(filters: { category?: ServiceCategory; query?: string } = {}) {
  "use cache";
  cacheTag(catalogCacheTag);
  cacheLife("hours");
  // Each combination of filters is its own cache entry. The area is not a filter here: whether an area
  // is served comes from getServiceAreas, so one entry serves every served area.
  return listServices(createSupabasePublicClient(), { category: filters.category, query: filters.query });
}

/** Every service area, with whether HomeKlin serves it yet. */
export async function getServiceAreas() {
  "use cache";
  cacheTag(catalogCacheTag);
  cacheLife("hours");
  return listServiceAreas(createSupabasePublicClient());
}
