import { beforeEach, describe, expect, it, vi } from "vitest";

// The back-office actions that use the secret key (T28 addCleaner, T29c createAdmin and removeAdmin,
// in src/lib/agency/actions.ts and src/lib/owner/actions.ts), and the review action (T30), with
// stand-in clients. The point: every other role is refused before the server's client is ever made;
// roles are set in profiles by the server, never read from what the form sends; a half-made account
// is removed again. The database rules are in tests/integration/{agency-back-office,owner,reviews}.test.ts.

const agencyId = "0b8f3c1e-1111-4222-8333-944455556666";
const userId = "1c9f4d2f-2222-4333-8444-a55566667777";
const orderId = "2d0a5e3a-3333-4444-8555-b66677778888";

const { rpc, createUser, deleteUser, updateUserById, profileUpdate, cleanerInsert, upload, makeService } = vi.hoisted(() => {
  const profileUpdate = vi.fn();
  const cleanerInsert = vi.fn();
  const upload = vi.fn();
  const createUser = vi.fn();
  const deleteUser = vi.fn();
  const updateUserById = vi.fn();
  const makeService = vi.fn(() => ({
    auth: { admin: { createUser, deleteUser, updateUserById } },
    from: (table: string) =>
      table === "profiles"
        ? { update: (values: unknown) => profileUpdate(values) }
        : { insert: (values: unknown) => cleanerInsert(values) },
    storage: { from: () => ({ upload, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }) }) },
  }));
  return { rpc: vi.fn(), createUser, deleteUser, updateUserById, profileUpdate, cleanerInsert, upload, makeService };
});
let user: { role: string } | null = null;

vi.mock("@/lib/auth/dal", () => ({ authorize: async (roles: string[]) => (user && roles.includes(user.role) ? user : null) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));
vi.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: makeService }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { addCleaner } = await import("@/lib/agency/actions");
const { createAdmin, removeAdmin, setAgencyStatus } = await import("@/lib/owner/actions");
const { submitReview } = await import("@/lib/reviews/actions");

function form(values: Record<string, string | File>) {
  const data = new FormData();
  for (const [key, entry] of Object.entries(values)) data.set(key, entry);
  return data;
}

/** profiles.update(...).eq(...)[.eq(...).select(...)] answering `result`. */
function chain(result: unknown) {
  const node: Record<string, unknown> = {};
  node.eq = () => node;
  node.select = async () => result;
  node.then = (resolve: (value: unknown) => void) => resolve(result);
  return node;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  rpc.mockResolvedValue({ data: [{ agency_id: agencyId, name: "Uji", area_ids: [] }], error: null });
  createUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  profileUpdate.mockReturnValue(chain({ data: [{ id: userId }], error: null }));
  cleanerInsert.mockResolvedValue({ error: null });
  upload.mockResolvedValue({ error: null });
});

describe("addCleaner", () => {
  it("creates the account, then makes it the agency's cleaner", async () => {
    user = { role: "agency" };
    const photo = new File([new Uint8Array([1, 2, 3])], "foto.jpg", { type: "image/jpeg" });
    expect(await addCleaner(null, form({ fullName: "Sari Wulandari", email: "Sari@Contoh.id", photo }))).toEqual({ ok: true });
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ email: "sari@contoh.id", app_metadata: { homeklin_role: "cleaner", agency_id: agencyId } }));
    expect(profileUpdate).toHaveBeenCalledWith({ role: "cleaner", full_name: "Sari Wulandari" });
    expect(cleanerInsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: userId, agency_id: agencyId, photo_url: expect.stringContaining(`${agencyId}/${userId}`) }));
  });

  it("refuses anyone but an agency before touching the server's client", async () => {
    for (const role of ["customer", "cleaner", "admin", "owner"]) {
      user = { role };
      expect(await addCleaner(null, form({ fullName: "Sari", email: "sari@contoh.id" }))).toEqual({ formError: "notAllowed" });
    }
    expect(makeService).not.toHaveBeenCalled();
  });

  it("refuses a bad e-mail and a photo that is not a small image, and removes a half-made account", async () => {
    user = { role: "agency" };
    expect(await addCleaner(null, form({ fullName: "Sari", email: "no" }))).toEqual({ formError: "emailInvalid" });
    const pdf = new File([new Uint8Array([1])], "x.pdf", { type: "application/pdf" });
    expect(await addCleaner(null, form({ fullName: "Sari", email: "sari@contoh.id", photo: pdf }))).toEqual({ formError: "photoInvalid" });
    cleanerInsert.mockResolvedValue({ error: { message: "insert failed" } });
    expect(await addCleaner(null, form({ fullName: "Sari", email: "sari@contoh.id" }))).toEqual({ formError: "unavailable" });
    expect(deleteUser).toHaveBeenCalledWith(userId);
  });
});

