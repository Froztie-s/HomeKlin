# Security and RLS audit (T34), 5 November 2026

Who did it: a read-only security review agent over the whole repository (18 migrations, every route
handler and server action, the proxy and auth, secrets, headers, dependencies), followed by fixes from
the software house's lead. All fixes have tests against the separate Supabase test project.

## Result
| Severity | Found | Fixed | Logged (not fixed) |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 1 | 1 | 0 |
| Medium | 3 | 2 | 1 accepted (M3) |
| Low | 2 | 2 | 0 |
| Info | 5 | 1 (I5) | 4 |

`npm audit --omit=dev --audit-level=high`: 0 vulnerabilities. No secrets in the repository or its history.

## Findings and what was done
| ID | Finding | Status |
|---|---|---|
| H1 | Someone could register a customer's email with a password before that customer ever ordered, then sign in with it later and read the orders, the live view and the recordings. | **Fixed.** After an emailed code is verified (ordering or `/login`), a customer account's password is replaced by a random one and every other session ends (`src/lib/auth/code-session.ts`). Test: `tests/integration/account-claim.test.ts` (the intruder's password and session stop working; staff passwords stay). |
| M1 | No `frame-ancestors`, `X-Frame-Options` or `nosniff`: clickjacking of staff buttons was possible. | **Fixed** in `next.config.ts` (`frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`). Test: `tests/security-headers.test.ts`. A full `script-src` CSP with nonces is logged as a follow-up. |
| M2 | An order nobody paid for kept its place in the window for good, and one account could book every window. | **Fixed** (`supabase/migrations/20261105090000_security_fixes.sql`): `release_unpaid_orders()` cancels orders unpaid after 2 hours and gives the places back (run by `book_slot` and the daily cron); at most 3 unpaid orders per customer (`too_many_unpaid`). Tests in `tests/integration/booking.test.ts`. |
| M3 | Anyone can use up the live project's hourly email allowance by asking for order codes for made-up addresses, which blocks ordering and sign-in for everyone. | **Accepted risk**, under the user's decision at Checkpoint 1 (2026-10-24): rate limits stay at their defaults, because the site is a demo with fewer than 5 users at a time. A per-address limit in the app was not added, since the client group's testers may share one network address and would block each other. If abuse is seen: a free CAPTCHA (Cloudflare Turnstile or hCaptcha) connected in Supabase Auth is the real fix, and needs the user's account. |
| L1 | `stream_for_viewer()` let a stranger in when the job's agency had no sign-in account (a null comparison). | **Fixed**: the check fails closed (`coalesce(..., false)`). Test in `tests/integration/streams.test.ts`. |
| L2 | A cleaner photo's address held the partner agency's id, visible to customers. | **Fixed**: new photos are stored under a random name only (`src/lib/agency/actions.ts`). |
| I1 | The Midtrans signature formula does not cover `transaction_status`. | Logged. It is Midtrans' own formula, and a forgery needs the server key. |
| I2 | `src/lib/supabase/service.ts` has no `import "server-only"`. | Logged. Checked: no client component imports it, and the key has no `NEXT_PUBLIC_` prefix. The `server-only` package is not installed (no new dependency added). |
| I3 | Session cookies are not marked `Secure` and are readable by scripts. | Logged. Readable on purpose (decided at Checkpoint 1, needed for Realtime); the site is HTTPS-only with HSTS preload. |
| I4 | The ticket's customer can read the admin's user id on messages. | Logged; low value. |
| I5 | A flaky integration test: two test files deleted the library clip others were copying. | **Fixed**: every test file shares `library/test-clip.mp4`, which nothing deletes. |

Refusal tests added for the six rules the review found untested: `owner_add_agency` for other roles,
`set_stream_status` for other cleaners and roles, the `cleaner-photos` bucket (no uploads, deletes or
listing for users), `stream_for_viewer` with an agency without a sign-in, `recording_for_viewer` for the
owner role, `check_out`, `my_agency` and `agency_slots` for other roles.

## What was checked and found sound
- Row-level security is on for all 14 tables; the tables holding the agency, recordings, streams and
  reviews are closed to users and read through `security definer` functions.
- All 56 `security definer` functions set `search_path = ''`, read the role from `profiles`, revoke
  `public` and `anon`, and refuse without revealing whether something exists.
- `book_slot` is race-safe (`FOR UPDATE ... SKIP LOCKED`, re-checked capacity, a table `CHECK`); the
  payment result is applied once, under a row lock, after a constant-time signature check.
- The private `recordings` bucket has no user policies; signed links last at most 10 minutes and never
  past the recording's expiry.
- Every server action checks the role and parses its input with Zod; every use of the secret key is
  guarded by its own role check; the open-redirect guard and the RoleGate pattern hold.
