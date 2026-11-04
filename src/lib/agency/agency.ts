import type { SupabaseClient } from "@supabase/supabase-js";

// The partner agency's own back office reads (T27, T28), through supabase/migrations/
// 20261104150000_agency_back_office.sql: which agency the signed-in user is, and its arrival windows.
// Pass the agency user's session client (createSupabaseServerClient), behind <Suspense>.

export class AgencyError extends Error {
  constructor(cause: { message: string }) {
    super(`Could not read the agency's data: ${cause.message}`);
    this.name = "AgencyError";
  }
}

export type MyAgency = { id: string; name: string; areaIds: string[] };

/** The signed-in agency, or null for anyone else. */
export async function getMyAgency(client: SupabaseClient): Promise<MyAgency | null> {
  const { data, error } = await client.rpc("my_agency");
  if (error) {
    if (error.code === "42501") return null;
    throw new AgencyError(error);
  }
  const row = (data as { agency_id: string; name: string; area_ids: string[] }[])[0];
  return row ? { id: row.agency_id, name: row.name, areaIds: row.area_ids } : null;
}

export type AgencySlot = { id: string; areaId: string; startsAt: string; endsAt: string; capacity: number; booked: number };

/** The agency's own windows from now (or `from`) to 60 days ahead, earliest first. */
export async function listAgencySlots(client: SupabaseClient, from?: string): Promise<AgencySlot[]> {
  const { data, error } = await client.rpc("agency_slots", from ? { p_from: from } : {});
  if (error) throw new AgencyError(error);
  type Row = { slot_id: string; area_id: string; starts_at: string; ends_at: string; capacity: number; booked: number };
  return (data as Row[]).map((row) => ({
    id: row.slot_id,
    areaId: row.area_id,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    capacity: row.capacity,
    booked: row.booked,
  }));
}
