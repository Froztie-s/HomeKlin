# Spec: HomeKlin Web Platform

Status: **REVISED after first review, awaiting approval.** No code has been written.
Sources: `docx/HomeKlin Contract.docx`, `docx/HomeKlin Development and Quality Plan.docx`, `HomeKlin Interview Notes.md`.

## Assumptions (correct me before planning starts)

1. The product is a **hosted website**, not a native app. This departs from the Contract's wording ("Android mobile app"). The client has agreed to this; the addendum (Contract Pasal 8) should still be written down.
2. Customer and cleaner pages are **mobile-first**. Agency and admin pages are **desktop-first** (confirmed).
3. "Everything the Quality Plan tests" is the scope: booking, simulated payment, cleaner check-in/out, live streaming, FAQ with escalation to admin chat, admin monitoring. Ratings and reviews are lowest priority.
4. All infrastructure runs on **free tiers**. The deadline is the Contract end date, **9 Nov 2026**.
5. The UI is **bilingual: Indonesian (default) and English**, with a language switch. Code, commits and docs are in English.
6. There is no real money, no real agencies and no wearable camera. Data is seeded demo data. The cleaner's phone browser camera is the "body cam". Each cleaner on shift has exactly one camera and one live stream.
7. The client group assesses the product against the Quality Plan table, so those targets are the acceptance bar (see Success Criteria).
8. **Demo footage is pre-recorded short clips.** You will present the user-side UI/UX flow and explain that the clips stand in for a real live stream. The architecture is built so a real live stream can replace the clips (see Streaming).

## Objective

A website that acts as the middleman between **customers** who want cleaning services and **partner cleaning agencies** who provide the cleaners. **To the customer, HomeKlin is one cleaning company** with its own services and one price list; partner agencies are never shown or named on customer pages (decision of 2026-10-18). Customers choose a HomeKlin service and a free time slot in their area, book, and pay (simulated). HomeKlin routes each booking automatically to a partner agency in that area with the slot free, and the agency assigns one of its cleaners. Cleaners check in at the job and stream live video from their phone, so the customer feels safe. Customers can reach an admin through FAQ-to-chat escalation. Admins set the services and prices, monitor live sessions and handle support. Visitors arrive on a landing page at `/`; the customer app home is `/home`.

Success means the client group can open the public URL, run every critical scenario in the Quality Plan, and hit no blocker.

### Users and roles

| Role | Device | Does |
|---|---|---|
| visitor | phone or desktop | read the landing page at `/`, start booking with "Pesan sekarang" |
| customer | phone (mobile-first) | browse HomeKlin services and prices, pick a free slot in their area, book, pay, watch live stream, FAQ, chat, rate the service and cleaner. Sees HomeKlin only, never a partner agency |
| cleaner | phone (mobile-first) | see assigned jobs, check in/out, stream video. Shown to the customer as "Petugas HomeKlin" (name and photo) |
| agency (partner) | desktop-first | back office only: manage own cleaners and availability (schedule slots per area), assign own cleaners to jobs routed to the agency, watch own cleaners' video. Does not set customer prices |
| admin | desktop-first | manage HomeKlin's services and price list, monitor live feed, answer chat tickets, review incidents, manage FAQ |

## Capability map

| Module id | Responsibility | Depends on |
|---|---|---|
| foundation | project setup, auth, roles, RLS, seed data, CI, landing page | none |
| catalog | HomeKlin services and one price list (set by admin), service areas, partner agencies' coverage and availability per area, free slots aggregated per area, search/filter | foundation |
| order | booking flow, automatic race-safe routing to a partner agency with the slot free, simulated Midtrans payment, order status | catalog |
| checkin | cleaner job list, check-in/out with location | order |
| streaming | cleaner publishes video, customer/admin view, consent toggle | order, checkin |
| support | FAQ with search, escalation to admin chat, ticket inbox | foundation |
| admin-monitor | multi-feed live grid, recording replay, admin dashboard | streaming, support |
| reviews | rating and review after job (lowest priority) | order |

Build order: foundation, catalog, order, checkin, support, streaming, admin-monitor, reviews.

## Tech Stack

Versions are pinned in `package.json` at scaffold time (latest stable then). Do not guess versions in this spec.

