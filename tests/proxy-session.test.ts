import { getRedirectUrl, getRewrittenUrl } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The session refresh at the start of every page request (T5, src/lib/supabase/proxy-session.ts and
// src/proxy.ts). When Supabase rotates an expired token, the new cookie must reach both the page being
// rendered in this request and the browser; if either misses it, the next refresh reuses a token that
// was already rotated and the user is logged out at random. Supabase itself is replaced by a stand-in
// whose getClaims rotates (or clears) the cookie the way @supabase/ssr does, through setAll.

type SetAll = (
  cookies: { name: string; value: string; options: Record<string, unknown> }[],
  headers: Record<string, string>,
) => void;

let getClaims: (setAll: SetAll) => Promise<{ data: { claims: { sub: string } } | null; error: Error | null }>;

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, { cookies }: { cookies: { setAll: SetAll } }) => ({
    auth: { getClaims: () => getClaims(cookies.setAll) },
  }),
}));

const origin = "http://localhost:3000";
const cookieName = "sb-abcdefghijklmnopqrst-auth-token";

function pageRequest(path: string, cookie: string) {
  return new NextRequest(`${origin}${path}`, { headers: { "sec-fetch-dest": "document", cookie } });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

const { default: proxy } = await import("@/proxy");

describe("proxy session refresh", () => {
  it("passes a rotated session cookie to both the page and the browser, and lets the user in", async () => {
    getClaims = async (setAll) => {
      setAll([{ name: cookieName, value: "new", options: { path: "/" } }], { "cache-control": "private, no-store" });
      return { data: { claims: { sub: "user-1" } }, error: null };
    };

    const response = await proxy(pageRequest("/orders", `${cookieName}=old`));

    // Signed in: no detour to the sign-in page.
    expect(getRedirectUrl(response)).toBeNull();
    expect(getRewrittenUrl(response)).toBe(`${origin}/id/orders`);
    // The browser gets the new cookie, with Supabase's no-store header.
    expect(response.cookies.get(cookieName)?.value).toBe("new");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    // The page rendered in this same request reads the new cookie, not the rotated old one.
    expect(response.headers.get("x-middleware-request-cookie")).toContain(`${cookieName}=new`);
    expect(response.headers.get("x-middleware-request-cookie")).not.toContain(`${cookieName}=old`);
  });

  it("sends a user whose session cannot be refreshed to sign-in, clearing the cookie on the way", async () => {
    getClaims = async (setAll) => {
      setAll([{ name: cookieName, value: "", options: { path: "/", maxAge: 0 } }], {});
      return { data: null, error: new Error("refresh token already used") };
    };

    const response = await proxy(pageRequest("/orders", `${cookieName}=stale`));

    expect(getRedirectUrl(response)).toBe(`${origin}/login?next=%2Forders`);
    const cleared = response.cookies.get(cookieName);
    expect(cleared?.value).toBe("");
    expect(cleared?.maxAge).toBe(0);
  });
});
