import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

// /signup and /en/signup are gone (T9b): the account is made by ordering (an emailed code on the order
// page), so the old address leads to the order page in the same language. The language comes from the
// address (root params), so the redirect is known at build time.
export default async function SignupPage(): Promise<never> {
  const locale = await getLocale();
  return redirect({ href: "/pesan", locale });
}
