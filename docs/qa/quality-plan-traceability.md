# Quality Plan traceability (T37)

For the client group's QA/UAT: each target of the Development and Quality Plan ("Quality Goal" table),
the automated tests that check it, and what is left to check by hand. The software house ran these
tests before handing the product over (Contract Pasal 4, internal testing). Results of the latest run
are in `docs/qa/test-results-2026-11-05.md`.

How to rerun: `npm run check` (unit and integration, against the separate test project) and
`npm run test:e2e` (Playwright, phone and desktop viewports, builds the app first).

| Quality attribute (Plan) | Target | Automated evidence | By hand |
|---|---|---|---|
| Functional correctness: booking | 100% of critical features pass UAT | e2e `booking.mobile`, `order.mobile` (ordering with an emailed code, a window taken meanwhile, returning customer), `catalog.mobile/desktop`, `home`; integration `booking.test.ts` (routing, races, refusals, at most 3 unpaid orders) | UAT booking by the client group |
| Functional correctness: payment | successful, failed and cancelled each give the right status | e2e `payment.mobile`, `payment-notification.mobile` (each outcome through a signed notification), `orders.mobile` (each status on the order list); integration `payment.test.ts`, `payment-result.test.ts` (idempotent, out-of-order, place given back); unit `payment-webhook`, `payment-notification` | All three outcomes were run on the live URL through the real Midtrans Sandbox: successful 2026-11-01, failed and cancelled 2026-11-05 (`docs/qa/manual-test-sheets.md`) |
| Functional correctness: check-in/out | the cleaner checks in only in the window, with location; check-out completes the job | e2e `cleaner-jobs.mobile`, `job-status.desktop`; integration `jobs.test.ts`; unit `check-in.test.ts` | Check-in on a real phone with location on |
| Functional correctness: streaming | the job's customer watches the cleaner live | e2e `live-stream.mobile`; integration `streams.test.ts` | Demo source: pre-recorded clips (ADR 0002) |
| Functional correctness: FAQ and chat | FAQ search, escalation to chat | e2e `support.mobile`, `support-realtime.desktop` (two sessions, live replies both ways); integration `support.test.ts` (including Realtime) | |
| Functional correctness: admin monitoring | multi-feed grid, dashboard, replay | e2e `admin-console.desktop`; integration `streams.test.ts` (`live_streams`) | |
| Recording replay (SPEC priority 1) | the booking's customer replays for 7 days, then it is deleted | e2e `recording-replay.mobile`; integration `recordings.test.ts`, `recording-access.test.ts`, `retention.test.ts` (2-second retention: file deleted, entry refused) | |
| Streaming performance | end-to-end latency at most 3 s | none | **Gap, by decision:** no real stream is built (2026-11-05), so latency cannot be measured. The live view plays a pre-recorded clip (ADR 0002) |
| Streaming reliability | adaptive bitrate, recovery after a drop | the demo source shows the weak and disconnected states and reconnecting (`live-stream.mobile`) | **Gap, by decision:** no real stream, so adaptive bitrate and real recovery are not provided |
| Security and privacy | video only for authorized users; encrypted connections; role-based authorization | integration matrices per role: `recording-access.test.ts`, `streams.test.ts`, `jobs.test.ts`, `agency-back-office.test.ts`, `owner.test.ts`, `support.test.ts`, `account-claim.test.ts`; e2e refusals in every role's spec; `no-agency-wording.spec.ts`; unit `protected-pages.test.ts`, `security-headers.test.ts`; audit `docs/qa/security-audit-2026-11-05.md` | Encrypted in transit, not end-to-end (ADR 0003) |
| Availability | at least 99% during pilot/UAT | `health.spec.ts` (`/api/health`); the Uptime workflow checks the live address every 10 minutes and `npm run uptime` gives the percentage (`docs/qa/uptime.md`) | Optional: an UptimeRobot monitor as an outside second record |
| Usability | at least 90% of UAT participants book without help | e2e `order.mobile` (the whole flow on a phone); `no-horizontal-scroll.mobile` (360 px) | **Open:** trial with 3 people (T35, sheet in `docs/qa/manual-test-sheets.md`) |
| Compatibility | main functions pass on the named devices | Playwright mobile (Pixel-size Chromium) and desktop Chromium | **Open:** Chrome Android, Safari iOS 16+, desktop Edge and Firefox by hand (T35) |
| Defect quality | 0 critical or blocker defects at release | `docs/qa/defect-log.md` | |
| Customer support | 100% of FAQ to chat escalations reach the admin inbox | `support-realtime.desktop` (the ticket reaches the open inbox without a reload), `support.test.ts` (every ticket is in `admin_ticket_inbox`) | |
| Payment reliability | 100% of payment scenarios give the right status | see the payment row | |
