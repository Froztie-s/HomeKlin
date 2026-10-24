import { beforeEach, describe, expect, it, vi } from "vitest";

// The Server Actions behind /admin/services (T7b, src/lib/catalog/admin-actions.ts). A Server Action is
// a public POST endpoint, so each one checks the role itself before anything else, writes through the
// signed-in admin's own Supabase client (row-level security checks the role a second time), and only
// after a successful write expires the catalog's cache tag, so the customer pages show the new price.
// Supabase, the role check, the cache and the redirect are replaced by stand-ins.

type DbError = { code: string; message: string };

const authorizeMock = vi.fn();
const updateTagMock = vi.fn();
const redirectMock = vi.fn();
const createClientMock = vi.fn();

let insertResult: { error: DbError | null };
let updateResult: { data: { id: string }[] | null; error: DbError | null };
const insertMock = vi.fn(async () => insertResult);
const selectMock = vi.fn(async () => updateResult);
const eqMock = vi.fn(() => ({ select: selectMock }));
const updateMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ insert: insertMock, update: updateMock }));

vi.mock("@/lib/auth/dal", () => ({ authorize: authorizeMock }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: createClientMock }));
vi.mock("next/cache", () => ({ updateTag: updateTagMock }));
vi.mock("@/i18n/navigation", () => ({ redirect: redirectMock }));

const { createService, updateService, setServiceActive } = await import("@/lib/catalog/admin-actions");

const admin = { id: "admin-1", role: "admin", fullName: "Uji Admin" };

const fields = {
  id: "uji-kasur",
  category: "fabrics",
  nameId: "Uji Kasur",
  nameEn: "Test Mattress",
  descriptionId: "Layanan uji.",
  descriptionEn: "A test service.",
  priceIdr: "90.000",
  durationMinutes: "90",
  sortOrder: "999",
  locale: "en",
};

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

function expectNoWrite() {
  expect(insertMock).not.toHaveBeenCalled();
  expect(updateMock).not.toHaveBeenCalled();
  expect(updateTagMock).not.toHaveBeenCalled();
  expect(redirectMock).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeMock.mockResolvedValue(admin);
  createClientMock.mockResolvedValue({ from: fromMock });
  insertResult = { error: null };
  updateResult = { data: [{ id: "uji-kasur" }], error: null };
});