| Concern | Choice |
|---|---|
| App | Next.js (App Router) + TypeScript, Tailwind CSS |
| Hosting | Vercel (free) |
| Database, auth, realtime chat, storage | Supabase (Postgres, Auth, Realtime, Storage); row-level security enforces roles |
| Live streaming | LiveKit Cloud (WebRTC), free tier |
| Recording storage | Supabase Storage private bucket + `recordings` table; scheduled job (Supabase pg_cron or Vercel Cron) deletes after 7 days; demo uses pre-recorded clips |
| Payment | Midtrans Sandbox, Snap + notification webhook (simulated) |
| Language switch (ID/EN) | next-intl, Indonesian default |
| Validation | Zod |
| Unit/integration tests | Vitest |
| End-to-end tests | Playwright (mobile and desktop viewports) |
| Uptime check | UptimeRobot (free) during UAT |

Free-tier limits as found in a web search on 17 Oct 2026 (from official docs and third-party summaries; re-check the official pricing pages before relying on them):
- **LiveKit Cloud Build (free):** about 5,000 WebRTC participant minutes and 50 GB downstream data per month, a hard cap with no overage. Recording-type egress is only about 60 minutes per month, which is why real recording is not planned.
- **Supabase Free:** about 1 GB file storage, 5 GB egress per month, and projects pause after about a week of inactivity (data is kept, but the app is offline until restored). Keep the project active, or restore it before the demo.
- Vercel Hobby limits not yet checked.

## Commands

```
Install:    npm install
Dev:        npm run dev
Build:      npm run build
Typecheck:  npm run typecheck        # tsc --noEmit
Lint:       npm run lint
Unit tests: npm test                 # vitest run
E2E tests:  npm run test:e2e         # playwright test
Seed DB:    npm run db:seed -- <live|test>
```

## Project Structure

```
src/app/[locale]/      every page, per language (Indonesian at /..., English at /en/...; T4)
  (marketing)/         landing page at / (no app navigation)
  (customer)/          customer app pages (mobile-first), home at /home
  (cleaner)/           cleaner pages (mobile-first)
  (agency)/            agency back office (desktop-first)
  (admin)/             admin console (desktop-first)
src/app/api/           route handlers (Midtrans webhook, LiveKit token)
src/i18n/              next-intl routing, navigation and request config
src/proxy.ts           language routing in front of every page (Next.js 16 "proxy", formerly middleware)
src/components/        shared UI components
src/lib/               supabase client, auth/role guards, midtrans, livekit helpers
src/lib/validation/    Zod schemas
src/messages/          id.json and en.json translations
supabase/migrations/   SQL schema and RLS policies
supabase/seed/         demo data
tests/                 Vitest unit and integration tests
e2e/                   Playwright specs, one per Quality Plan scenario
docs/                  test evidence, screenshots
markdown/              all project documents (spec, plan, progress, design, constraints)
docx/                  the client's Contract and Quality Plan
```

## Code Style

TypeScript strict mode. Validate every input at the boundary. Check role on the server, never only in the UI.

```ts
// src/app/api/orders/route.ts (style example)
import { z } from "zod";
import { requireRole } from "@/lib/auth";

const CreateOrder = z.object({
  serviceId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  address: z.string().min(5),
  streamingConsent: z.boolean(),
});

export async function POST(req: Request) {
  const user = await requireRole("customer");
  const input = CreateOrder.parse(await req.json());
  // ...create order with status "pending_payment"
}
```

Conventions: kebab-case files, PascalCase components, camelCase variables, snake_case SQL columns. Small functions, no dead code, no secrets in the repo.

## Testing Strategy

- **Unit (Vitest):** validation schemas, price and status logic, payment-status mapping.
- **Integration (Vitest):** route handlers and RLS policies against a test Supabase project.
- **End-to-end (Playwright):** one spec per Quality Plan scenario, run in a mobile viewport for customer and cleaner flows and a desktop viewport for agency and admin flows.
- Streaming is verified manually with two real devices plus a latency measurement (documented in `docs/`), since WebRTC is hard to automate.
- Internal test results are saved in `docs/` as evidence, because the Contract requires internal testing before handing features to the client group for UAT.
- Coverage: the critical paths must have e2e tests. No fixed percentage target.

## Features and acceptance criteria

Priority: P0 must work at hand-over, P1 should work, P2 stretch.

**Landing page (P0)**
- Visitors see a landing page at `/` that says what HomeKlin is, shows HomeKlin's services with "mulai dari" prices, how it works, safety and privacy facts (only the customer watches their own job live; recordings kept 7 days, then deleted; the cleaner checks in at the address; consent asked at booking), a short FAQ teaser linking to `/support`, and one primary action, "Pesan sekarang", into booking.
- The customer app home is `/home`. After sign-in (T5), customers land on `/home`.

