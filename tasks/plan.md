# Implementation Plan: HomeKlin Web Platform

## Overview
Build the HomeKlin website: a hosted, bilingual (Indonesian/English) middleman between customers and partner cleaning agencies. **To the customer, HomeKlin is one cleaning company** with its own services and one price list (set by admin); bookings are routed automatically to a partner agency in the customer's area with the slot free, and agencies are never shown on customer pages (decision of 2026-10-18). Visitors land on a landing page at `/`; the customer app home is `/home`. Customers and cleaners use mobile-first pages. Agencies and admins use desktop-first pages. Scope is everything the Quality Plan tests, built in the spec's priority order. Deadline: Contract end, **9 Nov 2026** (about 3 weeks from 17 Oct). Free tiers only. Demo footage is pre-recorded clips you supply.

## Architecture decisions
- **Next.js (App Router) + TypeScript + Tailwind, on Vercel.** One codebase with route groups per role: `(customer)`, `(cleaner)`, `(agency)`, `(admin)`.
- **Supabase** for Postgres, Auth, Realtime (chat), Storage (recordings). **Row-level security (RLS) is the real access control**; UI checks are only a convenience.
- **Vertical slices.** Each task delivers schema + API + UI + test for one user-visible behaviour, and leaves the app working. Migrations are added per slice, not all up front.
- **Stream source seam.** The live viewer reads from a `StreamSource` interface. Demo source = looped pre-recorded clip. LiveKit source is built last (task 31-33) and swapped in.
- **Recording seam.** One `attachRecording(jobId)` function. Demo version attaches a pre-recorded clip from a private bucket; a real capture can replace it later.
- **Payment** = Midtrans Sandbox (Snap) + signed, idempotent webhook.
- **Tests:** Vitest (unit/integration), Playwright (one e2e spec per Quality Plan scenario; mobile and desktop viewports).

## Skills used (and when)
| When | Skill | Use |
|---|---|---|
| Every task | `incremental-implementation`, `test-driven-development` | thin slices; failing test first |
| Setup (T1-T2) | `constraint-driven-development`, `git-workflow-and-versioning`, `ci-cd-and-automation` | write CONSTRAINTS.md, atomic commits, CI gates |
| Any library code (Next, Supabase, LiveKit, Midtrans, next-intl) | `source-driven-development` | check current official docs before coding |
| UI direction (T3) | `design-taste-frontend` **or** `impeccable` (pick one), `ui-ux-pro-max` | one-time visual direction, tokens, patterns |
| Redesign and landing page (T3b) | `design-taste-frontend` (incl. its Section 14 pre-flight), `frontend-ui-engineering` | one-brand redesign from researched references; landing rules |
| Every UI task | `frontend-ui-engineering` | accessible, responsive components |
| Endpoints (orders, webhook, tokens, signed URLs) | `api-and-interface-design` | contracts and error shapes |
| Access-control tasks | `security-and-hardening`, `doubt-driven-development` | RLS, token scoping, payment status |
| Browser checks | `browser-testing-with-devtools` | needs Chrome DevTools MCP configured |
| Failures | `debugging-and-error-recovery` | reproduce, localise, fix, guard |
| Each checkpoint | `code-review-and-quality` (`/agent-skills:review`) | five-axis review |
| Late | `performance-optimization` (`/agent-skills:webperf`), `code-simplification` | mobile speed; cleanup |
| Docs | `documentation-and-adrs` | ADRs, handover docs |
| Launch | `shipping-and-launch` (`/agent-skills:ship`) | pre-demo checklist |
Figma skills are skipped: the Figma connection failed earlier.

## Quality Plan coverage
| Quality attribute (target) | Where it is built and proven |
|---|---|
| Functional correctness (100% critical) | all slices; T37 full e2e suite |
| Streaming performance (<=3 s) | T32-T33 (real LiveKit only) |
| Streaming reliability | T32 (adaptive bitrate, reconnect) |
| Security and privacy | T5, T14, T23, T29, T34 |
| Availability (>=99%) | T2, T37 (uptime monitor) |
| Usability (>=90% book unaided) | T8-T9, T35 (3-person trial) |
| Compatibility | T35 |
| Defect quality (0 critical) | T37 defect log |
| Customer support (100% escalation) | T19-T21 |
| Payment reliability (100%) | T10-T11 |

## Dependency graph (summary)
```
T1 scaffold -> T2 deploy -> T3 design shell -> T3b redesign + landing -> T4 i18n -> T5 auth/roles -> T6 seed
T6 -> catalog (T7, T7b admin prices, T8) -> booking with routing (T9) -> payment (T10,T11) -> order status (T12)
T12 -> recordings (T13-T16)           [customer replay = top priority]
T12 -> cleaner jobs + check-in (T17,T18) -> attaches recording at check-out
T5 -> support (T19-T21)               [independent of orders; can run in parallel]
T18 -> stream seam + live viewer (T22,T23) -> admin (T24-T26) -> agency (T27-T29)
T12 -> reviews (T30)
T23 -> LiveKit (T31-T33)
all -> hardening and ship (T34-T39)
```
Parallelisable: support (T19-T21) can be built any time after T5. Everything else is sequential.

## Suggested pacing (estimate, adjust as we go)
| Target date | Phases |
|---|---|
| 24 Oct | 1 Foundation, 2 Catalog and order |
| 29 Oct | 3 Recording replay, 4 Check-in, 5 Support |
| 4 Nov | 6 Live viewer, 7 Admin, 8 Agency |
| 7 Nov | 9 Reviews, 10 LiveKit, 11 hardening |
| 8-9 Nov | Ship checklist, buffer |
If behind schedule, work stops at the lowest-priority task reached (spec's Build Priority). Everything stays in scope.

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Scope is large for ~3 weeks | High | strict priority order; checkpoints; vertical slices |
| Free tiers: Supabase pauses idle projects; 1 GB storage; LiveKit 5,000 min/month | Med | keep clips small; wake project before demo; LiveKit last |
| Role/RLS mistakes leak other users' video | High | RLS tests in the same task as each policy; T34 audit |
| Midtrans webhook retries cause wrong status | Med | idempotent handler + unit tests (T11) |
| No partner agency free in an area (or two customers take the last free capacity at once) | Med | only offer slots at least one agency in the area can serve (T7); race-safe routing that re-checks capacity in one transaction (T9); honest "no free slot in your area" empty state (T8); seed overlapping coverage for the demo (T6) |
| An agency name leaks onto a customer page | Med | e2e test that no customer page contains "agensi", "agency" or "mitra" (T3b, kept green in every later task); customer APIs never return agency identity (T7, T9) |
| Website vs Contract's Android app | Med | ADR (T38); the client agreed, get it in writing as Pasal 8 addendum |
| WebRTC latency/recovery can't be shown with clips | Med | explicit T33 measurement once LiveKit exists |
| Chrome DevTools MCP / accounts not set up | Low | human setup list below |

## Human setup needed (blocks tasks)
- Accounts and keys: Vercel, Supabase, Midtrans Sandbox, LiveKit Cloud (T2, T10, T31).
- Supply the short demo clips (T13).
- The client's written agreement to the website (Pasal 8 addendum).
- Chrome DevTools MCP configured, if you want browser verification (T35).

## Open questions
- Vercel Hobby limits not yet checked (check at T2).
- Product grading status unknown (not a blocker).
