import { adminClient } from "../../tests/integration/test-project";

// The emailed sign-in code for the e2e suite (T9b). The test project's auth emails go to Ethereal
// (npm run supabase -- smtp test), which delivers nothing, so a spec cannot read its inbox. Instead it
// asks the admin API for a fresh code for the address (the secret key, tests only); that code replaces
// the one that was emailed, so type it right after asking for it.
// Checked against the real project in tests/integration/email-code.test.ts.

/** A fresh 6-digit code for `email`; the account must exist (ask for a code in the app first). */
export async function codeFor(email: string): Promise<string> {
  const { data, error } = await adminClient().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`Could not get a code for ${email}: ${error.message}`);
  return data.properties.email_otp;
}

/** Deletes the accounts (and with them their orders and profiles) a spec created by ordering as a guest. */
export async function deleteAccountsByEmail(emails: readonly string[]): Promise<void> {
  const admin = adminClient();
  const wanted = new Set(emails.map((email) => email.toLowerCase()));
  if (wanted.size === 0) return;
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`Could not list the test users: ${error.message}`);
  for (const user of data.users) {
    if (user.email && wanted.has(user.email.toLowerCase())) await admin.auth.admin.deleteUser(user.id);
  }
}
