import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getService, listAllServices, nextSortOrder, type AdminService } from "@/lib/catalog/admin";
import { CatalogError } from "@/lib/catalog/catalog";

// What /admin/services reads (T7b, src/lib/catalog/admin.ts): every service, switched on or off, read
// with the signed-in admin's own client. Row-level security decides that only admin sees the inactive
// ones (tests/integration/admin-services-rls.test.ts); here a stand-in client checks what is asked and
// how the rows become the app's types.

type Answer = { data: unknown; error: { message: string } | null };

const row = {
  id: "windows",
  category: "rooms",
  name_id: "Kaca & Jendela",
  name_en: "Windows & Glass",
  description_id: "Kaca jendela dan kusen.",
  description_en: "Window glass and frames.",
  price_idr: 100000,
  duration_minutes: 120,
  is_active: false,
  sort_order: 4,
};

const service: AdminService = {
  id: "windows",
  category: "rooms",
  name: { id: "Kaca & Jendela", en: "Windows & Glass" },
  description: { id: "Kaca jendela dan kusen.", en: "Window glass and frames." },
  priceIdr: 100000,
  durationMinutes: 120,
  isActive: false,
  sortOrder: 4,
};

/** A stand-in for supabase.from("services"): records the query and answers with `answer`. */
function fakeClient(answer: Answer) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    maybeSingle: vi.fn(async () => answer),
    then: (resolve: (value: Answer) => unknown) => Promise.resolve(answer).then(resolve),
  };
  const from = vi.fn(() => query);
  return { client: { from } as unknown as SupabaseClient, from, query };
}

describe("listAllServices", () => {
  it("returns every service with its state and order, in the order admin set", async () => {
    const { client, from, query } = fakeClient({ data: [row], error: null });

    expect(await listAllServices(client)).toEqual([service]);
    expect(from).toHaveBeenCalledWith("services");
    expect(query.order.mock.calls).toEqual([["sort_order"], ["id"]]);
  });

  it("throws a CatalogError when the database answers with an error", async () => {
    const { client } = fakeClient({ data: null, error: { message: "permission denied" } });
    await expect(listAllServices(client)).rejects.toBeInstanceOf(CatalogError);
  });
});

describe("getService", () => {
  it("returns one service by its id", async () => {
    const { client, query } = fakeClient({ data: row, error: null });

    expect(await getService(client, "windows")).toEqual(service);
    expect(query.eq).toHaveBeenCalledWith("id", "windows");
  });

  it("returns null when there is no such service (or the reader may not see it)", async () => {
    const { client } = fakeClient({ data: null, error: null });
    expect(await getService(client, "missing")).toBeNull();
  });

  it("throws a CatalogError when the database answers with an error", async () => {
    const { client } = fakeClient({ data: null, error: { message: "timeout" } });
    await expect(getService(client, "windows")).rejects.toBeInstanceOf(CatalogError);
  });
});

describe("nextSortOrder", () => {
  it("puts a new service after the last one", () => {
    expect(nextSortOrder([{ ...service, sortOrder: 3 }, { ...service, sortOrder: 9 }, service])).toBe(10);
  });

  it("starts at 0 when there is no service yet", () => {
    expect(nextSortOrder([])).toBe(0);
  });

  it("never suggests more than the form accepts", () => {
    expect(nextSortOrder([{ ...service, sortOrder: 9999 }])).toBe(9999);
  });
});
