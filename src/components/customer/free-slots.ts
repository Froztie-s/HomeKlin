import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { listFreeSlots, type FreeSlot } from "@/lib/catalog/catalog";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// The free arrival windows of an area as the customer pages read them: at request time, never cached
// (every booking changes them; connection() keeps them out of every prerender), and once per request
// and area (React's cache), so the windows panel on /services and the "Pesan" buttons on its cards
// share one read. Callers sit behind <Suspense>. Null when they could not be read; the caller says so.
// The windows are combined over everyone serving the area: times only, never who provides them.

/** How far ahead the customer pages look for free windows. */
export const freeWindowDays = 14;

export const loadFreeSlots = cache(async (areaId: string): Promise<FreeSlot[] | null> => {
  await connection();
  try {
    return await listFreeSlots(createSupabasePublicClient(), areaId, { days: freeWindowDays, now: new Date() });
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return null;
  }
});