describe("createAdmin and removeAdmin", () => {
  it("only the owner creates an admin, whose role is set by the server", async () => {
    user = { role: "owner" };
    expect(await createAdmin(null, form({ fullName: "Admin Baru", email: "admin.baru@contoh.id", password: "kata-sandi-panjang", role: "owner" }))).toEqual({ ok: true });
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ app_metadata: { homeklin_role: "admin" } }));
    expect(profileUpdate).toHaveBeenCalledWith({ role: "admin", full_name: "Admin Baru" });

    for (const role of ["customer", "cleaner", "agency", "admin"]) {
      vi.clearAllMocks();
      user = { role };
      expect(await createAdmin(null, form({ fullName: "Admin", email: "a@contoh.id", password: "kata-sandi-panjang" }))).toEqual({ formError: "notAllowed" });
      expect(await removeAdmin(null, form({ userId }))).toEqual({ formError: "notAllowed" });
      expect(makeService).not.toHaveBeenCalled();
    }
  });

  it("refuses a short password and an address that is taken", async () => {
    user = { role: "owner" };
    expect(await createAdmin(null, form({ fullName: "Admin", email: "a@contoh.id", password: "pendek" }))).toEqual({ formError: "passwordInvalid" });
    createUser.mockResolvedValue({ data: { user: null }, error: { message: "A user with this email address has already been registered" } });
    expect(await createAdmin(null, form({ fullName: "Admin", email: "a@contoh.id", password: "kata-sandi-panjang" }))).toEqual({ formError: "emailTaken" });
  });

  it("takes the admin role away, and answers not found for an account that is no admin", async () => {
    user = { role: "owner" };
    expect(await removeAdmin(null, form({ userId }))).toEqual({ ok: true });
    expect(profileUpdate).toHaveBeenCalledWith({ role: "customer" });
    expect(updateUserById).toHaveBeenCalledWith(userId, { app_metadata: { homeklin_role: null } });
    profileUpdate.mockReturnValue(chain({ data: [], error: null }));
    expect(await removeAdmin(null, form({ userId }))).toEqual({ formError: "adminNotFound" });
  });

  it("suspends an agency through the database function", async () => {
    user = { role: "owner" };
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await setAgencyStatus(null, form({ agencyId, status: "suspended" }))).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("owner_set_agency_status", { p_agency: agencyId, p_status: "suspended" });
    expect(await setAgencyStatus(null, form({ agencyId, status: "deleted" }))).toEqual({ formError: "statusInvalid" });
  });
});

describe("submitReview", () => {
  it("sends the ratings for the customer and turns refusals into keys", async () => {
    user = { role: "customer" };
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await submitReview(null, form({ orderId, serviceRating: "5", cleanerRating: "4", comment: " Bagus " }))).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("submit_review", { p_order: orderId, p_service_rating: 5, p_cleaner_rating: 4, p_comment: "Bagus" });
    expect(await submitReview(null, form({ orderId, serviceRating: "9" }))).toEqual({ formError: "ratingInvalid" });
    rpc.mockResolvedValue({ data: null, error: { message: "review_exists" } });
    expect(await submitReview(null, form({ orderId, serviceRating: "3" }))).toEqual({ formError: "exists" });
    user = { role: "admin" };
    expect(await submitReview(null, form({ orderId, serviceRating: "3" }))).toEqual({ formError: "notAllowed" });
  });
});
