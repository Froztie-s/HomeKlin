import { getLocale } from "next-intl/server";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAppRole, roleHome, type AppRole } from "./roles";

// The data access layer for "who is signed in" (T5). Every role check on the server goes through here,
// close to the data, as Next.js recommends; the proxy's check is only a quick pre-filter.
// Reading the session reads cookies, so with Cache Components every caller sits behind <Suspense>.
// Sources: node_modules/next/dist/docs/01-app/02-guides/authentication.md ("Creating a Data Access
// Layer") and node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md

export type CurrentUser = {
  id: string;
  role: AppRole;
  fullName: string;
};

/**
 * The signed-in user, read once per request: the verified token (getClaims checks its signature and
 * expiry), then their own profile row, which row-level security lets each user read and nobody else.
 * Null for a visitor who is not signed in, and for a user without a valid profile.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient({ writeCookies: false });
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || typeof userId !== "string") return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || !isAppRole(profile.role)) return null;

  return { id: userId, role: profile.role, fullName: String(profile.full_name ?? "") };
});

/**
 * The signed-in user if their role is one of `roles`. A visitor who is not signed in goes to the sign-in
 * page; a signed-in user with another role goes to their own home (a customer opening /admin lands on
 * /home). Both redirects keep the current language.
 */
export async function requireRole(roles: readonly AppRole[]): Promise<CurrentUser> {
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  // `return` lets TypeScript see that redirect() ends the function (it throws).
  if (!user) return redirect({ href: "/login", locale });
  if (!roles.includes(user.role)) return redirect({ href: roleHome[user.role], locale });
  return user;
}
