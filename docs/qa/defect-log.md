# Defect log (T37)

Defects found by the software house during internal testing, before QA/UAT by the client group.
Severity: Critical (blocks a Quality Plan scenario or exposes data), Major, Minor. **Open critical
defects: 0.**

| Date | Severity | Defect | How found | Status |
|---|---|---|---|---|
| 2026-10-22 | Critical | Open redirect through `next` after sign-in (`/.//evil.example`). | T5 security review | Fixed (`cf4be52`), unit tests |
| 2026-10-23 | Major | A role check in a layout did not protect its pages (content reached the RSC payload). | T5 review | Fixed: `RoleGate` in every protected page, `tests/protected-pages.test.ts` |
| 2026-10-28 | Major | A payment arriving after a decline (out-of-order notifications) left the order failed. | doubt-driven review of T11 | Fixed: `apply_payment_result` revives it if the place is free |
| 2026-11-04 | Major | The support chat did not receive admin replies: the browser joined Realtime before handing over its session, so row-level security sent nothing. | e2e `support-realtime.desktop` | Fixed in `src/components/support/use-realtime.ts` |
| 2026-11-04 | Minor | Agency server actions failed to build: a `"use server"` file exported a constant. | agency e2e | Fixed |
| 2026-11-05 | Critical | Account takeover: a password registered beforehand for a customer's email stayed valid after the customer ordered by code. | T34 security audit (H1) | Fixed: `src/lib/auth/code-session.ts`, `tests/integration/account-claim.test.ts` |
| 2026-11-05 | Major | Unpaid orders kept their window place for good; one account could fill every window. | T34 (M2) | Fixed: `release_unpaid_orders`, at most 3 unpaid orders |
| 2026-11-05 | Major | No frame-ancestors / X-Frame-Options (clickjacking of staff buttons). | T34 (M1) | Fixed: `next.config.ts` |
| 2026-11-05 | Major | Anyone can exhaust the hourly email allowance with code requests, blocking ordering and sign-in. | T34 (M3) | **Accepted risk** (user decision at Checkpoint 1: default rate limits, a demo with fewer than 5 users; a per-address limit would also block testers sharing one network). A CAPTCHA is the fix if abuse is seen |
| 2026-11-05 | Minor | `stream_for_viewer` failed open for an agency without a sign-in. | T34 (L1) | Fixed, test added |
| 2026-11-05 | Minor | A cleaner photo's address held the agency id. | T34 (L2) | Fixed |
| 2026-11-05 | Minor | The cleaner page remembers the stream state per tab only (a new tab shows "Mulai siaran", which resumes the same stream). | T22 agent report | Backend done (`my_stream_status`); the screen reads it after the design revamp. Cosmetic |
| 2026-11-01 | Minor | Paying an older order from its details returns to the "order made" heading. | T12 report | Open, cosmetic |

Test-infrastructure faults fixed on the way (not product defects): an expired throw-away test mailbox,
the test project's sign-in rate limit, places leaked by interrupted test runs, a stale build cache,
tests deleting a clip other tests used.