**Order (P0)**
- Customer browses **HomeKlin's services** (one price list set by admin), searches and filters by service type, and sees full prices with no hidden fees.
- Customer picks a service area. The time slots shown are the **combined free slots of the partner agencies serving that area**. A slot no agency can serve is never offered.
- Customer can book a service for a slot. The booking is **routed automatically** to one partner agency in that area with that slot free. Routing is race-safe: two customers booking the last free capacity of a slot at the same moment cannot both succeed, and the loser is told the slot is no longer free.
- No customer page shows, names or hints at a partner agency. Once a cleaner is assigned, the customer sees the cleaner's name and photo as "Petugas HomeKlin".
- Streaming consent toggle must be switched on at booking time (Plan, Risk 3).
- **Ordering needs no separate sign-up (user decision, 2026-10-25).** A service on the landing page or `/services` opens one order form at `/pesan`: service, area, arrival window, address, phone number (contact for the cleaner), email and the streaming consent. HomeKlin emails a 6-digit code; the customer types it on the form, which proves the email is theirs, creates the customer account if the email is new, signs them in, and places the order. A returning customer signs in at `/login` with a new emailed code to pay, watch the live stream or replay the recording. Staff (cleaner, agency, admin) keep email and password. Emails go through a free provider (Brevo); tests use a throw-away SMTP service (Ethereal) and never send real email.
- Payment via Midtrans Sandbox leads to exactly one of: successful, failed, cancelled. Order status matches payment status in every case, including webhook retries (idempotent).

**Check-in (P0)**
- Cleaner sees assigned jobs; can check in only at the job's time window and records location; check-out closes the job.
- Admin and agency can see check-in status.

**Support (P0)**
- FAQ page with keyword search; unanswered question offers "Contact admin".
- Escalation creates a chat ticket that appears in the admin inbox in real time.
- Admin can reply; ticket queue ordered by urgency/age.

**Streaming (P0 basic, P1 resilience)**
- Cleaner starts a stream from their phone browser with a visible status: active, weak signal, disconnected.
- A customer can watch **only the cleaner assigned to their own active booking**, and only while that job is in progress. They can never list, browse or open any other cleaner's stream.
- An admin can watch all active feeds in a multi-feed grid.
- An agency can watch the live stream and recordings of **its own cleaners only**, never another agency's.
- **Recording storage is real; the footage is demo footage.** Recordings live in a private Supabase Storage bucket with a `recordings` table (job, owner agency, file path, created at, expires at). For the demo, a finished job gets a pre-recorded short clip attached instead of a captured live stream. The code that attaches a recording sits behind one function, so a real capture can replace it later.
- **7-day retention is real.** A scheduled job deletes the file and marks the entry expired 7 days after the job ends. An expired entry can no longer be opened (enforced on the server), and the UI shows "available until" with a countdown.
- Playback uses short-lived signed links issued by the server, only after an authorization check.
- **Who can replay a recording:** the customer who booked that job (**most important**), the owning agency, and admin. Nobody else.
- **Stream source seam (demo vs live):** the live viewer takes its video from a "stream source". The demo source plays a pre-recorded clip as the "live" feed. A LiveKit source can be added later without changing the pages. Because the demo uses clips, the product does not depend on LiveKit's free tier to be demonstrable.
- Stream recovers automatically after a short connection drop; adaptive bitrate enabled.
- Access is denied to anyone not authorized, including by guessing a URL, room name or token. Stream tokens are issued by the server, scoped to one room, and short-lived.

**Admin monitor (P1)**
- Admin console shows a grid of all active live feeds, plus a list of past jobs with replay of recordings that are still within the 7-day window.

**Language (P0)**
- Every page works in Indonesian and English, with a visible language switch that remembers the choice.

**Admin services and prices (P0)**
- Admin manages HomeKlin's service list and its one price list (`/admin/services`). Customers see exactly these prices.

**Agency (P1)**
- A partner agency manages its own cleaners and its availability (schedule slots per service area), and assigns its own cleaners to the jobs routed to it. Agencies do not set customer prices or manage services.

**Reviews (P2)**
- Customer can rate and review a completed job: the HomeKlin service and the cleaner ("Petugas HomeKlin"). Reviews never name a partner agency on customer pages.

## Success Criteria

Mapped to the Quality Plan table. Each must be demonstrable.

