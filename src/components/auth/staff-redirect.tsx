import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { publicPageRedirect } from "@/lib/auth/roles";

// On the public pages (the landing page, the app home, services and help): a signed-in staff member
// (cleaner, agency, admin, owner) is sent to their own home, so typing a customer page's address no
// longer opens it (2026-11-20, the user). Visitors and customers stay. It reads the session, so it
// sits inside the page's <Suspense>; it renders nothing.
export async function StaffRedirect() {
  const user = await getCurrentUser();
  const target = user ? publicPageRedirect(user.role) : null;
  if (target) redirect({ href: target, locale: await getLocale() });
  return null;
}
