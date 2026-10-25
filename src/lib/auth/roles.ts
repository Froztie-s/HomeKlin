import { routing } from "@/i18n/routing";

// Who may open which page (T5). The roles are the database enum public.app_role
// (supabase/migrations/20261022120000_profiles_and_roles.sql) and markdown/SPEC.md "Users and roles".
// Pure functions, shared by the proxy (sign-in redirect), safeNextPath (where to go after signing in)
// and tests/protected-pages.test.ts (which pages need a RoleGate, and with which roles).

export const appRoles = ["customer", "cleaner", "agency", "admin"] as const;
export type AppRole = (typeof appRoles)[number];

/** Narrows a value read from the database (or anywhere untyped) to a known role. */
export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (appRoles as readonly string[]).includes(value);
}

/** Where each role lands after signing in (SPEC: role-based redirect after login). */
export const roleHome = {
  customer: "/home",
  cleaner: "/cleaner",
  agency: "/agency",
  admin: "/admin",
} as const satisfies Record<AppRole, string>;

/** Sign-in pages: a signed-in user is never sent back to them. */
export const authPaths = ["/login", "/signup"] as const;

// The protected sections and the one role that owns each. Every other page is public: the landing
// page, the app home and services (browsing needs no account), help, and the sign-in pages.
const protectedSections: readonly { prefix: string; roles: readonly AppRole[] }[] = [
  { prefix: "/orders", roles: ["customer"] },
  { prefix: "/book", roles: ["customer"] },
  { prefix: "/account", roles: ["customer"] },
  { prefix: "/cleaner", roles: ["cleaner"] },
  { prefix: "/agency", roles: ["agency"] },
  { prefix: "/admin", roles: ["admin"] },
];

function trimTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function inSection(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** The path without its language prefix: "/en/orders" -> "/orders", "/en" -> "/". */
export function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

/** The roles that may open a page (path without language prefix), or null for a public page. */
export function rolesFor(pathname: string): readonly AppRole[] | null {
  const path = trimTrailingSlash(pathname);
  return protectedSections.find(({ prefix }) => inSection(path, prefix))?.roles ?? null;
}

export function isAllowed(role: AppRole, pathname: string): boolean {
  const roles = rolesFor(pathname);
  return roles === null || roles.includes(role);
}

// A fixed, made-up origin: only used to parse `next` and check it stays on our own site.
const parseBase = "https://homeklin.invalid";

/**
 * The page to open after signing in: the requested `next` page when it is an address on this site that
 * the role may open, otherwise the role's home. Anything that could point to another site (an absolute
 * or protocol-relative URL, backslashes, encoded slashes) is refused, so `next` cannot be used for an
 * open redirect. The language prefix is dropped; the redirect adds the right one.
 */
export function safeNextPath(next: unknown, role: AppRole): string {
  const home = roleHome[role];
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return home;
  if (/[\\\s]/.test(next) || /%(2f|5c)/i.test(next)) return home;

  let url: URL;
  try {
    url = new URL(next, parseBase);
  } catch {
    return home;
  }
  // Parsing removes "." and ".." segments, and stripLocale removes "/en", so "/.//evil.example" and
  // "/en//evil.example" both become "//evil.example", which a browser reads as another site. No page of
  // ours has an empty path segment, so any "//" is refused.
  if (url.origin !== parseBase || url.pathname.includes("//")) return home;

  const path = stripLocale(trimTrailingSlash(url.pathname));
  if (!path.startsWith("/") || path.startsWith("//")) return home;
  if ((authPaths as readonly string[]).includes(path) || !isAllowed(role, path)) return home;
  return `${path}${url.search}`;
}
