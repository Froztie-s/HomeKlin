# Task List: HomeKlin Web Platform

Conventions for every task: tests written first; `npm run typecheck`, `npm run lint`, `npm test` pass before commit; UI tasks are checked in a mobile viewport (customer/cleaner) or desktop viewport (agency/admin) and in both languages once T4 exists. Sizes: XS=1 file, S=1-2, M=3-5.

## Phase 1: Foundation

- [ ] **T1 Scaffold project and quality gates** (S)
  - Accept: Next.js+TS+Tailwind app runs; scripts `dev build typecheck lint test test:e2e db:seed` exist; Vitest and Playwright run one placeholder test; `CONSTRAINTS.md` states the bar (no skipped tests, no suppressions); git repo initialised.
  - Verify: `npm run build && npm test && npm run test:e2e`.
  - Deps: none. Skills: `constraint-driven-development`, `git-workflow-and-versioning`, `source-driven-development`.
- [ ] **T2 Deploy skeleton and CI** (S)
  - Accept: public Vercel URL serves a health page; Supabase project connected via env vars; CI runs typecheck, lint, test on push; uptime monitor pointed at `/api/health`.
  - Verify: open the URL; trigger CI; health endpoint returns 200.
  - Deps: T1, human accounts. Skills: `ci-cd-and-automation`, `source-driven-development`.
- [ ] **T3 Design direction and layout shells** (M)
  - Accept: design tokens (colour, type, spacing); mobile shell with bottom navigation for customer/cleaner; desktop shell with sidebar for agency/admin; one chosen design skill documented in `docs/design.md`.
  - Verify: Playwright screenshots at phone and desktop widths; no horizontal scroll at 360 px.
  - Deps: T2. Skills: `design-taste-frontend` or `impeccable`, `ui-ux-pro-max`, `frontend-ui-engineering`.
- [ ] **T4 Bilingual switch (ID default, EN)** (S)
  - Accept: language switch in both shells; choice persists; all shell text translated; missing-key test fails the build.
  - Verify: Playwright toggles language and checks text.
  - Deps: T3. Skills: `source-driven-development` (next-intl docs).
- [ ] **T5 Auth, roles and RLS base** (M)
  - Accept: sign up/in/out for customer; `profiles` table with role (customer, cleaner, agency, admin); server `requireRole()` helper; RLS tests show a user cannot read another user's profile; role-based redirect after login.
  - Verify: Vitest RLS tests; Playwright login per role.
  - Deps: T4. Skills: `security-and-hardening`, `api-and-interface-design`.
- [ ] **T6 Seed script (base)** (S)
  - Accept: `npm run db:seed` is repeatable and creates one demo user per role, two agencies, cleaners; all fictional.
  - Verify: run twice, no duplicates; log in as each seeded user.
  - Deps: T5.

### Checkpoint 1: Foundation
- [ ] Build, tests, CI green; deployed URL works; login works for all four roles; `code-review-and-quality` run; review with human.

## Phase 2: Catalog and order

- [ ] **T7 Catalog data and API** (M)
  - Accept: tables for services (type, price, area), schedule slots per agency; seed includes at least 6 services across 2 agencies; list endpoint supports area/type filters and keyword search; RLS: public read of active services only.
  - Verify: Vitest for filters and RLS.
  - Deps: T6. Skills: `api-and-interface-design`.
- [ ] **T8 Customer catalog UI** (M)
  - Accept: mobile-first browse/search/filter; price shown clearly with no hidden fees; available slots visible; empty and loading states.
  - Verify: Playwright mobile: find a service by area and type.
  - Deps: T7. Skills: `frontend-ui-engineering`.
- [ ] **T9 Booking with streaming consent** (M)
  - Accept: customer books a slot with address; a taken slot is rejected; consent toggle must be on to submit; order status `pending_payment`.
  - Verify: Vitest double-booking test; Playwright booking happy path and rejection.
  - Deps: T8. Skills: `api-and-interface-design`, `doubt-driven-development` (double-booking race).
- [ ] **T10 Midtrans Sandbox payment start** (S)
  - Accept: server creates a Snap transaction for an order; pay screen opens the sandbox payment; keys only in env vars.
  - Verify: manual sandbox payment; unit test for payload.
  - Deps: T9, human Midtrans keys. Skills: `source-driven-development`.
- [ ] **T11 Payment webhook with status mapping** (M)
  - Accept: signature verified; `successful`, `failed`, `cancelled` each set the correct order status; repeated webhooks give the same result (idempotent); unknown signature rejected.
  - Verify: Vitest tests for all three statuses plus replay; Playwright with sandbox.
  - Deps: T10. Skills: `security-and-hardening`, `doubt-driven-development`.
- [ ] **T12 Customer order list and status** (S)
  - Accept: customer sees only own orders with status; paid orders show the job slot.
  - Verify: Playwright; RLS test that another customer's orders are hidden.
  - Deps: T11.

