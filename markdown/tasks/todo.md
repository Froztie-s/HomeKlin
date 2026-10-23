# Task List: HomeKlin Web Platform

Conventions for every task: tests written first; `npm run typecheck`, `npm run lint`, `npm test` pass before commit; UI tasks are checked in a mobile viewport (customer/cleaner) or desktop viewport (agency/admin) and in both languages once T4 exists. Sizes: XS=1 file, S=1-2, M=3-5.

> The hold of 2026-10-19 (the user re-editing user flows) was lifted by the user on 2026-10-22: "just work through the build". If changed flows arrive later, update `markdown/SPEC.md` and the affected tasks below first.

## Phase 1: Foundation

- [x] **T1 Scaffold project and quality gates** (S)
  - Accept: Next.js+TS+Tailwind app runs; scripts `dev build typecheck lint test test:e2e db:seed` exist; Vitest and Playwright run one placeholder test; `markdown/CONSTRAINTS.md` states the bar (no skipped tests, no suppressions); git repo initialised.
  - Verify: `npm run build && npm test && npm run test:e2e`.
  - Deps: none. Skills: `constraint-driven-development`, `git-workflow-and-versioning`, `source-driven-development`.
- [x] **T2 Deploy skeleton and CI** (S) — live at https://home-klin.vercel.app; uptime monitor still to be added by the user
  - Accept: public Vercel URL serves a health page; Supabase project connected via env vars; CI runs typecheck, lint, test on push; uptime monitor pointed at `/api/health`.
  - Verify: open the URL; trigger CI; health endpoint returns 200.
  - Deps: T1, human accounts. Skills: `ci-cd-and-automation`, `source-driven-development`.
- [x] **T3 Design direction and layout shells** (M) — plus a static customer home preview with sample data (user approved)
  - Accept: design tokens (colour, type, spacing); mobile shell with bottom navigation for customer/cleaner; desktop shell with sidebar for agency/admin; one chosen design skill documented in the T3 design doc (since replaced; in git history).
  - Verify: Playwright screenshots at phone and desktop widths; no horizontal scroll at 360 px.
  - Deps: T2. Skills: `design-taste-frontend` or `impeccable`, `ui-ux-pro-max`, `frontend-ui-engineering`.
- [x] **T3b Redesign: one brand to the customer, landing page** (M) — user request after the T3 review (2026-10-18); prompt in `markdown/prompts/t3b-redesign.md`. Done 2026-10-18: live at `/` and `/home`, CI green; awaiting the user's review
  - Accept: `markdown/PRODUCT.md`, `markdown/SPEC.md` and the tasks describe the one-brand model; the design doc rewritten with a design read (the T3b version, deleted 2026-10-19, is in git history: `git show 96335bf:markdown/design-t3b.md`), dials and researched references (taste skill); landing page at `/` (own layout, one CTA "Pesan sekarang", real photos); customer app home at `/home`; customer nav Beranda, Layanan, Pesanan, Bantuan, Akun; no customer page contains "agensi", "agency" or "mitra"; `/agencies` and the agency "Layanan" page removed; admin "Layanan & Harga" placeholder at `/admin/services`; photos credited in `markdown/image-sources.md`.
  - Verify: `npm run check`; `npm run test:e2e` (incl. the no-agency-wording test); `npm run screenshots -- t3b`; taste-skill pre-flight; the live URL serves `/` and `/home`.
  - Deps: T3. Skills: `design-taste-frontend`, `frontend-ui-engineering`, `test-driven-development`.
- [x] **T3c Landing page on the redesign system** (M) — user request (2026-10-19): build `/` from `markdown/design.md` (Brightnest-style: forest green, lime, cream; Inter Tight + Instrument Serif italic + Inter) with the user's reference screenshot as the layout. Done 2026-10-19; pushed (commit 96335bf), CI green, live
  - Accept: the landing uses the redesign tokens through `.theme-forest` (apps unchanged); utility bar and one-row header; 7/5 hero with the sample job card over the photo (below it on phones); trust row of four SPEC facts; four service cards with sample prices; safety bento; dark "Cara kerja" band with five steps; FAQ; CTA shell; dark footer with ghost wordmark; one CTA label "Pesan sekarang"; no invented numbers, ratings or testimonials; no em or en dash in visible text; AA contrast (design.md table).
  - Verify: `npm run check`; `npm run test:e2e` (landing, landing.desktop, landing.mobile, no-agency-wording, no-horizontal-scroll); `npm run screenshots -- t3c`; taste-skill pre-flight.
  - Deps: T3b. Skills: `design-taste-frontend`, `frontend-ui-engineering`, `test-driven-development`.
- [x] **T4 Bilingual switch (ID default, EN)** (S) — done 2026-10-22: next-intl, English under `/en`, Indonesian for every new visitor, choice remembered for a year; all current pages translated
  - Accept: language switch in both shells; choice persists; all shell text translated; missing-key test fails the build.
  - Verify: Playwright toggles language and checks text.
  - Deps: T3. Skills: `source-driven-development` (next-intl docs).
