import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "next-intl";

// The catalog (T7): HomeKlin's services with their one price, the service areas, and the free arrival
// windows of an area. This is the interface the customer pages (T8) and booking (T9) read through.
// Every function takes the Supabase client as its first argument: the pages pass the public client
// (src/lib/supabase/public.ts), the tests pass one for the test project.
// The database decides what may be seen (supabase/migrations/20261024100000_catalog.sql): only active
// services, and free windows combined over the partner agencies of an area, never which agency.
// Errors: every function throws a CatalogError when the database answers with an error.

/** The service types customers filter by (jenis layanan); their names are UI text in src/messages. */
export const serviceCategories = ["whole-home", "rooms", "fabrics"] as const;
export type ServiceCategory = (typeof serviceCategories)[number];

/** A text stored in both languages. */
export type Localized = Record<Locale, string>;

export type Service = {
  id: string;
  category: ServiceCategory;
  name: Localized;
  description: Localized;
  /** The full price in whole rupiah; there are no other fees. */
  priceIdr: number;
  durationMinutes: number;
};

export type ServiceArea = {
  id: string;
  name: Localized;
  /** Whether at least one partner agency serves the area, so it can have free windows at all. */
  isServed: boolean;
};

/** An arrival window in which a cleaner can start, as ISO 8601 times (UTC). */
export type FreeSlot = { startsAt: string; endsAt: string };

export type CatalogFilters = {
  /** Only services offered in this area (an area no agency serves offers none). */
  areaId?: string;
  category?: ServiceCategory;
  /** A keyword, matched in the names and descriptions in both languages. */
  query?: string;
};

export class CatalogError extends Error {
  constructor(what: string, cause: { message: string }) {
    super(`Could not read the ${what}: ${cause.message}`);
    this.name = "CatalogError";
  }
}

type ServiceRow = {
  id: string;
  category: ServiceCategory;
  name_id: string;
  name_en: string;
  description_id: string;
  description_en: string;
  price_idr: number;
  duration_minutes: number;
};

type AreaRow = { id: string; name_id: string; name_en: string };
type SlotRow = { starts_at: string; ends_at: string };

function toService(row: ServiceRow): Service {
  return {
    id: row.id,
    category: row.category,
    name: { id: row.name_id, en: row.name_en },
    description: { id: row.description_id, en: row.description_en },
    priceIdr: row.price_idr,
    durationMinutes: row.duration_minutes,
  };
}

/** The active services matching the filters, in the order admin set. */
export async function listServices(client: SupabaseClient, filters: CatalogFilters = {}): Promise<Service[]> {
  const { data, error } = await client.rpc("search_services", {
    p_area: filters.areaId ?? null,
    p_category: filters.category ?? null,
    p_query: filters.query ?? null,
  });
  if (error) throw new CatalogError("services", error);
  return (data as ServiceRow[]).map(toService);
}

/** Every service area, whether or not a partner agency serves it yet. */
export async function listServiceAreas(client: SupabaseClient): Promise<ServiceArea[]> {
  const [areas, served] = await Promise.all([
    client.from("service_areas").select("id, name_id, name_en").order("sort_order"),
    client.rpc("served_area_ids"),
  ]);
  if (areas.error) throw new CatalogError("service areas", areas.error);
  if (served.error) throw new CatalogError("served areas", served.error);
  const servedIds = new Set(served.data as string[]);
  return (areas.data as AreaRow[]).map((row) => ({
    id: row.id,
    name: { id: row.name_id, en: row.name_en },
    isServed: servedIds.has(row.id),
  }));
}

const dayMs = 86_400_000;

/**
 * The free arrival windows of an area from now, for `days` days (1 to 60; the database never looks
 * further than 60 days). A window appears when at least one agency serving the area has a place left.
 */
export async function listFreeSlots(
  client: SupabaseClient,
  areaId: string,
  { days = 14, now = new Date() }: { days?: number; now?: Date } = {},
): Promise<FreeSlot[]> {
  const span = Math.min(Math.max(Math.round(days), 1), 60);
  const { data, error } = await client.rpc("free_slots", {
    p_area: areaId,
    p_from: now.toISOString(),
    p_to: new Date(now.getTime() + span * dayMs).toISOString(),
  });
  if (error) throw new CatalogError("free slots", error);
  return (data as SlotRow[]).map((row) => ({
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
  }));
}