### Checkpoint 2: Booking and payment
- [ ] Booking -> payment -> status works end to end on the deployed URL; all three payment outcomes tested; review.

## Phase 3: Customer recording replay (top priority)

- [ ] **T13 Recordings storage and attach seam** (M)
  - Accept: `recordings` table (job, agency, file path, created, expires = +7 days); private bucket; storage policies deny direct public access; `attachRecording(jobId)` attaches a clip from a small clip library; seed includes completed jobs with clips (clips supplied by you).
  - Verify: Vitest for expiry date; bucket not readable without a signed link.
  - Deps: T12, human clips. Skills: `source-driven-development`, `security-and-hardening`.
- [ ] **T14 Authorized signed-link endpoint** (S)
  - Accept: returns a short-lived signed link only for the booking's customer, the owning agency, or admin; other customers/agencies refused; expired entries refused.
  - Verify: Vitest authorization matrix (each role x own/other x expired).
  - Deps: T13. Skills: `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`.
- [ ] **T15 Customer recording replay UI** (M)
  - Accept: completed jobs list shows "available until" countdown; player plays the clip; expired state shown clearly; mobile-first; both languages.
  - Verify: Playwright mobile: play own recording; expired job shows message.
  - Deps: T14. Skills: `frontend-ui-engineering`, `browser-testing-with-devtools`.
- [ ] **T16 7-day retention cleanup** (S)
  - Accept: scheduled job deletes files and marks entries expired after 7 days; retention length configurable for testing.
  - Verify: Vitest/integration with a 1-minute retention: file gone from storage and server refuses entry.
  - Deps: T13.

### Checkpoint 3: Replay
- [ ] Customer can replay own recording; other users cannot; expiry works; security review of T13-T16.

## Phase 4: Cleaner check-in

- [ ] **T17 Cleaner job list** (S)
  - Accept: cleaner sees only own assigned jobs for today/upcoming; seed assigns cleaners to paid orders.
  - Verify: Playwright cleaner login; RLS test hides other cleaners' jobs.
  - Deps: T12. Skills: `frontend-ui-engineering`.
- [ ] **T18 Check-in/out with location, completes job** (M)
  - Accept: check-in allowed only in the job's time window and records location and time; check-out completes the job and calls `attachRecording`; status visible read-only to admin and agency.
  - Verify: Vitest for window logic; Playwright check-in/out flow.
  - Deps: T17, T13. Skills: `doubt-driven-development` (time-window edge cases).

### Checkpoint 4: Job lifecycle
- [ ] Book -> pay -> cleaner check-in -> check-out -> customer sees recording; all e2e; review.

## Phase 5: Customer support (can run in parallel after T5)

- [ ] **T19 FAQ with keyword search** (S)
  - Accept: bilingual FAQ entries from the database; keyword search returns matches; "Contact admin" appears when nothing satisfies the user.
  - Verify: Playwright search finds a known entry; no-match shows escalation.
  - Deps: T5. Skills: `frontend-ui-engineering`.
- [ ] **T20 Escalation to chat ticket (customer side)** (M)
  - Accept: escalation creates a ticket with the question; customer chat updates in real time; customer sees only own tickets.
  - Verify: Playwright; RLS test.
  - Deps: T19. Skills: `source-driven-development` (Supabase Realtime).
- [ ] **T21 Admin ticket inbox and reply** (M)
  - Accept: desktop inbox lists tickets by urgency/age; admin replies appear for the customer in real time; every escalation scenario reaches the inbox.
  - Verify: Playwright two-session test (customer and admin).
  - Deps: T20. Skills: `frontend-ui-engineering`.

### Checkpoint 5: Support
- [ ] 100% of escalation scenarios reach the inbox; review.

## Phase 6: Live viewer (demo source)

- [ ] **T22 Stream seam, demo source, cleaner stream page** (M)
  - Accept: `StreamSource` interface with a demo clip source; `stream_sessions` table; cleaner "start stream" page with status indicator (active, weak signal, disconnected simulated); stream tied to an active job.
  - Verify: Vitest for the interface; Playwright start/stop.
  - Deps: T18. Skills: `api-and-interface-design`.
- [ ] **T23 Customer live viewer with access rules** (M)
  - Accept: customer can watch only the cleaner on their own active, consented booking; other cleaners, finished jobs or no consent are refused by the server; no way to list streams.
  - Verify: Vitest authorization matrix; Playwright viewer plus guessed-URL attempt.
  - Deps: T22. Skills: `security-and-hardening`, `doubt-driven-development`, `frontend-ui-engineering`.

### Checkpoint 6: Live viewer
- [ ] Demo "live" feed works for the right customer only; review.

## Phase 7: Admin console

- [ ] **T24 Admin dashboard** (M)
  - Accept: desktop dashboard shows active jobs, check-in status, open tickets.
  - Verify: Playwright desktop viewport.
  - Deps: T18, T21. Skills: `frontend-ui-engineering`.