- [x] **T5 Auth, roles and RLS base** (M) — done 2026-10-23, live: `/login`, `/signup`, sign-out, role check on all 15 protected pages (in each page, since a layout's check does not protect its pages), RLS on `profiles` (7 integration tests on the test project), e2e signed in per role; `npm run check` 150 tests, e2e 214 passed
  - Accept: sign up/in/out for customer; `profiles` table with role (customer, cleaner, agency, admin); server `requireRole()` helper; RLS tests show a user cannot read another user's profile; role-based redirect after login.
  - Verify: Vitest RLS tests; Playwright login per role.
  - Deps: T4. Skills: `security-and-hardening`, `api-and-interface-design`.
- [x] **T6 Seed script (base)** (S) — done 2026-10-23: `npm run db:seed -- <live|test>`, 8 fictional demo users; run twice on live (8 created, then 8 updated); every seeded user signs in on live and reads only its own profile; refuses demo e-mails registered by anyone else
  - Accept: `npm run db:seed` is repeatable and creates one demo user per role, two agencies, cleaners; all fictional.
  - Verify: run twice, no duplicates; log in as each seeded user.
  - Deps: T5.

### Checkpoint 1: Foundation
- [ ] Build, tests, CI green; deployed URL works; login works for all four roles; `code-review-and-quality` run; review with human. — 2026-10-23: all done except the user's review (CI green, live login checked for all four demo roles, review findings fixed; see `markdown/Progress.md`)

## Phase 2: Catalog and order

- [ ] **T7 Catalog data and API** (M)
  - Accept: tables for HomeKlin services (type, one price set by admin), service areas, partner agencies and the areas they serve, and agency availability slots per area; an "available slots" query returns, per area, the combined free slots of the agencies serving it (a slot appears only if at least one agency there has it free); seed includes at least 6 services and 2 agencies covering overlapping areas; list endpoint supports area/type filters and keyword search (in both languages); service names and descriptions are stored in Indonesian and English (since T4 every page is bilingual); RLS: public read of active services and of aggregated availability only, never of agency identity.
  - Verify: Vitest for filters, slot aggregation (incl. an area with no free agency) and RLS.
  - Deps: T6. Skills: `api-and-interface-design`.
- [ ] **T7b Admin services and price list** (S)
  - Accept: admin creates and edits HomeKlin services and their prices at `/admin/services`; non-admins are refused on the server and by RLS; changes appear in the customer catalog.
  - Verify: Playwright desktop admin edit; Vitest/RLS test that an agency or customer cannot change a price.
  - Deps: T7. Skills: `frontend-ui-engineering`, `security-and-hardening`.
- [ ] **T8 Customer catalog UI** (M)
  - Accept: mobile-first browse/search/filter of HomeKlin's services; price shown clearly with no hidden fees; free slots for the chosen area visible; no agency shown or named anywhere; empty state when no slot is free in the area; loading states.
  - Verify: Playwright mobile: find a service by area and type; the no-agency-wording test still passes.
  - Deps: T7. Skills: `frontend-ui-engineering`.
- [ ] **T9 Booking with streaming consent and automatic routing** (M)
  - Accept: customer books a service and a free slot with address; the booking is routed automatically to one partner agency in that area with the slot free; routing is race-safe (two simultaneous bookings for the last free capacity: exactly one succeeds, the other is told the slot is no longer free); consent toggle must be on to submit; order status `pending_payment`; the customer's response never contains the agency.
  - Verify: Vitest concurrent-booking test and routing tests (one agency free, several free, none free); Playwright booking happy path and rejection.
  - Deps: T8. Skills: `api-and-interface-design`, `doubt-driven-development` (routing race).
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

- [ ] **T27 Agency manages its availability** (M)
  - Accept: agency CRUD on its own availability slots per service area only (page "Jadwal"); changes appear in the customer's aggregated free slots; agencies cannot create services or change prices.
  - Verify: Playwright; RLS tests that agency A cannot edit agency B's slots and that no agency can write services or prices.
  - Deps: T7. Skills: `frontend-ui-engineering`, `security-and-hardening`.
- [ ] **T28 Agency manages cleaners and assigns routed jobs** (M)
  - Accept: agency adds its cleaners (name, photo); sees only the paid jobs routed to it; assigns one of its own cleaners; the cleaner then sees the job, and the customer sees the cleaner's name and photo as "Petugas HomeKlin" (never the agency).
  - Verify: Playwright agency -> cleaner -> customer flow; RLS test that an agency cannot see or assign another agency's jobs.
  - Deps: T27, T17.
- [ ] **T29 Agency video access (own cleaners only)** (M)
  - Accept: agency watches live stream and recordings of its own cleaners; other agencies' are refused.
  - Verify: Vitest authorization matrix; Playwright.
  - Deps: T23, T14, T28. Skills: `security-and-hardening`, `doubt-driven-development`.

### Checkpoint 8: Agency
- [ ] Agency flows work; cross-agency access refused; review.

## Phase 9: Reviews

- [ ] **T30 Rating and review after completed job** (S)
  - Accept: customer rates a completed job once, for the HomeKlin service and the cleaner ("Petugas HomeKlin"); shown on the service; never names a partner agency on customer pages; only the booking's customer can review.
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
