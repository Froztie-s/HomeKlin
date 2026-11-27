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
  code is typed. A wrong or expired code, a rate limit and "send again" are handled on the same form.
- **The person who types the code decides the password.** Supabase keeps the *first* password registered for an
  unconfirmed address and ignores the one a later sign-up sends (checked in its sign-up source during the ship review,
  finding C1), and its sign-up API is public, so an intruder could register a stranger's address first and keep a
  working password after the real owner confirms. The sign-up step therefore keeps the typed password in the browser's
  memory and sends it with the code; once the code is right the server sets it (`setCustomerPassword`), renews the
  session and marks the account (`app_metadata.password_set_with_code`, writable by the server only) so that a later code
  sign-in keeps it. With no password (JavaScript off, or one that breaks the rules) the account is claimed instead:
  a random password, and the customer signs in by code. A real-database test covers the attack
  (`tests/integration/account-claim.test.ts`).
- Email confirmation is switched **on** for the live Supabase project (`npm run supabase -- confirm-email live`).
  The test project keeps it off so the end-to-end suite is signed in at once; the code step is covered by unit tests.
- A returning customer signs in with the password or a new emailed code. Staff keep email and password.
- The earlier checkout-time actions (`sendOrderCode`, `placeOrder`) stay in the code, unused by any page; they also
  prove the address by a code.

## Consequences
- A stranger's address can no longer give anyone a working login or order emails: an account the owner did not confirm
  cannot order, and the password of a confirmed account is always one the code-holder chose. A stranger can still start
  an unconfirmed account, which only sends the address one unsolicited code email.
- Signing up costs one more step (the code) than the guest checkout did; the confirmation email counts against the
  Gmail limit of 30 emails an hour that the sign-in codes already use (accepted risk M3 in the security audit).
- Signing in with the "Kode email" tab before finishing the sign-up also confirms the account, but then it gets a random
  password, as every code sign-in does (`claimCustomerAccount`, the fix for the account-takeover finding of
  2026-11-05); a customer who confirmed through the sign-up form keeps their own password.
- Whether the real Supabase email behaves as the unit tests assume was checked only with a local stand-in: the
  first real sign-up on the live site is the proof.
