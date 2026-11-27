# ADR 0004: Ordering without sign-up, with an emailed code

- Status: superseded by [ADR 0007](0007-ordering-needs-a-confirmed-account.md) (2026-11-27). Accepted 2026-10-25 (the user's decision; task T9b). The emailed code now proves the address when the customer signs up, not at checkout.

## Context
A separate sign-up before booking lost customers, but an order must belong to someone: only the
booking's customer may pay, watch the live view and replay the recording.

## Decision
- Clicking a service opens one order form (`/pesan`). Before the order is placed, HomeKlin emails a
  6-digit code (Supabase Auth); typing it proves the email belongs to whoever orders, creates the
  account if it is new, and signs the customer in.
- A returning customer signs in at `/login` with a new code. The phone number is only a contact for the
  cleaner. Staff (cleaner, agency, admin, owner) keep email and password.
- Codes and order confirmations go out through Gmail SMTP; the test project uses a throw-away Ethereal
  account, so tests never send real email.

## Consequences
- No one can place or read orders on someone else's email.
- The live project depends on working SMTP settings (`npm run supabase -- smtp live`).
