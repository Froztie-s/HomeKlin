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

export async function claimCustomerAccount(user: SupabaseClient, server: SupabaseClient, userId: string, email: string): Promise<void> {
  const { data: profile } = await user.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role !== "customer") return;

  const reset = await server.auth.admin.updateUserById(userId, { password: randomBytes(48).toString("base64url") });
  if (reset.error) throw new Error(`Could not secure the account: ${reset.error.message}`);

  const link = await server.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw new Error(`Could not renew the session: ${link.error.message}`);
  const renewed = await user.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: "email" });
  if (renewed.error) throw new Error(`Could not renew the session: ${renewed.error.message}`);
}
