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
- [x] Build, tests, CI green; deployed URL works; login works for all four roles; `code-review-and-quality` run; review with human. — 2026-10-23: all done; the user reviewed on 2026-10-24 (CI green, live login checked for all four demo roles, review findings fixed; see `markdown/Progress.md`)

## Phase 2: Catalog and order

- [x] **T7 Catalog data and API** (M) — done 2026-10-24: migration `20261024100000_catalog.sql` (services, service areas, agencies, agency areas, arrival windows; RLS); `src/lib/catalog/catalog.ts` (`listServices`, `listServiceAreas`, `listFreeSlots`) and `src/lib/validation/catalog.ts`; seed: 7 services, 5 areas, 2 agencies overlapping in Jakarta Selatan and Pusat, none in Jakarta Utara, 3 weeks of windows; live and test migrated and seeded
  - Accept: tables for HomeKlin services (type, one price set by admin), service areas, partner agencies and the areas they serve, and agency availability slots per area; an "available slots" query returns, per area, the combined free slots of the agencies serving it (a slot appears only if at least one agency there has it free); seed includes at least 6 services and 2 agencies covering overlapping areas; list endpoint supports area/type filters and keyword search (in both languages); service names and descriptions are stored in Indonesian and English (since T4 every page is bilingual); RLS: public read of active services and of aggregated availability only, never of agency identity.
  - Verify: Vitest for filters, slot aggregation (incl. an area with no free agency) and RLS.
  - Deps: T6. Skills: `api-and-interface-design`.
- [x] **T7b Admin services and price list** (S) — done 2026-10-24 (admin agent): `/admin/services` list, create (`/new`), edit (`/edit?id=`), on/off switch, no delete; Server Actions with `authorize` + RLS + `updateTag`; e2e `admin-services` and `admin-to-catalog` (a saved price shows on `/services` at once)
  - Accept: admin creates and edits HomeKlin services and their prices at `/admin/services`; non-admins are refused on the server and by RLS; changes appear in the customer catalog.
  - Verify: Playwright desktop admin edit; Vitest/RLS test that an agency or customer cannot change a price.
  - Deps: T7. Skills: `frontend-ui-engineering`, `security-and-hardening`.
- [x] **T8 Customer catalog UI** (M) — done 2026-10-24 (customer agent): `/services` with area picker, type filter, keyword search, full prices, the area's free arrival windows (Jakarta time), empty states (Jakarta Utara, no match), loading skeletons; `/home` and the landing grid on real data
  - Accept: mobile-first browse/search/filter of HomeKlin's services; price shown clearly with no hidden fees; free slots for the chosen area visible; no agency shown or named anywhere; empty state when no slot is free in the area; loading states.
  - Verify: Playwright mobile: find a service by area and type; the no-agency-wording test still passes.
  - Deps: T7. Skills: `frontend-ui-engineering`.
- [x] **T9 Booking with streaming consent and automatic routing** (M) — done 2026-10-25: `book_slot()` routes race-safely (integration-tested: 5 two-way races, a three-way race, one/several/none free); `/book` with address and consent, confirmation on `/orders?booked=`, "no longer free" handling; e2e happy path (no agency in the HTML) and rejection
  - Accept: customer books a service and a free slot with address; the booking is routed automatically to one partner agency in that area with the slot free; routing is race-safe (two simultaneous bookings for the last free capacity: exactly one succeeds, the other is told the slot is no longer free); consent toggle must be on to submit; order status `pending_payment`; the customer's response never contains the agency.
  - Verify: Vitest concurrent-booking test and routing tests (one agency free, several free, none free); Playwright booking happy path and rejection.
  - Deps: T8. Skills: `api-and-interface-design`, `doubt-driven-development` (routing race).
- [x] **T9b Order without sign-up (email code at checkout)** (M) — superseded 2026-11-27 (user decision): ordering now needs an account whose email is confirmed by an emailed code (`markdown/SPEC.md`); the pages changed on 2026-11-20 (UX pull request), the sign-up code step is task S1 below. Done 2026-10-25: `/pesan` with emailed code, login by code (password at `/login?cara=sandi` for staff), `/signup` and `/book` redirect to `/pesan`, phone on the order, confirmation email over Gmail SMTP; live email needs the user's Gmail app password
  - Accept: landing and `/services` service clicks open `/pesan?layanan=<id>`; one form (service, area, window, address, phone, email, consent); "Kirim kode" emails a 6-digit code; the code places the order (account created for a new email, signed in); a signed-in customer skips the code; `/login` signs customers in by code, with password login kept for staff; `/signup` removed; phone stored on the order; order confirmation emailed (Gmail SMTP, nodemailer); tests never send real email (Ethereal SMTP on the test project, codes via the admin API).
  - Verify: unit tests for validation, actions and the email sender; integration test for `book_slot` with the phone; e2e: guest order end to end, wrong code, resend, returning customer by code, signed-in customer, staff password login, window taken between steps, English, 360 px.
  - Deps: T9, the user's Gmail app password. Skills: `security-and-hardening`, `frontend-ui-engineering`, `test-driven-development`.
- [x] **T10 Midtrans Sandbox payment start** (S) — done 2026-10-27: `startPayment` creates a Snap transaction from the stored order price (Sandbox only) and reuses it; "Bayar sekarang" on the order confirmation; e2e lands on the Sandbox page; the status changes only with T11
  - Accept: server creates a Snap transaction for an order; pay screen opens the sandbox payment; keys only in env vars.
  - Verify: manual sandbox payment; unit test for payload.
  - Deps: T9, human Midtrans keys. Skills: `source-driven-development`.
- [x] **T11 Payment webhook with status mapping** (M) — done 2026-10-28: `POST /api/payments/midtrans` checks Midtrans' signature, maps settlement/capture → paid, deny/failure → failed, cancel/expire → cancelled; `apply_payment_result()` moves an order once, gives the place back on failed/cancelled, answers repeats with the same status; e2e plays Midtrans with signed notifications (Midtrans cannot reach a local run; the real Sandbox round trip is checked live at Checkpoint 2)
  - Accept: signature verified; `successful`, `failed`, `cancelled` each set the correct order status; repeated webhooks give the same result (idempotent); unknown signature rejected.
  - Verify: Vitest tests for all three statuses plus replay; Playwright with sandbox.
  - Deps: T10. Skills: `security-and-hardening`, `doubt-driven-development`.
- [x] **T12 Customer order list and status** (S) — done 2026-11-01: `/orders` lists the customer's own orders newest first with status; a paid order shows "Jadwal kedatangan"; each row opens `/orders?order=<id>`; `/orders?booked=<id>` stays the confirmation and Midtrans return; the RLS check is `tests/integration/booking.test.ts` ("lists a customer's own orders through my_orders()")
  - Accept: customer sees only own orders with status; paid orders show the job slot.
  - Verify: Playwright; RLS test that another customer's orders are hidden.
  - Deps: T11.

### Checkpoint 2: Booking and payment
- [ ] Booking -> payment -> status works end to end on the deployed URL; all three payment outcomes tested; review. (All three outcomes are now confirmed on the deployed URL: successful by the user on 2026-11-01; failed and cancelled on 2026-11-05, run by the lead with the user's permission through Midtrans's real Sandbox, see `docs/qa/manual-test-sheets.md`. What remains is your review.)

## Phase 3: Customer recording replay (top priority)