- [ ] **T25 Multi-feed live grid** (M)
  - Accept: admin sees all active feeds at once; non-admins refused; layout works at desktop widths.
  - Verify: Playwright with two active jobs; authorization test.
  - Deps: T23, T24.
- [ ] **T26 Admin recording replay** (S)
  - Accept: admin lists past jobs and plays recordings still within 7 days.
  - Verify: Playwright; expired entry refused.
  - Deps: T14, T24.

### Checkpoint 7: Admin
- [ ] Admin can monitor, support and replay; review.

## Phase 8: Agency back office

- [ ] **T27 Agency manages services, prices, slots** (M)
  - Accept: agency CRUD on own services and slots only; changes appear in the customer catalog.
  - Verify: Playwright; RLS test that agency A cannot edit agency B.
  - Deps: T7. Skills: `frontend-ui-engineering`, `security-and-hardening`.
- [ ] **T28 Agency manages cleaners and assigns jobs** (M)
  - Accept: agency adds cleaners and assigns them to paid orders; cleaner then sees the job.
  - Verify: Playwright agency -> cleaner flow.
  - Deps: T27, T17.
- [ ] **T29 Agency video access (own cleaners only)** (M)
  - Accept: agency watches live stream and recordings of its own cleaners; other agencies' are refused.
  - Verify: Vitest authorization matrix; Playwright.
  - Deps: T23, T14, T28. Skills: `security-and-hardening`, `doubt-driven-development`.

### Checkpoint 8: Agency
- [ ] Agency flows work; cross-agency access refused; review.

## Phase 9: Reviews

- [ ] **T30 Rating and review after completed job** (S)
  - Accept: customer rates a completed job once; shown on the service; only the booking's customer can review.
  - Verify: Playwright; RLS test.
  - Deps: T12.

## Phase 10: Real live stream (LiveKit)

- [ ] **T31 LiveKit token endpoint and rooms** (S)
  - Accept: server-issued, short-lived tokens scoped to one room per job; same access matrix as T23/T29/T25; no token for unauthorized users.
  - Verify: Vitest matrix.
  - Deps: T23, T29, T25, human LiveKit keys. Skills: `source-driven-development`, `security-and-hardening`.
- [ ] **T32 LiveKit source: publish, view, resilience** (M)
  - Accept: cleaner's phone browser publishes; customer/agency/admin view; adaptive bitrate on; stream recovers after a connection drop; status indicator reflects real state; demo source still selectable.
  - Verify: two-device manual test with throttled network.
  - Deps: T31. Skills: `debugging-and-error-recovery`.
- [ ] **T33 Measure latency and recovery** (XS)
  - Accept: end-to-end latency <= 3 s measured and recorded in `docs/`; recovery time recorded.
  - Verify: documented measurements.
  - Deps: T32.

### Checkpoint 9: Streaming
- [ ] Real stream meets targets or the gap is documented honestly.

## Phase 11: Hardening, evidence, ship

- [ ] **T34 Security and RLS audit** (M)
  - Accept: every table has RLS; cross-role and cross-tenant tests pass; no secrets in repo; findings fixed or logged.
  - Verify: test suite plus `security-auditor` agent review.
  - Deps: all features. Skills: `security-and-hardening`.
- [ ] **T35 Compatibility, accessibility, usability trial** (M)
  - Accept: main flows pass on Chrome Android, Safari iOS 16+, desktop Chrome/Edge/Firefox; 3 people book a service unaided; accessibility fixes done.
  - Verify: device matrix recorded in `docs/`.
  - Deps: all UI. Skills: `browser-testing-with-devtools`, `frontend-ui-engineering`.
- [ ] **T36 Mobile performance pass** (S)
  - Accept: key customer pages load acceptably on a mobile connection; findings fixed.
  - Verify: `/agent-skills:webperf` audit report.
  - Deps: T35. Skills: `performance-optimization`.
- [ ] **T37 Quality Plan e2e suite and evidence** (M)
  - Accept: one Playwright spec per Quality Plan scenario passes; results saved in `docs/`; defect log shows 0 critical; uptime report started.
  - Verify: `npm run test:e2e` output archived.
  - Deps: T34-T36.
- [ ] **T38 Documentation and handover** (M)
  - Accept: README (setup, env vars, commands); ADRs for website-vs-Android, demo clips, and "encrypted in transit, not end-to-end"; handover list per Contract (source, docs, config, access).
  - Verify: a fresh clone can run from the README.
  - Deps: T37. Skills: `documentation-and-adrs`, `code-simplification`.
- [ ] **T39 Pre-demo ship checklist** (S)
  - Accept: Supabase project awake; seed data fresh; clips present; URL works on a phone; demo script written; rollback plan noted.
  - Verify: `/agent-skills:ship` checklist complete.
  - Deps: T38. Skills: `shipping-and-launch`.

### Checkpoint: Complete
- [ ] All acceptance criteria met; 0 critical defects; hand over to the client group for UAT.
