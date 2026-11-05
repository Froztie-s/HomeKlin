# Internal test results, 5 November 2026 (T37)

Internal testing by the software house before QA/UAT by the client group (Contract Pasal 4). Each Quality
Plan target and the tests that cover it: `docs/qa/quality-plan-traceability.md`.

## Result of the final run
| Suite | What it runs against | Result |
|---|---|---|
| Typecheck (strict TypeScript) | the whole repository | 0 errors |
| Lint | the whole repository | 0 errors, 1 warning (an unused variable in a test) |
| Unit and integration tests (Vitest, 70 files) | the separate Supabase test project: row-level security, every database function, each role's allowed and refused cases | 707 tests: 706 passed on the full run. The one failure was a 5-second timeout in `catalog-rls.test.ts` while many files used the shared project; its group now has 30 seconds, and it passes (15 of 15) |
| Browser tests (Playwright, 38 files, phone and desktop) | a production build of the app against the test project | 371 passed, 0 failed |
| Production dependencies | npm advisory database | 0 vulnerabilities at high or above |

How to rerun: `npm run check`, then `npm run test:e2e` (README, "Commands"). CI runs the same on every
push (`.github/workflows/ci.yml`).

## What the tests cover, by area
- **Booking and payment:** ordering with an emailed code, a window taken between the code and the order,
  returning customers, at most 3 unpaid orders, unpaid orders released after 2 hours; payment outcomes
  successful, failed and cancelled through signed Midtrans notifications, repeats and out-of-order
  notifications, the place given back.
- **Jobs:** check-in only in the window and with a location, check-out completing the job, assignment of
  an agency's own cleaners only.
- **Live view and recordings:** who may watch (the job's customer during the job, its agency, admin) and
  who may replay (the same three), for each role, own and other, available and expired; 7-day deletion
  with a 2-second retention.
- **Support:** FAQ search in both languages, escalation, live chat between a customer and an admin in two
  browser sessions, a customer never seeing another's tickets (also over Realtime).
- **Back offices:** agency windows, cleaners, assignment; admin console; owner numbers, partner
  suspension (a suspended partner receives no booking), admin accounts.
- **Privacy rules:** no customer page names a partner agency; nothing scrolls sideways at 360 px; every
  protected page checks the role.

## Not covered by automated tests
- Latency of the live stream (target 3 seconds), adaptive bitrate and recovery after a connection drop: not
  provided. No real stream is built (decision of 2026-11-05); the live view plays pre-recorded clips (ADR 0002).
- Real devices and browsers (Chrome Android, Safari iOS 16 and later, desktop Edge and Firefox) and the
  trial with three people (T35).
- A real Midtrans Sandbox payment on the live URL, run by hand: successful (1 November 2026), failed with the deny
  card and cancelled through Midtrans's cancel call (5 November 2026). Each moved its order correctly and gave the
  window back.
- Availability of 99% during UAT: recorded by the Uptime workflow (every 10 minutes, `npm run uptime`, see
  `docs/qa/uptime.md`); its figure exists once it has run for a while.