| Quality attribute | Target | How we show it |
|---|---|---|
| Functional correctness | 100% of critical scenarios (booking, payment, streaming, FAQ/chat, check-in/out, admin monitoring) pass | Playwright run output + manual streaming checklist |
| Streaming performance | end-to-end latency <= 3 s on a normal mobile connection | measured and recorded in `docs/` |
| Streaming reliability | adaptive bitrate on; stream recovers after a connection drop | manual test with network throttling |
| Security and privacy | video only for authorized users; all video encrypted in transit; role-based authorization | RLS and API tests; tests that an unauthorized user cannot get a stream token and that a customer cannot get a token for any cleaner except the one on their own active booking |
| Availability | backend >= 99% during UAT | UptimeRobot report |
| Usability | >= 90% of UAT participants book without help | measured by the client group; we check the flow ourselves with at least 3 people first |
| Compatibility | main flows pass on Chrome on Android (latest), Safari on iOS (16+), and desktop Chrome, Edge, Firefox (latest) | Playwright plus manual device check |
| Recording retention | recordings playable for 7 days, then deleted and unreachable | test with a shortened retention setting: the file is gone from storage and the server refuses the entry |
| Recording access | only the booking's customer, the owning agency and admin can replay | tests that other customers and other agencies are refused |
| Defect quality | 0 critical or blocker defects at hand-over | defect log in `docs/` |
| Customer support | 100% of FAQ-to-chat escalation scenarios reach the admin inbox | e2e tests |
| Payment reliability | 100% of payment tests give the right status for successful, failed, cancelled | e2e + unit tests |

Note on "end-to-end encryption" from the Plan: a hosted streaming server encrypts media in transit (DTLS-SRTP) but is not true end-to-end encryption. We will state this plainly in the hand-over notes.

## Boundaries

- **Always:** validate input with Zod; check roles on the server; run typecheck, lint and tests before every commit; keep secrets in environment variables; keep seed data fictional.
- **Ask first:** database schema changes after the first migration; adding a dependency; changing the stack or hosting; dropping or adding a Plan feature; anything that could spend money.
- **Never:** commit secrets or `.env` files; use real payment credentials or real personal data; disable or delete a failing test to get green; stream or store video without customer consent; weaken RLS policies to make a test pass.

## Open Questions

Resolved in review: platform is a website (the client agreed); admin and agency are desktop-first; UI is bilingual; the admin multi-feed grid is included; recording and replay are simulated (no real video storage); agencies get video access for their own cleaners; customers see only their own cleaner's live stream; the whole scope stays in, built in the priority order below; whether the product is graded is not a blocker.

Resolved on 2026-10-18 (user decisions; they override anything older in this file):
1. **One brand to the customer.** Customers see HomeKlin as a single cleaning company with its own services. Partner agencies are never shown, named or hinted at on any customer page.
2. **Routing is automatic by area.** The slots a customer sees are the combined free slots of the partner agencies serving their area; the booking goes to an agency with that slot free. A slot no agency can serve is never offered.
3. **Pricing:** HomeKlin admin sets one price list. Agencies do not set customer prices; they manage their cleaners and availability and assign their own cleaners to the jobs routed to them.
4. **The cleaner shown to the customer:** name and photo, as "Petugas HomeKlin", once assigned. Never the agency.
5. **Landing page at `/`** for visitors, with one primary action "Pesan sekarang" into booking. The customer app home is `/home`; signed-in customers go to `/home` (T5).
6. **Photos:** free stock photos (Unsplash or Pexels licence), stored in the repo and credited in `markdown/image-sources.md`.
7. **Theme:** light only.

## Build Priority

If time runs out, whatever is lower on this list is what is unfinished. Everything stays in scope.

1. foundation (setup, login, roles, seed data)
2. catalog and order, including simulated Midtrans payment
3. **customer recording replay** (storage, access rules, 7-day expiry), because you said it is the most important feature
4. checkin
5. support (FAQ, escalation to admin chat)
6. live viewer for the customer, using the demo clip source, with the access rules
7. admin console and the multi-feed grid
8. agency back office, including agency video access and recording replay
9. reviews
10. real LiveKit stream source (cleaner's phone to viewers), replacing the demo clip source

## Open Questions

Resolved: building the real LiveKit stream last (priority 10) is acceptable, and you will supply the short demo clips (keep them small, because free storage is about 1 GB).

1. **Vercel Hobby limits** have not been checked yet. To check at scaffold time.
2. **Streaming latency target:** with demo clips, the Quality Plan's 3-second latency target can only be shown once the real LiveKit source exists (priority 10).
