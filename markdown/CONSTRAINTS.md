# Constraints

The quality bar for HomeKlin. Every agent and person reads this before writing code. Do not weaken it to make a change pass.

Last reviewed: 2026-10-18 (T1). Thresholds come from `markdown/SPEC.md` (Boundaries, Testing Strategy, Success Criteria).

## Floor (always enforced)

- No suppression comments: `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable`. Mechanically blocked: `@typescript-eslint/ban-ts-comment` is an error, and ESLint runs with `noInlineConfig`, so `eslint-disable` comments have no effect.
- No skipped, focused or deleted tests to get to green (`.skip`, `.only`, `test.fixme`). Playwright's `forbidOnly` fails CI on `.only`.
- No unimplemented stubs: `throw new Error("Not implemented")`, empty `catch {}`, a `TODO` standing in for the real code.
- No secrets in source. Keys live in environment variables; only `.env.example` (no values) is committed.
- No real personal data or real payment credentials. Seed data is fictional.
- Never weaken a row-level security (RLS) policy or delete a failing test to make a check pass.
- This file is not loosened in the same commit as the change that was failing.

## Enforced with numbers

| Dimension | Rule | Why | Checked by | Runs at |
|---|---|---|---|---|
| Types | 0 type errors, TypeScript `strict` | catches whole classes of bugs before runtime | `npm run typecheck` | every task, CI |
| Lint | 0 errors | Next.js and React rules, including the suppression ban | `npm run lint` | every task, CI |
| Unit and integration tests | 100% pass | logic, validation, RLS and authorization tests | `npm test` | every task, CI |
| Build | succeeds | the deployed app must build | `npm run build` | every task, CI |
| End-to-end | 100% pass, mobile and desktop viewports | one spec per Quality Plan scenario; the client group tests these flows | `npm run test:e2e` | task end for UI tasks, CI |
| Production dependencies | nothing at high or above | external opinion: the npm advisory database | `npm audit --omit=dev --audit-level=high` | CI |
| Input validation | every route handler and server action parses input with Zod | untrusted input stops at the boundary | review (`code-review-and-quality`) | checkpoint |
| Authorization | roles checked on the server and by RLS, never only in the UI; each access rule has a test that a wrong user is refused | video and recordings must reach only the right people | tests + review | every access-control task |

`npm run check` runs typecheck, lint and unit tests together. Run it before calling any task done, and run `npm run test:e2e` as well for UI tasks.

## Measured, not yet enforced

| Metric | Today (2026-10-18) | Direction |
|---|---|---|
| Dev-dependency audit | 5 high, all `braces` pulled in by `eslint-config-next` (lint tooling, not shipped to users) | must not grow; recheck when Next.js updates |
| Coverage | not measured; `markdown/SPEC.md` sets no percentage, critical paths must have e2e tests | critical paths covered |

## Planned (added at the named task, needs a running URL)

| Dimension | Target | Task |
|---|---|---|
| Accessibility | 0 critical or serious violations (axe, WCAG 2.1 AA) | T35 |
| Mobile performance | LCP <= 2.5 s, CLS <= 0.1 on key customer pages | T36 |
| Streaming latency | <= 3 s end to end | T33 |
| Availability | >= 99% during UAT (UptimeRobot) | T2, T37 |

## Exceptions

| ID | Rule | Path | Reason | Owner | Expires |
|---|---|---|---|---|---|
| none | | | | | |
