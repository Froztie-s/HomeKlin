import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig } from "./config";

type SessionCookie = { name: string; value: string; options: CookieOptions };

export type ProxySession = {
  /** The verified token claims of a signed-in visitor (`sub` is the user id), or null. */
  claims: { sub: string } | null;
  /** Session cookies Supabase rotated or cleared; they must reach the browser. */
  cookies: SessionCookie[];
  /** Cache headers Supabase asks for whenever it sets session cookies. */
  headers: Record<string, string>;
};

const signedOut: ProxySession = { claims: null, cookies: [], headers: {} };

/** Supabase's session cookie: sb-<project ref>-auth-token, split into .0, .1 ... when large. */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
}

/**
 * Refreshes a signed-in visitor's Supabase session at the start of a page request.
 *
 * Server Components cannot write cookies, so an expired access token must be refreshed here, once, and
 * the new cookies must reach two places: the page being rendered in this same request (written into the
 * request's cookies, which the language routing forwards) and the browser (returned for the response).
 * If either misses them, the next refresh reuses an already-rotated refresh token and the user is
 * logged out at random.
 *
 * getClaims() verifies the access token locally against the project's published signing keys, and
 * refreshes it through Supabase Auth only when it has expired. Visitors without a session cookie (most
 * landing-page visits) skip all of this.
 * Sources: https://supabase.com/docs/guides/auth/server-side/creating-a-client and
 * https://supabase.com/docs/reference/javascript/auth-getclaims
 */
export async function refreshSession(request: NextRequest): Promise<ProxySession> {
  const config = getSupabaseConfig();
  if (!config || !hasSessionCookie(request)) return signedOut;

  const pending: Pick<ProxySession, "cookies" | "headers"> = { cookies: [], headers: {} };
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          pending.cookies.push(cookie);
        }
        Object.assign(pending.headers, headers);
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims.sub;
  return { claims: error || typeof sub !== "string" ? null : { sub }, ...pending };
}

/** Sends the refreshed (or cleared) session cookies and Supabase's no-cache headers with a response. */
export function applySession(response: NextResponse, session: ProxySession): NextResponse {
  for (const { name, value, options } of session.cookies) response.cookies.set(name, value, options);
  for (const [key, value] of Object.entries(session.headers)) response.headers.set(key, value);
  return response;
}
