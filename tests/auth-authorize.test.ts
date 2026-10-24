import { beforeEach, describe, expect, it, vi } from "vitest";

// authorize() (src/lib/auth/dal.ts): the role check for Server Actions and route handlers (T7b). Unlike
// requireRole it never redirects and never reads the language, because root params (which the language
// comes from) do not reach Server Actions; the caller answers a null with its own refusal.
// Supabase is replaced by a stand-in that returns a signed-in user (or none) with a profile.

let claims: { sub: string } | null = null;
let profile: { role: string; full_name: string } | null = null;

vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));
vi.mock("next-intl/server", () => ({
  getLocale: () => {
    throw new Error("authorize() must not read the language");
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getClaims: async () => ({ data: claims ? { claims } : null, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }) }),
  }),
}));

const { authorize } = await import("@/lib/auth/dal");

beforeEach(() => {
  claims = null;
  profile = null;
});

describe("authorize", () => {
  it("returns the signed-in user when their role may act", async () => {
    claims = { sub: "user-1" };
    profile = { role: "admin", full_name: "Uji Admin" };
    expect(await authorize(["admin"])).toEqual({ id: "user-1", role: "admin", fullName: "Uji Admin" });
  });

  it("returns null for a signed-in user with another role", async () => {
    claims = { sub: "user-2" };
    profile = { role: "customer", full_name: "Uji Pelanggan" };
    expect(await authorize(["admin"])).toBeNull();
  });

  it("returns null for a visitor who is not signed in", async () => {
    expect(await authorize(["admin"])).toBeNull();
  });

  it("returns null for a user without a profile", async () => {
    claims = { sub: "user-3" };
    expect(await authorize(["customer", "admin"])).toBeNull();
  });
});
