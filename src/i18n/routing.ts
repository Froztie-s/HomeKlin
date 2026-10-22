import { defineRouting } from "next-intl/routing";

// The site's two languages (markdown/SPEC.md "Language"). Indonesian is the default and has no prefix
// (/home); English is prefixed (/en/home), and /id/home redirects to /home.
// Source: https://next-intl.dev/docs/routing/configuration
export const routing = defineRouting({
  locales: ["id", "en"],
  defaultLocale: "id",
  localePrefix: "as-needed",
  // The choice is remembered for a year. next-intl's default is a session cookie, which a phone
  // browser may drop between visits; the cookie only holds "id" or "en".
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});