describe("createService", () => {
  it("refuses anyone who is not an admin before reading the form or touching the database", async () => {
    authorizeMock.mockResolvedValue(null);

    const state = await createService(null, form(fields));

    expect(authorizeMock).toHaveBeenCalledWith(["admin"]);
    expect(state).toMatchObject({ formError: "forbidden" });
    expect(createClientMock).not.toHaveBeenCalled();
    expectNoWrite();
  });

  it("sends invalid input back with a message key per field, and never to the database", async () => {
    const state = await createService(null, form({ ...fields, priceIdr: "85,5", id: "Uji Kasur!" }));

    expect(state).toMatchObject({
      fieldErrors: { priceIdr: "priceInvalid", id: "idInvalid" },
      values: { priceIdr: "85,5", id: "Uji Kasur!" },
    });
    expectNoWrite();
  });

  it("adds the service through the admin's own client, then refreshes the catalog and opens the list", async () => {
    await createService(null, form({ ...fields, isActive: "on" }));

    expect(createClientMock).toHaveBeenCalledWith({ writeCookies: true });
    expect(fromMock).toHaveBeenCalledWith("services");
    expect(insertMock).toHaveBeenCalledWith({
      id: "uji-kasur",
      category: "fabrics",
      name_id: "Uji Kasur",
      name_en: "Test Mattress",
      description_id: "Layanan uji.",
      description_en: "A test service.",
      price_idr: 90000,
      duration_minutes: 90,
      sort_order: 999,
      is_active: true,
    });
    expect(updateTagMock).toHaveBeenCalledWith("catalog");
    expect(redirectMock).toHaveBeenCalledWith({
      href: { pathname: "/admin/services", query: { created: "uji-kasur" } },
      locale: "en",
    });
    // The cache is expired after the write, and before the redirect (which ends the action).
    expect(insertMock.mock.invocationCallOrder[0]).toBeLessThan(updateTagMock.mock.invocationCallOrder[0]);
    expect(updateTagMock.mock.invocationCallOrder[0]).toBeLessThan(redirectMock.mock.invocationCallOrder[0]);
  });

  it("adds a service switched off when the box is not ticked", async () => {
    await createService(null, form(fields));
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
  });

  it("answers an id that is already taken with a message on the id field", async () => {
    insertResult = { error: { code: "23505", message: "duplicate key value violates unique constraint" } };

    const state = await createService(null, form(fields));

    expect(state).toEqual({ fieldErrors: { id: "idTaken" }, values: expect.objectContaining({ id: "uji-kasur" }) });
    expect(updateTagMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("reports a refusal by row-level security as not allowed, and keeps the cache", async () => {
    insertResult = { error: { code: "42501", message: "new row violates row-level security policy" } };

    expect(await createService(null, form(fields))).toMatchObject({ formError: "forbidden" });
    expect(updateTagMock).not.toHaveBeenCalled();
  });

  it("reports any other database problem in plain words, without its internal message", async () => {
    insertResult = { error: { code: "08006", message: "connection failure at 10.0.0.1" } };

    const state = await createService(null, form(fields));

    expect(state).toMatchObject({ formError: "unavailable" });
    expect(JSON.stringify(state)).not.toContain("10.0.0.1");
    expect(updateTagMock).not.toHaveBeenCalled();
  });
});

describe("updateService", () => {
  it("refuses anyone who is not an admin before touching the database", async () => {
    authorizeMock.mockResolvedValue(null);

    expect(await updateService(null, form(fields))).toMatchObject({ formError: "forbidden" });
    expect(createClientMock).not.toHaveBeenCalled();
    expectNoWrite();
  });

  it("sends invalid input back, and never to the database", async () => {
    const state = await updateService(null, form({ ...fields, durationMinutes: "721" }));

    expect(state).toMatchObject({ fieldErrors: { durationMinutes: "durationRange" } });
    expectNoWrite();
  });

  it("changes every column but the id, refreshes the catalog and opens the list", async () => {
    await updateService(null, form({ ...fields, priceIdr: "95000", isActive: "on" }));

    expect(createClientMock).toHaveBeenCalledWith({ writeCookies: true });
    expect(updateMock).toHaveBeenCalledWith({
      category: "fabrics",
      name_id: "Uji Kasur",
      name_en: "Test Mattress",
      description_id: "Layanan uji.",
      description_en: "A test service.",
      price_idr: 95000,
      duration_minutes: 90,
      sort_order: 999,
      is_active: true,
    });
    expect(eqMock).toHaveBeenCalledWith("id", "uji-kasur");
    expect(updateTagMock).toHaveBeenCalledWith("catalog");
    expect(redirectMock).toHaveBeenCalledWith({
      href: { pathname: "/admin/services", query: { saved: "uji-kasur" } },
      locale: "en",
    });
  });

  it("says the service was not found when no row changed, and keeps the cache", async () => {
    updateResult = { data: [], error: null };

    const state = await updateService(null, form(fields));

    expect(state).toMatchObject({ formError: "notFound", values: expect.objectContaining({ id: "uji-kasur" }) });
    expect(updateTagMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("reports a database problem in plain words and keeps the cache", async () => {
    updateResult = { data: null, error: { code: "23514", message: "violates check constraint" } };

    expect(await updateService(null, form(fields))).toMatchObject({ formError: "unavailable" });
    expect(updateTagMock).not.toHaveBeenCalled();
  });
});

describe("setServiceActive", () => {
  const switchForm = (id: string, isActive: string) => form({ id, isActive });

  it("refuses anyone who is not an admin before touching the database", async () => {
    authorizeMock.mockResolvedValue(null);

    expect(await setServiceActive(null, switchForm("uji-kasur", "true"))).toEqual({
      ok: false,
      formError: "forbidden",
    });
    expect(createClientMock).not.toHaveBeenCalled();
    expectNoWrite();
  });

  it("refuses a crafted request it cannot read, without touching the database", async () => {
    expect(await setServiceActive(null, switchForm("uji-kasur", "maybe"))).toEqual({
      ok: false,
      formError: "unavailable",
    });
    expectNoWrite();
  });

  it("switches the service on or off, refreshes the catalog and stays on the page", async () => {
    const state = await setServiceActive(null, switchForm("uji-kasur", "false"));

    expect(updateMock).toHaveBeenCalledWith({ is_active: false });
    expect(eqMock).toHaveBeenCalledWith("id", "uji-kasur");
    expect(updateTagMock).toHaveBeenCalledWith("catalog");
    expect(redirectMock).not.toHaveBeenCalled();
    expect(state).toEqual({ ok: true, isActive: false });
  });

  it("says the service was not found when no row changed, and keeps the cache", async () => {
    updateResult = { data: [], error: null };

    expect(await setServiceActive(null, switchForm("uji-kasur", "true"))).toEqual({
      ok: false,
      formError: "notFound",
    });
    expect(updateTagMock).not.toHaveBeenCalled();
  });

  it("reports a database problem in plain words and keeps the cache", async () => {
    updateResult = { data: null, error: { code: "42501", message: "permission denied" } };

    expect(await setServiceActive(null, switchForm("uji-kasur", "true"))).toEqual({
      ok: false,
      formError: "forbidden",
    });
    expect(updateTagMock).not.toHaveBeenCalled();
  });
});
