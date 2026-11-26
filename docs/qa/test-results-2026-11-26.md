# Test results, 26 November 2026

After pull request #1 (UX improvements) was merged and the redesign was complete. Replaces the figures of
`test-results-2026-11-05.md`; the traceability to the Quality Plan is still `quality-plan-traceability.md`.

| Check | Result |
|---|---|
| Typecheck (`npm run typecheck`) | clean |
| Lint (`npm run lint`) | 0 errors, 3 warnings (unused parameters, two in older code) |
| Unit and integration tests (`npm test`, against the separate test project) | 114 files, 1140 tests, all pass |
| End-to-end tests (`npm run test:e2e`, Playwright, mobile and desktop projects, production build) | 529 pass, 0 fail (local, 5.3 minutes) |
| Production dependency audit (`npm audit --omit=dev --audit-level=high`) | passes in CI; 7 moderate advisories on Next.js 16.4.2 are listed in `markdown/Progress.md` for the user's decision |
| Mobile performance (lab, Slow 4G, 4x CPU) | landing LCP 2.40 s, CLS 0; `/services` 1.7 to 2.0 s; `/login` 1.3 s; see `webperf-2026-11-26.md` |
| Availability | 73 of 73 checks up since 2026-11-05; see `uptime.md` for the sampling limit |

## What changed since 2026-11-05
- The PR rewrote or edited about 25 e2e specs without running them; 28 failed at first. Each was reviewed: all were
  specs out of date with the intended behaviour (or a racy helper or a time-of-day assumption), none an app defect,
  and none exposed another customer's data (the "another customer" tests for orders, reviews and recordings pass
  with all their privacy assertions unchanged).
- A flaky integration test (`recording-access`) now compares the replay link with the file stored for the recording.
- CI: the job limit was raised from 20 to 45 minutes; the end-to-end step takes about 20 minutes on GitHub's runner.

## Not covered by these numbers
- Real devices, browsers other than Chromium, and three people booking unaided (T35).
- The payment e2e tests that choose a card need the `MIDTRANS_CLIENT_KEY` repository secret in CI.
- The live site's cron jobs: `CRON_SECRET` is not set in Vercel (the routes answer 503), so the weekly payouts and
  the 7-day recording cleanup are not running in production.