- [x] **T13 Recordings storage and attach seam** (M) — done 2026-11-01, tested with stand-in bytes on the test project: the seed adds the completed jobs once the user's clips are in the git-ignored `clips/` folder and `npm run db:seed` runs; a job here is a paid order, and `orders.completed_at` is added for T18
  - Accept: `recordings` table (job, agency, file path, created, expires = +7 days); private bucket; storage policies deny direct public access; `attachRecording(jobId)` attaches a clip from a small clip library; seed includes completed jobs with clips (clips supplied by you).
  - Verify: Vitest for expiry date; bucket not readable without a signed link.
  - Deps: T12, human clips. Skills: `source-driven-development`, `security-and-hardening`.
- [x] **T14 Authorized signed-link endpoint** (S) — done 2026-11-03: `GET /api/recordings/<id>/link` and `recordingLink` (`src/lib/recordings/link.ts`); `recording_for_viewer()` lets in the booking's customer, the routed agency and admin; everyone else gets not found (404), an expired recording gone (410); links last at most 10 minutes and never past the recording's expiry
  - Accept: returns a short-lived signed link only for the booking's customer, the owning agency, or admin; other customers/agencies refused; expired entries refused.
  - Verify: Vitest authorization matrix (each role x own/other x expired).
  - Deps: T13. Skills: `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`.
- [x] **T15 Customer recording replay UI** (M) — done 2026-11-04 (frontend agent): order details show the Petugas HomeKlin with progress steps and a Rekaman section (signed link made on the server, "tersedia sampai" with a countdown, fresh link on a playback error, clear expired and no-recording states); list rows say whether the recording is available; e2e `recording-replay.mobile.spec.ts`; screenshots `docs/screenshots/t15/`
  - Accept: completed jobs list shows "available until" countdown; player plays the clip; expired state shown clearly; mobile-first; both languages.
  - Verify: Playwright mobile: play own recording; expired job shows message.
  - Deps: T14. Skills: `frontend-ui-engineering`, `browser-testing-with-devtools`.
- [x] **T16 7-day retention cleanup** (S) — done 2026-11-04: `deleteExpiredRecordings` (`src/lib/recordings/retention.ts`) deletes the files of expired recordings and marks them `deleted_at`; daily Vercel Cron `GET /api/cron/recordings` (`vercel.json`, needs `CRON_SECRET` in Vercel); `RECORDING_RETENTION_DAYS` shortens the retention; integration test with a 1-minute retention (`tests/integration/retention.test.ts`)
  - Accept: scheduled job deletes files and marks entries expired after 7 days; retention length configurable for testing.
  - Verify: Vitest/integration with a 1-minute retention: file gone from storage and server refuses entry.
  - Deps: T13.

### Checkpoint 3: Replay
- [ ] Customer can replay own recording; other users cannot; expiry works; security review of T13-T16.

## Phase 4: Cleaner check-in

- [x] **T17 Cleaner job list** (S) — done 2026-11-04: `/cleaner` lists the cleaner's own jobs (today, upcoming, just finished); the seed links cleaners to agencies and gives the demo cleaner a job starting now; RLS in `tests/integration/jobs.test.ts`; e2e `cleaner-jobs.mobile.spec.ts`; screenshots `docs/screenshots/t17/`
  - Accept: cleaner sees only own assigned jobs for today/upcoming; seed assigns cleaners to paid orders.
  - Verify: Playwright cleaner login; RLS test hides other cleaners' jobs.
  - Deps: T12. Skills: `frontend-ui-engineering`.
- [x] **T18 Check-in/out with location, completes job** (M) — done 2026-11-04: check-in with the browser's location only from 15 minutes before the window until it closes, check-out with a confirm step completes the job and attaches the recording; read-only status on `/agency/orders` and `/admin`; e2e `cleaner-jobs.mobile.spec.ts`, `job-status.desktop.spec.ts`
  - Accept: check-in allowed only in the job's time window and records location and time; check-out completes the job and calls `attachRecording`; status visible read-only to admin and agency.
  - Verify: Vitest for window logic; Playwright check-in/out flow.
  - Deps: T17, T13. Skills: `doubt-driven-development` (time-window edge cases).

### Checkpoint 4: Job lifecycle
- [ ] Book -> pay -> cleaner check-in -> check-out -> customer sees recording; all e2e; review.

## Phase 5: Customer support (can run in parallel after T5)

- [x] **T19 FAQ with keyword search** (S) — done 2026-11-04: `/support` searches the bilingual FAQ (`search_faq`, cached per search under the tag `faq`), works without JavaScript, shows the contact panel when nothing matches; e2e `support.mobile.spec.ts`; screenshots `docs/screenshots/t19/`
  - Accept: bilingual FAQ entries from the database; keyword search returns matches; "Contact admin" appears when nothing satisfies the user.
  - Verify: Playwright search finds a known entry; no-match shows escalation.
  - Deps: T5. Skills: `frontend-ui-engineering`.
- [x] **T20 Escalation to chat ticket (customer side)** (M) — done 2026-11-04: a signed-in customer turns the question into a ticket (urgency, optional own order) and lands on `/support?ticket=<id>`, a chat updating over Realtime (the browser hands over its session before joining, so row-level security applies); RLS and Realtime in `tests/integration/support.test.ts`
  - Accept: escalation creates a ticket with the question; customer chat updates in real time; customer sees only own tickets.
  - Verify: Playwright; RLS test.
  - Deps: T19. Skills: `source-driven-development` (Supabase Realtime).
- [x] **T21 Admin ticket inbox and reply** (M) — done 2026-11-04: `/admin/tickets` lists waiting, urgent, oldest first, updates live, opens the chat beside the list, replies and closes (with a confirm step); two-session e2e `support-realtime.desktop.spec.ts`
  - Accept: desktop inbox lists tickets by urgency/age; admin replies appear for the customer in real time; every escalation scenario reaches the inbox.
  - Verify: Playwright two-session test (customer and admin).
  - Deps: T20. Skills: `frontend-ui-engineering`.

### Checkpoint 5: Support
- [ ] 100% of escalation scenarios reach the inbox; review.

## Phase 6: Live viewer (demo source)

- [x] **T22 Stream seam, demo source, cleaner stream page** (M) — done 2026-11-05: `StreamSource` with the demo clip source (`src/lib/stream/source.ts`), `stream_sessions`; the checked-in job card has Mulai siaran, a live badge (green, per design.md), Aktif / Sinyal lemah / Terputus with simulation buttons, Sambung lagi and Hentikan siaran; check-out ends it; e2e `live-stream.mobile.spec.ts`; screenshots `docs/screenshots/t22/`. Known gap: the cleaner page remembers the stream state per tab (no server read for the cleaner yet), so a new tab shows Mulai siaran, which resumes the same session
  - Accept: `StreamSource` interface with a demo clip source; `stream_sessions` table; cleaner "start stream" page with status indicator (active, weak signal, disconnected simulated); stream tied to an active job.
  - Verify: Vitest for the interface; Playwright start/stop.
  - Deps: T18. Skills: `api-and-interface-design`.
- [x] **T23 Customer live viewer with access rules** (M) — done 2026-11-05: the job's customer watches on the order details and `/orders/live?order=<id>` (link made on the server only after `stream_for_viewer` allows it; status polled every 10 s; calm weak and disconnected overlays); a guessed or foreign id shows "Siaran tidak tersedia" with nothing in the HTML and the API answers 404; matrix in `tests/integration/streams.test.ts`
  - Accept: customer can watch only the cleaner on their own active, consented booking; other cleaners, finished jobs or no consent are refused by the server; no way to list streams.
  - Verify: Vitest authorization matrix; Playwright viewer plus guessed-URL attempt.
  - Deps: T22. Skills: `security-and-hardening`, `doubt-driven-development`, `frontend-ui-engineering`.

