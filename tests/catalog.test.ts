import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { CatalogError, listFreeSlots, listServiceAreas, listServices } from "@/lib/catalog/catalog";
import { parseCatalogFilters } from "@/lib/validation/catalog";

// The catalog's server-side interface (T7, src/lib/catalog/catalog.ts) over the database functions of
// supabase/migrations/20261024100000_catalog.sql. The database rules themselves are tested against the
// test project in tests/integration/catalog-rls.test.ts; here a stand-in client checks what is asked
// and how the answer is turned into the app's types.

type Answer = { data: unknown; error: { message: string } | null };

/** A stand-in for the Supabase client: records rpc() calls and from() queries, answers with `answers`. */
function fakeClient(answers: Record<string, Answer>) {
  const rpc = vi.fn<(name: string, args?: Record<string, unknown>) => Promise<Answer>>(async (name) => answers[name]);
  const query = { select: vi.fn(() => query), order: vi.fn(async () => answers.service_areas) };
  const from = vi.fn(() => query);
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, from, query };
}

const serviceRow = {
  id: "regular",
  category: "whole-home",
  name_id: "Pembersihan Rutin",
  name_en: "Regular Cleaning",
  description_id: "Lantai dan debu.",
  description_en: "Floors and dust.",
  price_idr: 85000,
  duration_minutes: 120,
  is_active: true,
  sort_order: 1,
};

describe("parseCatalogFilters", () => {
  it("reads the area, the service type and the keyword from the address", () => {
    expect(parseCatalogFilters({ area: "jakarta-selatan", type: "rooms", q: "  dapur " })).toEqual({
      areaId: "jakarta-selatan",
      category: "rooms",
      query: "dapur",
    });
  });

  it("ignores what it does not understand instead of failing the page", () => {
    expect(parseCatalogFilters({ area: "../etc", type: "spa", q: "   " })).toEqual({});
    expect(parseCatalogFilters({})).toEqual({});
  });

  it("takes the first of repeated parameters and shortens a long keyword to 60 characters", () => {
    const filters = parseCatalogFilters({ type: ["fabrics", "rooms"], q: "a".repeat(80) });
    expect(filters.category).toBe("fabrics");
    expect(filters.query).toHaveLength(60);
  });
});

describe("listServices", () => {
  it("passes the filters to search_services and returns each service in both languages", async () => {
    const { client, rpc } = fakeClient({ search_services: { data: [serviceRow], error: null } });

    const services = await listServices(client, { areaId: "jakarta-selatan", category: "whole-home", query: "rutin" });

    expect(rpc).toHaveBeenCalledWith("search_services", {
      p_area: "jakarta-selatan",
      p_category: "whole-home",
      p_query: "rutin",
    });
    expect(services).toEqual([
      {
        id: "regular",
        category: "whole-home",
        name: { id: "Pembersihan Rutin", en: "Regular Cleaning" },
        description: { id: "Lantai dan debu.", en: "Floors and dust." },
        priceIdr: 85000,
        durationMinutes: 120,
      },
    ]);
  });

  it("sends no filter as null, so the database applies none", async () => {
    const { client, rpc } = fakeClient({ search_services: { data: [], error: null } });
    await listServices(client);
    expect(rpc).toHaveBeenCalledWith("search_services", { p_area: null, p_category: null, p_query: null });
  });

  it("throws a CatalogError when the database answers with an error", async () => {
    const { client } = fakeClient({ search_services: { data: null, error: { message: "timeout" } } });
    await expect(listServices(client)).rejects.toThrow(CatalogError);
  });
});

describe("listServiceAreas", () => {
  it("returns every area in both languages and says whether any partner serves it", async () => {
    const { client } = fakeClient({
      service_areas: {
        data: [
          { id: "jakarta-selatan", name_id: "Jakarta Selatan", name_en: "South Jakarta" },
          { id: "jakarta-utara", name_id: "Jakarta Utara", name_en: "North Jakarta" },
        ],
        error: null,
      },
      served_area_ids: { data: ["jakarta-selatan"], error: null },
    });

    expect(await listServiceAreas(client)).toEqual([
      { id: "jakarta-selatan", name: { id: "Jakarta Selatan", en: "South Jakarta" }, isServed: true },
      { id: "jakarta-utara", name: { id: "Jakarta Utara", en: "North Jakarta" }, isServed: false },
    ]);
  });
});

describe("listFreeSlots", () => {
  const now = new Date("2026-10-24T03:00:00.000Z");

  it("asks for the area's free windows from now for 14 days by default", async () => {
    const { client, rpc } = fakeClient({
      free_slots: {
        data: [{ starts_at: "2026-10-26T01:00:00+00:00", ends_at: "2026-10-26T03:00:00+00:00" }],
        error: null,
      },
    });

    const slots = await listFreeSlots(client, "jakarta-selatan", { now });

    expect(rpc).toHaveBeenCalledWith("free_slots", {
      p_area: "jakarta-selatan",
      p_from: "2026-10-24T03:00:00.000Z",
      p_to: "2026-11-07T03:00:00.000Z",
    });
    expect(slots).toEqual([{ startsAt: "2026-10-26T01:00:00.000Z", endsAt: "2026-10-26T03:00:00.000Z" }]);
  });

  it("keeps the range between 1 and 60 days", async () => {
    const { client, rpc } = fakeClient({ free_slots: { data: [], error: null } });
    await listFreeSlots(client, "jakarta-selatan", { now, days: 365 });
    await listFreeSlots(client, "jakarta-selatan", { now, days: 0 });
    expect(rpc.mock.calls.map(([, args]) => args?.p_to)).toEqual([
      "2026-12-23T03:00:00.000Z",
      "2026-10-25T03:00:00.000Z",
    ]);
  });
});
