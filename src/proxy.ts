import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { rolesFor, stripLocale } from "./lib/auth/roles";
import { applySession, refreshSession } from "./lib/supabase/proxy-session";

// In front of every page (Next.js 16 calls the middleware file proxy.ts): the visitor's Supabase session,
// then the language routing, then a quick sign-in check for protected sections.
// Sources: https://next-intl.dev/docs/routing/setup,
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md and
// node_modules/next/dist/docs/01-app/02-guides/authentication.md ("Optimistic checks with Proxy")
const handleI18nRouting = createMiddleware(routing);

/** The language a (non-redirected) page request is served in: its prefix, else the default. */
function localeOf(pathname: string) {
  return routing.locales.find((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`))
    ?? routing.defaultLocale;
}

export default async function proxy(request: NextRequest) {
  // 1. Session first. A refreshed token is written into this request's cookies, so it must happen
  //    before the language routing copies the request headers for the page (src/lib/supabase/proxy-session.ts).
  const session = await refreshSession(request);

  // 2. Language. Why the header is replaced: markdown/SPEC.md makes Indonesian the default, so a new
  //    visitor gets Indonesian even when the browser prefers English. next-intl picks the locale from the
  //    URL prefix, then the NEXT_LOCALE cookie, then Accept-Language. Showing it Accept-Language: id
  //    leaves the first two (an English address, a remembered switch) in charge and makes every other
  //    visit Indonesian. localeDetection stays on, because it is also what reads the cookie.
  //    The copy is built from the URL and a cloned Headers object, not from `request` itself: a Request
  //    made from another Request takes over its body, and a POST (a server action) would lose it.
  //    The app never reads Accept-Language, so the changed header that reaches it does no harm.
  const headers = new Headers(request.headers);
  headers.set("accept-language", routing.defaultLocale);
  const response = handleI18nRouting(new NextRequest(request.url, { headers }));

  // 3. Sign-in check, optimistic: a protected section (src/lib/auth/roles.ts) needs a valid session,
  //    otherwise the visitor goes to the sign-in page in the same language, with the page they wanted as
  //    `next`. Whether their role may open the section is checked on the server (requireRole), since
  //    this runs on every request and must not query the database. A language redirect goes out first;
  //    the check runs on the follow-up request.
  const { pathname, search } = request.nextUrl;
  const path = stripLocale(pathname);
  if (!session.claims && !response.headers.has("location") && rolesFor(path)) {
    const locale = localeOf(pathname);
    const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    const login = new URL(`${prefix}/login`, request.url);
    login.searchParams.set("next", `${path}${search}`);
    return applySession(NextResponse.redirect(login), session);
  }

  // Every response, redirects included, carries the refreshed or cleared session cookies.
  return applySession(response, session);
}

export const config = {
  // Pages only: not the API (/api/health), Next.js internals, Vercel internals, or any path with a
  // dot (public files such as /images/hero-wiping-counter.jpg and /favicon.ico).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