### Checkpoint 6: Live viewer
- [ ] Demo "live" feed works for the right customer only; review.

## Phase 7: Admin console

- [x] **T24 Admin dashboard** (M) — done 2026-11-04: `/admin` tiles (jobs today, in progress, waiting for a cleaner, open tickets with urgent count), today's jobs with check-in status, latest open tickets; e2e `admin-console.desktop.spec.ts`; screenshots `docs/screenshots/t24/`
  - Accept: desktop dashboard shows active jobs, check-in status, open tickets.
  - Verify: Playwright desktop viewport.
  - Deps: T18, T21. Skills: `frontend-ui-engineering`.
- [x] **T25 Multi-feed live grid** (M) — done 2026-11-04: `/admin/monitor` grid of every live feed (1 to 4 columns), status polled every 10 s, one fresh-link retry; customers and agencies redirected with nothing in the HTML (e2e); the list itself refreshes with "Perbarui daftar"
  - Accept: admin sees all active feeds at once; non-admins refused; layout works at desktop widths.
  - Verify: Playwright with two active jobs; authorization test.
  - Deps: T23, T24.
- [x] **T26 Admin recording replay** (S) — done 2026-11-04: `/admin/recordings` lists jobs finished in the last 30 days with recording state; `?recording=<id>` plays an available one; expired or deleted shows the message and the link API answers 410 (e2e)
  - Accept: admin lists past jobs and plays recordings still within 7 days.
  - Verify: Playwright; expired entry refused.
  - Deps: T14, T24.

### Checkpoint 7: Admin
- [ ] Admin can monitor, support and replay; review.

## Phase 8: Agency back office

- [x] **T27 Agency manages its availability** (M) — done 2026-11-05: `/agency/schedule` (one week at a time) adds, resizes and removes only the agency's own windows (`add_slot`, `set_slot_capacity`, `delete_slot`, each on the caller's own agency); a window added shows free on `/services` at once; no agency writes services or prices; RLS in `tests/integration/agency-back-office.test.ts`; e2e `agency-back-office.desktop.spec.ts`
  - Accept: agency CRUD on its own availability slots per service area only (page "Jadwal"); changes appear in the customer's aggregated free slots; agencies cannot create services or change prices.
  - Verify: Playwright; RLS tests that agency A cannot edit agency B's slots and that no agency can write services or prices.
  - Deps: T7. Skills: `frontend-ui-engineering`, `security-and-hardening`.
