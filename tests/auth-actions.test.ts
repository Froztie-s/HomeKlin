import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSessionCookieName } from "@/lib/supabase/config";

// Signing out (T5): the browser must end up signed out even when Supabase cannot end the session.
// In auth-js, signOut gives up without clearing the cookies when it cannot load the session (for
// example an expired access token while Supabase is unreachable), so the action clears them itself.

const signOutMock = vi.fn();
const redirectMock = vi.fn();
const cookieStore = { getAll: vi.fn(), delete: vi.fn() };

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signOut: signOutMock } }),
}));
vi.mock("@/i18n/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

const { signOut } = await import("@/lib/auth/actions");

function form(locale: string): FormData {
  const data = new FormData();
  data.set("locale", locale);
  return data;
}

const browserCookies = [
  { name: "sb-abcdefghijklmnopqrst-auth-token.0", value: "a" },
  { name: "sb-abcdefghijklmnopqrst-auth-token.1", value: "b" },
  { name: "sb-abcdefghijklmnopqrst-auth-token-code-verifier", value: "c" },
  { name: "NEXT_LOCALE", value: "en" },
];

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.getAll.mockReturnValue(browserCookies);
});

describe("signOut", () => {
  it("leaves the cookies to Supabase when it ends the session, and goes to the landing page", async () => {
    signOutMock.mockResolvedValue({ error: null });

    await signOut(form("en"));

    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
    expect(cookieStore.delete).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith({ href: "/", locale: "en" });
  });

  it("deletes the session cookies itself when Supabase cannot end the session", async () => {
    signOutMock.mockResolvedValue({ error: new Error("fetch failed") });

    await signOut(form("id"));

    const deleted = cookieStore.delete.mock.calls.map(([name]) => name);
    expect(deleted).toEqual([
      "sb-abcdefghijklmnopqrst-auth-token.0",
      "sb-abcdefghijklmnopqrst-auth-token.1",
      "sb-abcdefghijklmnopqrst-auth-token-code-verifier",
    ]);
    expect(redirectMock).toHaveBeenCalledWith({ href: "/", locale: "id" });
  });
});

describe("isSessionCookieName", () => {
  it("recognises Supabase's session cookies, split or not, and nothing else", () => {
    expect(isSessionCookieName("sb-abcdefghijklmnopqrst-auth-token")).toBe(true);
    expect(isSessionCookieName("sb-abcdefghijklmnopqrst-auth-token.0")).toBe(true);
    expect(isSessionCookieName("sb-abcdefghijklmnopqrst-auth-token-code-verifier")).toBe(true);
    expect(isSessionCookieName("NEXT_LOCALE")).toBe(false);
    expect(isSessionCookieName("sb-other")).toBe(false);
    expect(isSessionCookieName("my-auth-token")).toBe(false);
  });
});
