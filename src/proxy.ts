import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

// Language routing in front of every page (Next.js 16 calls the middleware file proxy.ts).
// Sources: https://next-intl.dev/docs/routing/setup and
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
const handleI18nRouting = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  // Why the header is replaced: markdown/SPEC.md makes Indonesian the default, so a new visitor gets
  // Indonesian even when the browser prefers English. next-intl picks the locale from the URL prefix,
  // then the NEXT_LOCALE cookie, then Accept-Language. Showing it Accept-Language: id leaves the first
  // two (an English address, a remembered switch) in charge and makes every other visit Indonesian.
  // localeDetection stays on, because it is also what reads the cookie.
  // The copy is built from the URL and a cloned Headers object, not from `request` itself: a Request
  // made from another Request takes over its body, and a POST (a server action) would lose it.
  // The app never reads Accept-Language, so the changed header that reaches it does no harm.
  const headers = new Headers(request.headers);
  headers.set("accept-language", routing.defaultLocale);
  return handleI18nRouting(new NextRequest(request.url, { headers }));
}

export const config = {
  // Pages only: not the API (/api/health), Next.js internals, Vercel internals, or any path with a
  // dot (public files such as /images/hero-wiping-counter.jpg and /favicon.ico).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