- [x] **T28 Agency manages cleaners and assigns routed jobs** (M) — done 2026-11-05: `/agency/cleaners` adds a cleaner (name, email, photo; the sign-in is made on the server after finding the caller's own agency; photos are stored under random names), `/agency/orders` assigns an own cleaner to an own job until it starts; the customer then sees the name and photo as Petugas HomeKlin, never the agency; `tests/integration/jobs.test.ts`, e2e `agency-back-office.desktop.spec.ts`
  - Accept: agency adds its cleaners (name, photo); sees only the paid jobs routed to it; assigns one of its own cleaners; the cleaner then sees the job, and the customer sees the cleaner's name and photo as "Petugas HomeKlin" (never the agency).
  - Verify: Playwright agency -> cleaner -> customer flow; RLS test that an agency cannot see or assign another agency's jobs.
  - Deps: T27, T17.
- [x] **T29 Agency video access (own cleaners only)** (M) — done 2026-11-05: `/agency/recordings` shows the agency's own live streams and replays its own recordings; another agency's stream or recording is refused (404); matrix in `tests/integration/streams.test.ts` and `recording-access.test.ts`
  - Accept: agency watches live stream and recordings of its own cleaners; other agencies' are refused.
  - Verify: Vitest authorization matrix; Playwright.
  - Deps: T23, T14, T28. Skills: `security-and-hardening`, `doubt-driven-development`.

### Checkpoint 8: Agency
- [ ] Agency flows work; cross-agency access refused; review.

## Phase 8b: Owner dashboard (user request 2026-11-03)

- [x] **T29b Owner role and business numbers** (M) — done 2026-11-05: `owner` role (own migration), `/owner` (revenue, paid orders, completed jobs, orders by status, 30-day trend with a table alternative, per-partner table) from `owner_numbers()`, which carries no customer data; sign-up cannot create an owner; demo owner `pemilik@example.com`; `tests/integration/owner.test.ts`, e2e `owner.desktop.spec.ts`
  - Accept: `owner` is added to the role enum by its own migration (`ALTER TYPE ... ADD VALUE` cannot share a transaction with statements that use the new value); `/owner` is a protected section in `src/lib/auth/roles.ts` with `RoleGate` on every owner page, so `tests/protected-pages.test.ts` stays green; the seed adds one fictional owner, marked in `app_metadata` like the other privileged users; the desktop dashboard shows revenue from paid orders, orders by status, a 30-day trend, and jobs and revenue per partner agency, read through a function that only the owner role can call and that returns no customer personal data; both languages.
  - Verify: integration tests that a customer, cleaner, agency and admin cannot call the function or open `/owner`, and that sign-up cannot create an owner; Playwright desktop: owner signs in and the numbers match the seeded paid orders.
  - Deps: T12, T6. Skills: `security-and-hardening`, `frontend-ui-engineering`, `test-driven-development`.
- [x] **T29c Owner: partner agencies and admin accounts** (M) — done 2026-11-05: `/owner/agencies` lists, adds, suspends and reactivates partners (a suspended partner gets no booking and its windows vanish; its jobs stay); `/owner/admins` creates and removes admins through server actions that check the owner role before the secret key is used; `tests/integration/owner.test.ts`, `tests/back-office-actions.test.ts`
  - Accept: the owner lists partner agencies with their performance, adds one, and suspends or reactivates one (a status column on `agencies`); `book_slot` and `free_slots` skip suspended agencies, and an area served only by suspended agencies shows the existing empty state; the owner lists, creates and removes admin accounts through a server action with `authorize(["owner"])`, the Supabase secret key used on the server only, the role marked in `app_metadata` and never read from sign-up metadata (the seed's rules); removing an admin takes the role away.
  - Verify: integration tests that a suspended agency receives no booking and its windows vanish, that the routing race tests still pass, and that only the owner can create or remove admins (each other role is refused); Playwright desktop; the no-agency-wording test stays green (owner pages are not customer pages).
  - Deps: T29b, T9. Skills: `security-and-hardening`, `doubt-driven-development` (privilege escalation, changing the routing), `frontend-ui-engineering`.

### Checkpoint 8b: Owner
- [ ] Owner flows work; no other role can reach owner pages or create admins; review.

## Phase 9: Reviews

- [x] **T30 Rating and review after completed job** (S) — done 2026-11-05: the customer rates a completed job once (service and Petugas HomeKlin, stars 1-5, comment up to 500 characters); `/services` cards show the average and the latest reviews with the cleaner's first name, never the customer or an agency; `tests/integration/reviews.test.ts`, e2e `reviews.mobile.spec.ts`
  - Accept: customer rates a completed job once, for the HomeKlin service and the cleaner ("Petugas HomeKlin"); shown on the service; never names a partner agency on customer pages; only the booking's customer can review.
  - Verify: Playwright; RLS test.
  - Deps: T12.

## Phase 10: Real live stream (LiveKit)

- [x] **T31 LiveKit token endpoint and rooms** (S) — done 2026-11-04 without real keys: `GET /api/streams/<order id>/token` signs a 10-minute LiveKit token (HS256 with node:crypto, no new dependency) for room `job-<order id>`; publishing only for the job's cleaner during the job (`can_publish_stream()`), watching for whom `stream_for_viewer()` allows; 503 `not_configured` until `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` are set; matrix in `tests/livekit-token.test.ts` and `tests/integration/streams.test.ts`
  - Accept: server-issued, short-lived tokens scoped to one room per job; same access matrix as T23/T29/T25; no token for unauthorized users.
  - Verify: Vitest matrix.
  - Deps: T23, T29, T25, human LiveKit keys. Skills: `source-driven-development`, `security-and-hardening`.
- [x] **T32 LiveKit source: publish, view, resilience** (M) — CLOSED WITHOUT BUILDING, 2026-11-05 (user decision): no real stream is built (user decision, 2026-11-05: the demo plays pre-recorded clips; documented in docs/adr/0002). What exists stays: the stream source seam with the demo clip source, and the server side of T31 (LiveKit tokens, the publish rule), which is unused. Nothing here was tested against real LiveKit
  - Accept: cleaner's phone browser publishes; customer/agency/admin view; adaptive bitrate on; stream recovers after a connection drop; status indicator reflects real state; demo source still selectable.
  - Verify: two-device manual test with throttled network.
  - Deps: T31. Skills: `debugging-and-error-recovery`.
- [x] **T33 Measure latency and recovery** (XS) — CLOSED WITHOUT BUILDING, 2026-11-05 (user decision): there is no real stream to measure, so the 3-second latency and recovery targets are a documented gap (`docs/qa/quality-plan-traceability.md`, ADR 0002)
  - Accept: end-to-end latency <= 3 s measured and recorded in `docs/`; recovery time recorded.
  - Verify: documented measurements.
  - Deps: T32.

### Checkpoint 9: Streaming
- [x] Real stream meets targets or the gap is documented honestly. — the gap is documented: no real stream (user decision, 2026-11-05)

## Phase 11: Hardening, evidence, ship

- [x] **T34 Security and RLS audit** (M) — done 2026-11-05: read-only audit (0 critical, 1 high, 3 medium, 2 low, 5 info), report and fixes in `docs/qa/security-audit-2026-11-05.md`; fixed H1 (account takeover by pre-registering an email), M1 (frame and sniffing headers), M2 (unpaid orders hold places: released after 2 hours, at most 3 per customer), L1, L2 and the six missing refusal tests. **M3 is an accepted risk** under the user's Checkpoint 1 decision (rate limits stay at their defaults: a demo with fewer than 5 users; a per-address limit would also block UAT testers who share one network); a CAPTCHA is the fix if abuse is seen
  - Accept: every table has RLS; cross-role and cross-tenant tests pass; no secrets in repo; findings fixed or logged.
  - Verify: test suite plus `security-auditor` agent review.
  - Deps: all features. Skills: `security-and-hardening`.
- [ ] **T35 Compatibility, accessibility, usability trial** (M) — needs real devices and three people; accessibility checks are best run after the design revamp; the device matrix and usability sheets are in `docs/qa/manual-test-sheets.md`. 2026-11-26: the review of the merged UX PR found one accessibility defect (the "Buka" link's name lacked its visible word, WCAG 2.5.3), now fixed. An automated axe scan of 76 page runs (all roles, both languages) found only an accepted decorative-numeral contrast flag: `docs/qa/accessibility-scan-2026-11-26.md`. The people and device parts are still the user's
  - Accept: main flows pass on Chrome Android, Safari iOS 16+, desktop Chrome/Edge/Firefox; 3 people book a service unaided; accessibility fixes done.
  - Verify: device matrix recorded in `docs/`.
  - Deps: all UI. Skills: `browser-testing-with-devtools`, `frontend-ui-engineering`.
- [x] **T36 Mobile performance pass** (S) — done 2026-11-26 (after the redesign, as agreed): audit in `docs/qa/webperf-2026-11-26.md` (Pixel 9, Slow 4G, 4x CPU, cold cache; landing LCP 2.40 s, CLS 0; `/services` 1.7-2.0 s; `/login` 1.3 s: all within LCP <= 2.5 s and CLS <= 0.1). The two High findings are fixed (retired Bricolage/Figtree fonts no longer preloaded: 7 font preloads became 3; the Supabase Realtime client is imported only when a chat opens). Logged, not fixed: request-time data chains and function region (medium, needs the deployed stack to measure), uploaded photos served full size (medium; needs `images.remotePatterns`, the user's decision), ratings layout shift (data dependent), and four low items. Only lab numbers: no Lighthouse (not installed, no new dependency) and no field data
  - Accept: key customer pages load acceptably on a mobile connection; findings fixed.
  - Verify: `/agent-skills:webperf` audit report.
  - Deps: T35. Skills: `performance-optimization`.
- [x] **T37 Quality Plan e2e suite and evidence** (M) — done 2026-11-05: `docs/qa/quality-plan-traceability.md` (every Quality Plan target against its tests, with the gaps stated), `docs/qa/test-results-2026-11-05.md` (707 unit and integration tests, 371 browser tests), `docs/qa/defect-log.md` (0 open critical), and the availability record: `.github/workflows/uptime.yml` checks the live health address every 10 minutes and `npm run uptime` reports the percentage (`docs/qa/uptime.md`; its first scheduled runs are pending). The device trial is T35; `docs/qa/manual-test-sheets.md` holds the sheets
  - Accept: one Playwright spec per Quality Plan scenario passes; results saved in `docs/`; defect log shows 0 critical; uptime report started.
  - Verify: `npm run test:e2e` output archived.
  - Deps: T34-T36.
- [x] **T38 Documentation and handover** (M) — done 2026-11-05; a fresh clone installs, typechecks, lints and passes 531 tests with no secrets set (checked): README rewritten (setup, settings, commands, hand-over), ADRs 0001-0006 in `docs/adr/`, `docs/frontend-map.md`; `docs/demo-checklist.md` is T39's
  - Accept: README (setup, env vars, commands); ADRs for website-vs-Android, demo clips, and "encrypted in transit, not end-to-end"; handover list per Contract (source, docs, config, access).
  - Verify: a fresh clone can run from the README.
  - Deps: T37. Skills: `documentation-and-adrs`, `code-simplification`.
- [ ] **T39 Pre-demo ship checklist** (S) — prepared 2026-11-05: `docs/demo-checklist.md` (checklist, 15-minute script, rollback). Done: Supabase awake (live health answers 200), the live database migrated and seeded (2026-11-05, with the user's permission), demo script, rollback plan. Left, for the day: the demo video in `clips/` and a live seed again (the demo job starts 10 minutes after the seed), `CRON_SECRET` in Vercel, the site opened on a phone, then `/agent-skills:ship`
  - Accept: Supabase project awake; seed data fresh; clips present; URL works on a phone; demo script written; rollback plan noted.
  - Verify: `/agent-skills:ship` checklist complete.
  - Deps: T38. Skills: `shipping-and-launch`.

### Checkpoint: Complete
- [ ] All acceptance criteria met; 0 critical defects; hand over to the client group for UAT.

## Phase 12: Agency fees, payouts and summaries (backend)

> Backend only. UI for agency "Ringkasan" and owner "Pembayaran per agensi" is ported from the design separately.
> PAYOUT_PERCENT_DEFAULT = 70. Rounding: round(price_idr * percent / 100.0) half-up.

- [x] **T40 Migration: agency fees schema and DB functions** (L) — `supabase/migrations/20261111090000_agency_fees.sql`
  - Accept: `payout_percent` added to `agencies` (default 70, check 0-100); `payouts` and `order_fees` tables created with RLS (agency reads own, owner reads all, no client writes); `check_out` updated to insert `order_fees` row idempotently; `generate_payouts`, `mark_payout_paid`, five INVOKER summary functions and `owner_payouts_overview` created; migration applies cleanly on fresh and existing DB.
  - Verify: `supabase db reset` with no errors; `npm run check`.
  - Deps: T39.

### Checkpoint: Migration done
- [x] Migration applies on `supabase db reset`; `npm run check` passes. — 2026-11-11

- [x] **T41 Server lib: `src/lib/payouts/`** (M) — Zod schemas, readers (SSR client), actions (`markPayoutPaid`, `generatePayouts`)
  - Accept: `schemas.ts` with Zod types for all function returns; `readers.ts` calling DB functions via `createSupabaseServerClient`; `actions.ts` with `markPayoutPaid` and `generatePayouts` returning `{ ok?: true; formError?: string } | null`; `index.ts` re-exporting; no service key; no cache on financial data.
  - Verify: `npm run check`.
  - Deps: T40.

- [x] **T42 Seed: 90 days of historical data** (M) — idempotent additions to `scripts/seed-data.mjs`
  - Accept: both agencies have `payout_percent = 70`; ~90 days of completed orders with `order_fees` rows across services, areas and cleaners; weekly payouts weeks 1-11 `paid`, week 12 `pending`; unassigned fees so "Menunggu dibayarkan" is non-zero; re-run produces no duplicates.
  - Verify: run seed twice; check payout and fee counts are identical.
  - Deps: T40.

- [x] **T43 Cron route and vercel.json** (S) — `src/app/api/cron/payouts/route.ts` + `vercel.json`
  - Accept: route mirrors `cron/recordings` auth (CRON_SECRET, `timingSafeEqual`, 503/401/200); computes last Sunday and calls `generate_payouts`; `vercel.json` has `{ "path": "/api/cron/payouts", "schedule": "0 0 * * 1" }`.
  - Verify: `npm run check`; request with wrong secret returns 401.
  - Deps: T40.

### Checkpoint: Phase 2 done
- [x] `npm run check` passes; seed runs idempotently twice; cron route type-checks. — 2026-11-11

- [x] **T44 Tests** (M) — unit + integration tests for the fee/payout layer
  - Accept: unit tests cover fee formula, rounding, idempotency; integration tests cover RLS isolation (agency A cannot read agency B), role gates (`mark_payout_paid` owner only), `p_days` validation, `generate_payouts` idempotency, customer order row leaks no fee; `tests/protected-pages.test.ts` updated if needed; no skipped tests; if `TEST_SUPABASE_*` keys absent, states so and does not skip.
  - Verify: `npm run check`; integration tests pass.
  - Deps: T41, T42, T43.
  - Fix 2026-11-14: agencies could not read their own fees (permission denied); select granted on `order_fees`/`payouts` under the existing RLS, the four agency fee functions made security definer for the caller's agency, daily fees by Jakarta date (`20261114160000_agency_fee_reads.sql`, `tests/integration/agency-fee-reads.test.ts`).

### Checkpoint 10: Agency fees backend complete
- [x] `npm run check` passes (0 TS errors, 0 lint errors, 756/756 tests pass); migrations applied to test project; done checklist listed in Progress.md. — 2026-11-11

## Phase 13: Back-office redesign, admin first (planned 2026-11-12)

> Ports the redesign (markdown/design.md) to the admin group only, through the scoped `theme-forest` class (no rename codemod). Customer, cleaner, agency and owner pages stay on T3b. First screen: "Layanan dan harga" from the user's mock (screenshots; the reference HTML is not in the repo). No schema change. Built by `homeklin-frontend`, one task at a time; reviewed by `code-reviewer` at Checkpoint B.
> Decisions (user, 2026-11-12): the row's on/off switch is removed (option a): `service-switch.tsx`, `setServiceActive` and their unit tests go, and the e2e switch steps are rewritten to use the panel checkbox. Card radius `lg` (design.md tables). The create panel keeps the ID field and both panels keep Urutan. Admin menu items keep their current names except "Layanan dan harga".

- [x] **R1 Admin theme scope** (S) — done 2026-11-12 (`src/app/fonts-forest.ts`, e2e `admin-theme.desktop.spec.ts`; 756 unit, 381 e2e pass): shared font file for Inter, Inter Tight and Instrument Serif (landing imports it, unchanged look); `(admin)` layout wrapped in `theme-forest` + fonts; warning, danger and info redesign values added to `.theme-forest`
  - Accept: admin pages use Inter on cream; agency, owner, customer and landing render as before.
  - Verify: `npm run check`; `npm run test:e2e`; e2e asserts admin font is Inter and agency is not.
  - Skills: `frontend-ui-engineering`, `source-driven-development` (next/font).
- [x] **R2 Forest sidebar for admin** (M) — done 2026-11-12 (`tone="forest"` prop; e2e `admin-shell.desktop/mobile.spec.ts`; screenshots `docs/screenshots/r2/`; 756 unit, 383 e2e pass): `tone="forest"` on `SidebarShell`, `SideNavList`, `BackOfficeTopBar`, `AccountSummary`; 256 px band, lime logo tile, role card "Dasbor admin / Operasional HomeKlin", 44 px items, active on band-raised with lime text and 3 px lime marker, ID/EN on-dark switch and user with "Keluar" at the bottom; dark top bar and menu below 1024 px
  - Accept: matches the mock at 1440 px; agency and owner shells unchanged; focus ring lime on the band.
  - Verify: `npm run check`; `npm run test:e2e`; screenshots of admin, agency, owner.

- [x] **R2b Admin menu as in the mock** (S) — done 2026-11-12 (dashboard retired, `/admin` redirects to the monitor, admin home after sign-in is `/admin/monitor`; 752 unit, 376/377 e2e with one reviews timeout that passed on rerun): five items in this order: Pemantauan langsung (`/admin/monitor`, video icon), Layanan dan harga (`/admin/services`, grid icon), Obrolan bantuan (`/admin/tickets`, chat icon), Pertanyaan umum (`/admin/faq`, help-circle icon), Rekaman (`/admin/recordings`, history icon); English "Live monitoring", "Services and prices", "Support chats", "FAQ", "Recordings". Dasbor goes (user, 2026-11-12): `/admin` redirects to `/admin/monitor`; the logo links there; dashboard-only components are removed, shared ones (`jobs-table`, used by agency) stay; its e2e and unit tests are rewritten for the new start page, not dropped
  - Accept: the menu matches the mock; `/admin` and `/en/admin` land on the live page; `tests/protected-pages.test.ts` still passes.
  - Verify: `npm run check`; `npm run test:e2e`.

### Checkpoint A: admin shell
- [ ] Check and e2e pass; screenshots show only admin changed; user review.

- [x] **R3 Services list** (M) — done 2026-11-12 (`services-list.tsx`, `admin-duration.ts`; row switch no longer rendered; 759 unit, 384 e2e pass; screenshots `docs/screenshots/r3/`): one white `lg` card of `<details>` rows replacing `services-table`; header with h1 "Layanan dan harga", subtitle and the "Tambah layanan" pill (lime plus circle); sunken column header; 68 px rows (photo or type icon, name with "Jenis: ...", "Sekitar N jam", price via `formatRupiah`, Aktif/Draf chip with icon, order, 44 px chevron, hidden "Ubah layanan <name>"); stacked row below 768 px; chevron rotation off under reduced motion
  - Accept: keyboard opens a row with a visible focus ring; no sideways scroll at 360 px in both languages.
  - Verify: unit test for the duration label; e2e for the list.
- [x] **R4 Edit in place** (M) — done 2026-11-12 (`service-panel.tsx`; 759 unit, 391 e2e pass; screenshots `docs/screenshots/r4/`): `ServiceForm` panel layout inside each row, still `updateService`, same `name=` attributes, hidden fields, `useActionState`, `formError` and `updateTag`; bilingual name and description; "Batal" closes the panel
  - Accept: save shows the notice; validation errors keep the panel open with messages per field.
  - Verify: `npm run check`; `npm run test:e2e`.
- [x] **R5 Add in place** (S) — done 2026-11-12 (opening via the link works without JavaScript; the list itself streams in, so saving needs JavaScript, as on the old pages): "Tambah layanan" links to `/admin/services?new`, which renders an open, empty create panel at the top of the list (`createService`)
  - Accept: works without JavaScript; created service starts as Draf.
  - Verify: e2e.
- [x] **R6 Retire /admin/services/new and /edit** (S) — done 2026-11-12 (old addresses redirect behind the admin check: new to `?new`, edit to the list; switch and 7 unit tests for it removed; 752 unit, 386/387 e2e with one sign-in flake that passed alone): delete both routes, the row switch (`service-switch.tsx`, `setServiceActive`, their unit tests) and unused messages; rewrite `admin-services.desktop.spec.ts`, `admin-to-catalog.desktop.spec.ts`, `no-horizontal-scroll.mobile.spec.ts`, `t7b.screenshots.ts`; update `docs/frontend-map.md`
  - Accept: nothing links to the old routes; no spec removed, only rewritten.
  - Verify: `npm run check`; `npm run test:e2e`.
- [x] **R7 Polish and proof** (S) — done 2026-11-12: code review 0 critical, 1 high (H1, check-in status, for the user), 3 medium and 7 low fixed (stale panel after save, focus to the notice, useId field ids, no-JS and redirect tests, pill placeholder, lang on the card, duplicate-code test, getService removed); 749 unit pass; e2e 385 of 387 (one load flake; recordings test broken by leftover test data): screenshots at 360, 390, 1280, 1440 px in both languages under `docs/screenshots/r-admin-services/`; `impeccable` check against the mock; `code-review-and-quality`
  - Verify: review findings fixed or logged.

### Checkpoint B: admin services screen
- [ ] Everything passes; matches the mock at 1440 and 360 px; user review.

- [x] **O1 Order number** — done 2026-11-12 on the test project (756 tests pass; live not migrated yet, waiting for the user's permission) (S, backend; user request 2026-11-12, overrides "no schema change" for this one column): migration `20261112090000_order_codes.sql`: `orders.code` "HK-1001", "HK-1002", ... from one sequence (race-safe), `unique` and format check, existing orders numbered oldest first, a trigger refuses any change; `live_streams()` returns it; `LiveStream.orderCode`
  - Accept: every order has a unique code; concurrent orders get different codes; a change is refused even with the secret key.
  - Verify: `tests/integration/order-codes.test.ts`; `npm run check`; migrated on test (live needs the user's permission).
- [x] **M1 Pemantauan langsung screen** (M): port `/admin/monitor` to the user's mock `Admin-Live` (2026-11-12): h1 "Pemantauan langsung" (no "Contoh", real data) and a summary line "N pekerjaan sedang berlangsung. M terkendala." (terkendala = weak or disconnected); grid `repeat(auto-fill, minmax(300px, 1fr))`, 20 px gap; white `lg` card, 12 px padding; 16:9 video frame `md` radius (empty frame on a pale green fill with a 44 px white icon circle); status chip (live dot + "Sedang berlangsung" on success-surface, wifi icon + "Sinyal lemah" on warning-surface, wifi-off + "Terputus" on danger-surface; a disconnected frame on sunken with "Siaran terputus"); on the right of the chip the order number "HK-1042" from O1 (user, 2026-11-12); cleaner name (600), "service, area" (13 px muted), agency name (12 px muted); "Buka" (underlined, 44 px) puts that card's video into full screen (user, 2026-11-12). Keep FeedStatus, FeedVideo and the server-signed video links as they are
  - H1 (user, 2026-11-12): today's jobs (Jakarta date) that have a cleaner but no check-in yet are cards in the same grid with the status "Belum check-in" (no separate section, no video, no "Buka"): the frame on sunken with a clock icon and the start time. They come from `admin_jobs()`, which now also returns the order number (migration `20261112100000_admin_jobs_code.sql`). They do not count as "sedang berlangsung" or "terkendala"; the summary line names them as well. Covers the SPEC line "Admin and agency can see check-in status".
  - Accept: matches the mock at 1440 px; one column at 360 px with no sideways scroll; status never colour alone.
  - Verify: `npm run check`; `npm run test:e2e`; screenshots.
- [x] **M2 Live filters** (S) — done 2026-11-14 in D1: segmented toggle "Semua / Terkendala" and the "Area layanan" select (all areas plus each area), as query parameters so they work without JavaScript
  - Accept: filters combine; the summary line counts what is shown; empty result has a plain message.
  - Verify: e2e.

### Checkpoint C: admin live screen
- [ ] Everything passes; matches the mock at 1440 and 360 px; user review.

## Phase 14: Whole-app redesign from the Claude Design canvas (planned 2026-11-14)

> User request 2026-11-14: build every screen of the canvas "HomeKlin App Screens" (52 mocks; local copies in the git-ignored `mocks/` folder, `mocks/canvas.json` lists each screen's title and role). Order (user): admin first, then partner agency, owner, cleaner, customer and landing. One pass, the user reviews at the end (Checkpoint D), not per group. Rules: UI only on the existing backend; where a mock shows data or a feature the app does not have, build what exists and log the gap in `docs/redesign-gaps.md` for the user (no new schema or dependency without the user). Earlier decisions stand over the mock (in-place add and edit of services, "Buka" opens full screen, admin menu keeps "Rekaman"). Built by `homeklin-frontend`, committed by the lead after each group.

- [x] **D1 Admin group** — done 2026-11-14 (a444c84): filters, order page `/admin/orders/HK-xxxx`, support chats, FAQ editor, service panel, recordings; gaps in `docs/redesign-gaps.md`: M2 above, then order detail (`Admin-Order`, `Admin-Order-Issue`), support chats (`Admin-Support`), FAQ (`Admin-Faq`), service panel fields against `Admin-ServiceNew`
- [x] **D2 Partner agency group** — done 2026-11-14 (5d2d2c0, merged eca73bc): summary, incoming jobs, order detail, completed orders, cleaners, videos, services (read-only); gaps in `docs/redesign-gaps.md` (Partner agency); found T44 defect (agencies cannot read `order_fees`), fix queued for the backend agent: forest shell for agency, then `Partner-Summary`, `Partner-Services`, `Partner-Jobs`, `Partner-Job`, `Partner-Job-Done`, `Partner-Cleaners`, `Partner-Videos`, `Partner-Past`
- [x] **D3 Owner group** — done 2026-11-14 (f24a006): overview with periods and growth, partners with 30-day columns and add page, admin accounts with last sign-in, create and remove; gaps in `docs/redesign-gaps.md`: forest shell for owner, then `Owner-Overview`, `Owner-Partners`, `Owner-PartnerNew`, `Owner-Admins`, `Owner-AdminNew`
- [x] **D4 Cleaner group** (phone) — done 2026-11-15 (b3165bf): home with profile and numbers, `/cleaner/jobs`, one page per job `/cleaner/jobs/HK-xxxx` with note and check-in/stream/check-out, account; cleaner chat and Riwayat are gaps: `Cleaner-Home`, `Cleaner-Jobs`, `Cleaner-Job`, `Cleaner-Live`, `Cleaner-Account`, `Cleaner-Chat`
- [x] **D5 Customer group** (desktop and phone pairs) — done 2026-11-15 (5a b7bceac, 5b ae7f748): three-step booking, confirmation, order page, Pesanan Anda, live, recordings, help and guest chat, `/o/<token>`, emails, landing, account: `Landing`, `Customer-Home`, `Main` (services and time), `Customer-Booking`, `Customer-Payment`, `Customer-Confirmed`, `Customer-Orders`, `Customer-Live`, `Customer-Support`, `Customer-Chat`, `Customer-Replay`, and the two emails (`Customer-Email-Order`, `Customer-Email-Replay`)
  - Accept (every group): matches the mock at its frame width; desktop pages one column at 360 px with no sideways scroll; both languages; status never colour alone; customer pages never name an agency.
  - Verify (every group): `npm run check`; `npm run test:e2e`; screenshots under `docs/screenshots/d<n>/`.

### Checkpoint D: redesign review
- [ ] Everything passes; the user reviews all groups and `docs/redesign-gaps.md`.

## Phase 15: Backend for the redesign (approved 2026-11-14)

> User decision 2026-11-14: build tier 1 and tier 2 first, then from tier 3: B12 (services per agency), B13 for customers only (support chat without an account; no cleaner chat), and from B14 only the order page opened from the email link without signing in (B14a). The rest of B14 stays a documented gap.

> From comparing every mock with the backend (`markdown/tasks/plan.md`, Phase 15). Each task: a migration on the test project with integration tests first; live only with the user's permission; the matching screen updated after. Tier 3 is a scope decision per item.

**Tier 1: read functions and small columns (no new behaviour)**
- [x] **B1 Order number everywhere** (S): `my_orders`, `my_jobs`, `agency_jobs` return `orders.code`. Screens: customer home/orders/replay, cleaner jobs, partner jobs/past/videos.
  - Accept: each returns the same code as `admin_jobs`; nobody gains a column they could not read before. Verify: integration tests.
  - Done 2026-11-14: `order_code` on the three functions, `orderCode` on the readers (`20261114100000_order_code_everywhere.sql`, `tests/integration/order-codes.test.ts`).
- [x] **B2 Admin order detail** (M): `admin_order_detail(order)` (admin only): service, window, area, address, customer name and phone, cleaner and agency, price, agency fee and HomeKlin income (from `order_fees`, else price × `payout_percent`), status times (created, paid, checked in, completed), stream status and its last change. Screens: Admin-Order, Admin-Order-Issue.
  - Accept: non-admins get `not_admin`; the split adds up to the price. Verify: integration tests.
  - Done 2026-11-14: `admin_order_detail(p_order uuid)`, any order status, reader `getAdminOrderDetail` in `src/lib/jobs/admin-order.ts` (null for an unknown order) (`20261114130000_admin_order_detail.sql`, `tests/integration/admin-order-detail.test.ts`). The note is added in B7.
- [x] **B3 Assigned time** (S): `orders.assigned_at`, set by `assign_cleaner`; returned by B2, `agency_jobs`. Screens: the "Ditugaskan" step in every timeline.
  - Done 2026-11-14: `assigned_at` on `agency_jobs` and `my_orders` (`assignedAt` on the readers), null on orders assigned before (`20261114110000_assigned_time.sql`, `tests/integration/assigned-time.test.ts`).
- [x] **B4 Agency fee before completion** (S): `agency_jobs` returns the expected fee (price × the agency's percent) until `order_fees` holds the real one. Screens: Partner-Jobs, Partner-Job.
  - Done 2026-11-14: `agency_jobs` adds `agency_fee_idr` and `agency_fee_final` (`agencyFeeIdr`, `agencyFeeFinal` on `AgencyJob`) (`20261114120000_agency_fee_expected.sql`, `tests/integration/agency-fee-expected.test.ts`).
- [x] **B5 Periods and growth** (M): `owner_numbers(p_days)` and `agency_summary(p_days)` also return the previous period's total; owner gets payouts per agency for the period; `owner_agencies` adds completed, on-time share (check-in by start time), cancelled and paid out for the last 30 days; `owner_admins` adds last sign-in. Screens: Owner-Overview, Owner-Partners, Owner-Admins, Partner-Summary.
  - Accept: 7, 30 and 90 only; customers' data never in owner numbers. Verify: integration tests.
  - Done 2026-11-14: `owner_numbers(p_days)` (default 30) adds `days`, `period`, `previous`, `daily`, `payouts_by_agency`; `agency_summary` adds `previous_total_fee_idr` and is security definer; `owner_agencies` adds `completed_30d`, `on_time_percent`, `cancelled_30d`, `paid_out_30d_idr`; `owner_admins` adds `last_sign_in_at` (`20261114200000_owner_periods.sql`, `tests/integration/owner-periods.test.ts`).
- [x] **B6 Cleaner stats** (S): `my_job_stats()`: hours this week, jobs today, completed this month. Screen: Cleaner-Home.
  - Done 2026-11-14: `my_job_stats()` returns `active_hours_week` (check-in to check-out since Monday, Jakarta time; in progress counts to now), `jobs_today`, `completed_month`; reader `getMyJobStats` (`20261114170000_cleaner_stats.sql`, `tests/integration/cleaner-stats.test.ts`).

**Tier 2: small new behaviour**
- [x] **B7 Customer note** (M): `orders.customer_note` (0-300), a new `book_slot` argument (race tests unchanged), returned to the customer, the assigned cleaner, the agency and admin. Screens: Customer-Booking, Customer-Orders, Cleaner-Job, Partner-Job, Admin-Order.
  - Done 2026-11-14: `orders.customer_note`, `book_slot(..., p_note text default '')` (refusal `note_invalid`), form field `note` parsed in `src/lib/validation/booking.ts` (`noteTooLong`) and passed by the booking actions; `customer_note` on `my_orders`, `my_jobs`, `agency_jobs`, `admin_order_detail` (`customerNote` on the readers) (`20261114140000_customer_note.sql`, `tests/integration/customer-note.test.ts`, `tests/booking-actions.test.ts`). The form field itself is the frontend's.
- [x] **B8 Payment method** (S): store Midtrans `payment_type` from the checked notification; show it on the confirmation and the order. Optional: pass the chosen method as `enabled_payments` to Snap (no schema). Screens: Customer-Payment, Customer-Confirmed, Customer-Orders.
  - Done 2026-11-14: `orders.payment_type` from the signed notification (`apply_payment_result(..., p_payment_type text default null)`, kept only when paid), `payment_type` on `my_orders` and `admin_order_detail` (`paymentMethod` on the readers). `enabled_payments` (optional) not done (`20261114190000_payment_method.sql`, `tests/integration/payment-method.test.ts`).
- [x] **B9 Emails** (M): "recording ready" email after check-out (Customer-Email-Replay); the cleaner's name and photo emailed when the agency assigns one (Customer-Email-Order shows them at payment, but no cleaner is known then); "Kirim ulang email" for the order's own customer, at most once per few minutes. Tests never send real email.
  - Done 2026-11-14: cleaner name and photo emailed after `assignCleaner`, "recording ready" after `checkOut` (once the recording is attached), `resendOrderEmail` action (customer's own order, once per 5 minutes); facts from `order_email_facts` (secret key only); emails in Indonesian unless resent from the English page (`20261114210000_order_emails.sql`, `src/lib/email/order-emails.ts`, `order-templates.ts`, `tests/order-emails.test.ts`, `tests/integration/order-emails.test.ts`).
- [x] **B10 Service photo and types** (M): `services.photo_url` with an admin-only upload bucket (Admin-ServiceNew "Tambah foto"); decide whether the four types in the mock replace the three categories (enum change) or are only labels.
  - Done 2026-11-14 (photo): `services.photo_url` (site image or a file in the public `service-photos` bucket on a Supabase project host), admin-only storage policies, upload/replace/remove in `createService`/`updateService` (form fields `photo`, `removePhoto`), card fallback to the app's photos (`20261114300000_service_photos.sql`, `20261114310000_service_photo_host.sql`, `tests/integration/service-photos.test.ts`). Types: enum unchanged; the mapping of the mock's four types is for the user to decide.
- [x] **B11 Full windows and cleaner details** (S): `free_slots` can also return full windows ("15.00, penuh", Main); `cleaners.phone` and area for Cleaner-Account, Cleaner-Home, Partner-Cleaners.
  - Done 2026-11-14: new `slot_windows(area, from, to)` with `is_full` (`listSlotWindows`), `free_slots` unchanged; `cleaners.phone`, `cleaners.area_id` (an area of the agency), `set_cleaner_details` (action `updateCleanerDetails`), `my_cleaner_profile` (`getMyCleanerProfile`), `agency_cleaners` adds `phone`, `area_id` (`20261114150000_full_windows_cleaner_details.sql`, `tests/integration/cleaner-details.test.ts`).

**Tier 3: new features (the user decides each)**
- [x] **B12 Services per agency** (L): `agency_services`; Partner-Services saves the choice; `free_slots` and `book_slot` route only to agencies offering the service.
  - Done 2026-11-14: `agency_services` + `agencies.services_restricted` (an agency that never chose offers every service); `set_agency_services` (action `saveAgencyServices`), `agency_service_choices` (`listAgencyServiceChoices`); `book_slot` routes only to agencies offering the service (race tests unchanged); `free_slots`/`slot_windows` take optional `p_service` (`serviceId` option); `search_services` by area follows the choice (`20261114230000_agency_services.sql`, `tests/integration/agency-services.test.ts`).
- [x] **B13 Chat for cleaners and guests** (L): tickets opened by cleaners (Cleaner-Chat), and by visitors without an account (Customer-Support says "tidak perlu masuk akun"; needs abuse limits, see M3); read receipts ("Terbaca") need a read time per side.
  - Done 2026-11-14 (customers only, no cleaner chat): guest chats with a random token in an httpOnly cookie (only its SHA-256 stored), guest functions for the secret key only, limits 5 new chats per address per hour and 20 messages per chat per 10 minutes; read times `customer_read_at`/`admin_read_at` with `mark_ticket_read`; actions in `src/lib/support/guest-actions.ts`, reader `getGuestTicket` (`20261114180000_guest_support.sql`, `tests/integration/guest-support.test.ts`, `tests/support-guest-actions.test.ts`).
- [x] **B14a Order page from the email link** (M): a private per-order link in the emails opens that order's page without signing in (Customer-Email-Order, Customer-Email-Replay); the link shows only that order, can be revoked, and never opens other orders or the account.
  - Done 2026-11-14 (backend): links `/o/<token>` (256-bit token, only its SHA-256 stored, 30 days) in the B9 emails; `getOrderByLink(token)` reads the order without address, phone or email; customer action `revokeOrderLinks`; link functions for the secret key only (`20261114220000_order_links.sql`, `src/lib/orders/order-link.ts`, `tests/order-links.test.ts`, `tests/integration/order-links.test.ts`). The `/o/[token]` page itself is the frontend's; the confirmation email still links the signed-in orders page.
- [ ] **B14 Other mock features, not approved (gap)** (each M-L): availability per cleaner and cleaner status (Partner-Cleaners); order page from the email link without signing in (Customer-Email-Order); partner "waiting for approval" with an invitation email, PIC name and WhatsApp (Owner-PartnerNew); temporary admin password changed at first sign-in (Owner-AdminNew); recurring bookings (Customer-Booking "Berulang").

### Checkpoint E: backend for the redesign
- [ ] Approved tiers built; all integration tests pass; migrated on test; live migration with the user's permission.

## Phase 16: Payment on our own page (2026-11-16, user request)

- [x] **P1 Pay on HomeKlin's page with a chosen method** (L): the payment step offers QRIS, a bank's virtual account (BCA, Mandiri, BNI, BRI) and a card (Customer-Payment mock); the server charges the choice with Midtrans' Core API (Sandbox) instead of sending the customer to Snap. Done 2026-11-16: migration `20261116090000_payment_on_our_page.sql` (`payment_attempt`, `payment_details`, `begin_payment_attempt`, `attach_payment_details`, `order_payment_state`, `apply_payment_result` with the attempt: a cancel or failure of an older attempt changes nothing, money for any attempt counts); `src/lib/payment/midtrans.ts` (Core API charge and cancel; Midtrans id `<order>_<attempt>`, plain id for old Snap payments), `methods.ts`, `actions.ts` (`payOrder`, `changePaymentMethod`), the webhook reads the attempt; UI `payment-checkout.tsx`, `payment-methods.tsx`, `payment-waiting.tsx` (QR code, account number with copy, polling, "Ganti cara bayar"), `card-input.ts`, `midtrans-card.ts` (card token and 3-D Secure in the browser; the number never reaches the server). The order page links to step 3 instead of its own button. Tests: unit, integration (`payment-attempts`), e2e `payment.mobile.spec.ts`; screenshots `docs/screenshots/pay/`.
  - Needs from the user: `MIDTRANS_CLIENT_KEY` in Vercel and as a GitHub secret (cards are left out of the page without it); `npm run supabase -- migrate live` before the code goes live.

## Phase 17: Sign-up with email confirmation (user decision 2026-11-27)

- [ ] **S1 Sign-up confirms the email with a code** (M) — in progress 2026-11-27: `/signup` asks for the 6-digit code after the form (`confirmSignUp`, no password replacement), then Supabase email confirmation is switched on for the live project (`npm run supabase -- ...`, user approved); the test project keeps it off
  - Accept: a new customer cannot place an order or receive order emails before confirming the address; the code step works in both languages; existing sign-up e2e specs pass unchanged.
  - Verify: unit tests for the actions; `npm run check`; e2e; live sign-up checked once by the user.
