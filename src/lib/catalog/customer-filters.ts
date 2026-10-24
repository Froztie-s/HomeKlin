import type { CatalogFilters, ServiceArea } from "./catalog";

// The filters of the customer catalog (/services, T8) live in the address (?area=&type=&q=, read by
// parseCatalogFilters in src/lib/validation/catalog.ts), so a choice survives a reload and can be
// shared. Without ?area= the page shows the default area.

/** The area a new visitor sees first. */
export const defaultAreaId = "jakarta-selatan";

/**
 * The area to show: the one in the address if it exists (served or not, so an unserved area gets its
 * own empty state), otherwise the default, otherwise the first area. Null only when there are none.
 */
export function resolveArea(areas: readonly ServiceArea[], requested: string | undefined): ServiceArea | null {
  return (
    areas.find((area) => area.id === requested) ??
    areas.find((area) => area.id === defaultAreaId) ??
    areas[0] ??
    null
  );
}

/** The query string of a catalog address, e.g. "?area=jakarta-timur&type=fabrics", or "" with no filters. */
export function catalogQuery({ areaId, category, query }: CatalogFilters): string {
  const params = new URLSearchParams();
  if (areaId) params.set("area", areaId);
  if (category) params.set("type", category);
  if (query) params.set("q", query);
  const text = params.toString();
  return text ? `?${text}` : "";
}
