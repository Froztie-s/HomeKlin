import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware versions of Next.js' navigation APIs. Every internal link uses this Link, so an English
// page links to English pages (/en/...) and an Indonesian page to the plain addresses. usePathname
// returns the path without the locale prefix ("/home" on /en/home), which the navigation menus match.
// Source: https://next-intl.dev/docs/routing/navigation
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
