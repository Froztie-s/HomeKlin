# ADR 0007: Ordering needs an account whose email is confirmed by a code

- Status: accepted (2026-11-27, the user's decision; task S1). Supersedes [ADR 0004](0004-guest-checkout-with-an-email-code.md).

## Context
ADR 0004 let a visitor order without signing up: the emailed code at checkout proved the address and made the
account. On 2026-11-20 a UX pull request changed the pages so that ordering needs an account (a visitor is sent
to sign in or sign up first) and brought back sign-up with a password. With email confirmation switched off in
Supabase, that let anyone register someone else's address: the real owner then received order emails that carry a
private `/o/<token>` sign-in link into an account whose password the registrant chose. Review and security audit
of the pull request both raised it.

## Decision
- Ordering needs a customer account. A visitor who opens `/pesan` is sent to `/login` or `/signup`.
- Sign-up asks for name, email and password, then **a 6-digit code emailed by HomeKlin** (`confirmSignUp`,
  Supabase `verifyOtp` with type `email`); the account has no session, so it can order and receive nothing, until the
  code is typed. A wrong or expired code, a rate limit and "send again" are handled on the same form. The password the
  customer chose is kept (the code step does not run `claimCustomerAccount`).
- Email confirmation is switched **on** for the live Supabase project (`npm run supabase -- confirm-email live`).
  The test project keeps it off so the end-to-end suite is signed in at once; the code step is covered by unit tests.
- A returning customer signs in with the password or a new emailed code. Staff keep email and password.
- The earlier checkout-time actions (`sendOrderCode`, `placeOrder`) stay in the code, unused by any page; they also
  prove the address by a code.

## Consequences
- A stranger's address can no longer be used to start an account or to receive order emails.
- Signing up costs one more step (the code) than the guest checkout did; the confirmation email counts against the
  Gmail limit of 30 emails an hour that the sign-in codes already use (accepted risk M3 in the security audit).
- Signing in with the "Kode email" tab before confirming also confirms the account but gives it a random password, as
  every code sign-in does (`claimCustomerAccount`, the fix for the account-takeover finding of 2026-11-05).
- Whether the real Supabase email behaves as the unit tests assume was checked only with a local stand-in: the
  first real sign-up on the live site is the proof.
