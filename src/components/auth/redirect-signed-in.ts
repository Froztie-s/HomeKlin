import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { safeNextPath } from "@/lib/auth/roles";

// For the sign-in and sign-up pages (T5). The proxy adds ?next=<the page they wanted> when it sends a
// visitor to sign in; the forms carry it on in a hidden field.

/** The ?next= value as typed in the address, or undefined. safeNextPath decides later whether it is used. */
export function nextFrom(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * A visitor who is already signed in does not need the form: they go on to `next` when their role may
 * open it, otherwise to their own home (safeNextPath also refuses any address off this site). Reads the
 * session, so the caller sits behind <Suspense>.
 */
export async function redirectIfSignedIn(next: string | undefined): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const locale = await getLocale();
  redirect({ href: safeNextPath(next, user.role), locale });
}
