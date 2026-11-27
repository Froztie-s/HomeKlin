# Ship decision, 27 November 2026 (T39 pre-launch review)

Method: the `/ship` fan-out. Three specialists reviewed `main` in parallel (code reviewer, security auditor, test
engineer), then the lead merged their reports and checked infrastructure, documentation and accessibility directly.
Reports are summarised here; the findings that were fixed are in the commits named below.

## Decision: GO for the demo. GO for UAT once the three items marked **before UAT** are done.

No Critical or High finding is open. The one Critical (below) was found by two reviewers independently, fixed,
tested against the real test database and is deployed.

### Fixed during the review
| Finding | Source | Fix |
|---|---|---|
| **Critical:** sign-up with email confirmation let whoever registered an address first keep a working password after the real owner confirmed (Supabase keeps the first password of an unconfirmed address) | code review C1, security H1 | the person who types the code decides the password: `setCustomerPassword` after the code check, account marked server-side, later code sign-ins keep it; real-database test of the attack (commit c1f96b9, deployed) |
| Unused guest action could create accounts and mail strangers | code review, security | `sendOrderCode` no longer creates accounts |
| Owner dashboard: revenue tile and daily chart used different windows and could disagree | test review | new migration `20261127100000_owner_numbers_calendar_window.sql` + regression test (applied to the test project and, with your permission, to live on 2026-11-27) |
| Tests that passed or failed by timing (code sign-in e2e missing, admin search for a real order, reads before the page streamed in, shared customer in parallel payment specs, clock edges, a playable video for the admin order page, leftover seed clip) | test review | merges t1-tests, t2-e2e and the admin order spec fix |
| ADR 0004 described guest checkout | review | ADR 0007 written, 0004 marked superseded |

### Blockers before UAT (need you)
1. **Sign up once on the live site** with an address of yours: type the code, check you land on the order flow; then sign up
   again with the same address and a different password and check that only the password you typed with the code works
   (the real-Supabase behaviour is the one thing only a live run can prove).
2. **`CRON_SECRET` in Vercel** (both cron routes answer 503: weekly payouts and the 7-day recording deletion are not running).
3. **GitHub secret `MIDTRANS_CLIENT_KEY`**: three payment e2e specs fail in CI without it (the card option is absent).

### Recommended before UAT
- The auth email allowance (`rate_limit_email_sent`) stays at 30 per hour for sign-up, resend and code sign-in together (your decision); testers share it, so tell them what "too many attempts" means.
- Give admin and owner their own passwords (one shared demo password covers every seeded account), and rotate after UAT.
- Decide: an unpaid order can still be paid after its window has passed (no check in the database); overdue check-out jobs read "in progress" on the customer's order page.
- Choose the photo hosts for `images.remotePatterns`.

### Acknowledged risks (shipping anyway)
- Supabase's code limits are per egress address, not per attacker, and the email allowance is shared (accepted risk M3, now also covering sign-up).
- Session cookies are readable by scripts and there is no `script-src` policy; no injection sink was found.
- `/o/<token>` order links sign in on a GET and replace an existing session (by design, revocable, 30 days).
- Test project has email confirmation off, so the code step of sign-up is covered by unit tests, a real-database test of the password rule, and a manual check, not by an e2e run.

### Rollback plan
- **Trigger:** errors on sign-up or order placement, customers locked out, or a wrong number on the owner page.
- **Code:** in Vercel, Deployments, promote the previous deployment of `main` (about 1 minute, no rebuild); or `git revert <commit>` and push (about 5 minutes).
- **Sign-up confirmation:** if the code step fails for real users, `npm run supabase -- autoconfirm live` switches email confirmation off at once (sign-up then signs in immediately, as before 27 November); the security hole of an unconfirmed address then returns, so use it only briefly and tell people.
- **Database:** migrations only add or replace functions; the owner migration is undone by applying `20261120110000_owner_status_by_payment_date.sql` again.
- **Recovery target:** under 15 minutes.

## Evidence
Typecheck and lint clean; 116 files, 1202 unit and integration tests pass; e2e suite 529 tests (526 passed in the last full
run, the one failure fixed afterwards and checked three times); `npm audit --omit=dev`: 0 vulnerabilities; axe scan of 76 page runs:
one accepted decorative-contrast flag (`accessibility-scan-2026-11-26.md`); lab LCP 2.40 s on Slow 4G (`webperf-2026-11-26.md`);
availability 73 of 73 checks (`uptime.md`); live site and health check answer 200.
