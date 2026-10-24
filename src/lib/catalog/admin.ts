import type { SupabaseClient } from "@supabase/supabase-js";
import { CatalogError, type Service, type ServiceCategory } from "./catalog";
import { serviceLimits } from "@/lib/validation/service";

// What admin reads to manage HomeKlin's services and price list (T7b, /admin/services). Every
// function takes the signed-in admin's own Supabase client (src/lib/supabase/server.ts), never the
// secret key: row-level security (supabase/migrations/20261024120000_admin_services.sql) lets only an
// admin see the services that are switched off, so anyone else would get the active ones at most.
// The customer side reads the catalog through src/lib/catalog/catalog.ts instead.
// Errors: every function throws a CatalogError when the database answers with an error.

/** A service with what only admin works with: whether customers see it, and its place in the list. */
export type AdminService = Service & {
  /** Shown in the customer catalog. Switching a service off keeps it for past orders. */
  isActive: boolean;
  /** Lower numbers come first in the catalog. */
  sortOrder: number;
};

type AdminServiceRow = {
  id: string;
  category: ServiceCategory;
  name_id: string;
  name_en: string;
  description_id: string;
  description_en: string;
  price_idr: number;
  duration_minutes: number;
  is_active: boolean;
  sort_order: number;
};

const columns =
  "id, category, name_id, name_en, description_id, description_en, price_idr, duration_minutes, is_active, sort_order";

function toAdminService(row: AdminServiceRow): AdminService {
  return {
    id: row.id,
    category: row.category,
    name: { id: row.name_id, en: row.name_en },
    description: { id: row.description_id, en: row.description_en },
    priceIdr: row.price_idr,
    durationMinutes: row.duration_minutes,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

/** Every service, switched on or off, in the order the catalog shows them. */
export async function listAllServices(client: SupabaseClient): Promise<AdminService[]> {
  const { data, error } = await client.from("services").select(columns).order("sort_order").order("id");
  if (error) throw new CatalogError("services", error);
  return (data as AdminServiceRow[]).map(toAdminService);
}

/** One service by its id, or null when there is none. */
export async function getService(client: SupabaseClient, id: string): Promise<AdminService | null> {
  const { data, error } = await client.from("services").select(columns).eq("id", id).maybeSingle();
  if (error) throw new CatalogError("service", error);
  return data ? toAdminService(data as AdminServiceRow) : null;
}

/** The place for a new service: after the last one, within what the form accepts. */
export function nextSortOrder(services: readonly AdminService[]): number {
  if (services.length === 0) return 0;
  const last = Math.max(...services.map((service) => service.sortOrder));
  return Math.min(last + 1, serviceLimits.sortOrderMax);
}
