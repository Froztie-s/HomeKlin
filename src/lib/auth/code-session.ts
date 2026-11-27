import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// After a customer proves their email with a code (ordering, T9b, or signing in, /login), the account
// becomes theirs alone (T34 security review, finding H1). Supabase's sign-up API is public: someone could
// register a stranger's email with a password before that person ever orders, then sign in with that
// password later and read the orders, the live view and the recordings. Customers never use passwords
// (they sign in by code, SPEC), so the code check replaces any password with a long random one nobody
// knows. Changing the password ends every session of the account, the intruder's and the customer's
// own; the customer, who has just proved the email, then gets a fresh session through a one-time code
// the server makes itself (nothing is emailed). Staff keep their passwords: only customers are reset.
//
// Signing up with a password has the same hole when "Confirm email" is on (ship review C1, 2026-11-27):
// for an address that already has an UNCONFIRMED account, Supabase keeps the first password and ignores
// the one a later sign-up sends, so the person who types the code from the email may not know the stored
// password. setCustomerPassword closes it: the password typed together with the code is set after the code
// check, and the account is marked (`app_metadata.password_set_with_code`, which only the server can write)
// so that a later code sign-in does not replace the owner's own password again.

/** Set on an account whose password was chosen by the person who proved the email with a code. */
export const passwordSetWithCodeFlag = "password_set_with_code";

export async function claimCustomerAccount(user: SupabaseClient, server: SupabaseClient, userId: string, email: string): Promise<void> {
  const { data: profile } = await user.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "customer") return;

  // The owner chose this password at sign-up, together with the code that proved the email: keep it.
  const account = await server.auth.admin.getUserById(userId);
  if (account.data.user?.app_metadata?.[passwordSetWithCodeFlag] === true) return;

  const reset = await server.auth.admin.updateUserById(userId, { password: randomBytes(48).toString("base64url") });
  if (reset.error) throw new Error(`Could not secure the account: ${reset.error.message}`);

  await startSessionFor(user, server, email);
}

/**
 * Sign-up with "Confirm email" on, after the code was checked: the customer's own password replaces whatever
 * is stored (an intruder may have registered the address first), and the account is marked so that a later
 * code sign-in keeps it. Changing the password ends every session, so the customer gets a fresh one, as in
 * claimCustomerAccount. Customers only; staff accounts are left alone.
 */
export async function setCustomerPassword(
  user: SupabaseClient,
  server: SupabaseClient,
  userId: string,
  email: string,
  password: string,
): Promise<void> {
  const { data: profile } = await user.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "customer") return;

  const updated = await server.auth.admin.updateUserById(userId, {
    password,
    app_metadata: { [passwordSetWithCodeFlag]: true },
  });
  if (updated.error) throw new Error(`Could not save the password: ${updated.error.message}`);

  await startSessionFor(user, server, email);
}

/**
 * Gives `user` (a cookie-writing client: a Server Action or a Route Handler) a fresh session for the
 * account with this email, through a one-time code the server makes itself; nothing is emailed. Used
 * after a code check (above) and by the private order link (src/lib/orders/order-link-sign-in.ts).
 */
export async function startSessionFor(user: SupabaseClient, server: SupabaseClient, email: string): Promise<void> {
  const link = await server.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw new Error(`Could not renew the session: ${link.error.message}`);
  const renewed = await user.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: "email" });
  if (renewed.error) throw new Error(`Could not renew the session: ${renewed.error.message}`);
}
