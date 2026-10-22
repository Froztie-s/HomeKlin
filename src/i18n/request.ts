import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { routing } from "./routing";

// The messages and settings for one request. The locale comes from the [locale] root segment through
// next/root-params, never from cookies() or headers(), so every page is still prerendered for both
// languages (Cache Components is on). An explicit locale (getTranslations({ locale })) wins.
// No global-not-found page: [locale] catches every first path segment, so an address with no page
// (/agencies, /en/agencies) gets the localized not-found.tsx, and a non-page path with an unknown
// first segment (/robots.txt) gets Next.js's built-in 404 through the notFound() below (measured at
// T4 on Next.js 16.4.2).
// Sources: https://next-intl.dev/blog/nextjs-root-params and
// node_modules/next/dist/docs/01-app/03-api-reference/04-functions/next-root-params.md
export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const segment = await rootParams.locale();
    // The [locale] segment also catches unknown first segments such as /robots.txt.
    if (!hasLocale(routing.locales, segment)) notFound();
    locale = segment;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // HomeKlin serves Jakarta; a fixed zone keeps server and browser output identical.
    timeZone: "Asia/Jakarta",
  };
});
