# HomeKlin

A website that connects customers with partner cleaning agencies. To the customer, HomeKlin is one cleaning company: they book a HomeKlin service in their area, pay (simulated), and can watch their cleaner's live camera feed during the job. They can replay the recording for 7 days afterwards. Behind the scenes each booking is routed to a partner agency with the slot free; agencies manage their cleaners and availability, and admins set the prices, monitor jobs and answer support chats. In effect HomeKlin is a remote cleaning agency whose cleaning is done by partner companies; the owner of HomeKlin sees the business numbers, decides which partners to work with and manages the admins. Besides the landing page there are four dashboards: customer, partner agency, admin and owner.

This is a university project for **Software Audit and Quality Assurance** (Semester 5). We build the product as the software house, and the client group assesses it against their Contract and Quality Plan.

Live: **https://home-klin.vercel.app** (Indonesian; English under `/en`). Progress per task: `markdown/tasks/todo.md`.

## Who uses it
| Role | Device | What they do | Home |
|---|---|---|---|
| Customer | phone (mobile-first) | browse, book, pay, watch live, replay recordings, FAQ and chat | `/home`, `/orders`, `/support` |
| Cleaner | phone (mobile-first) | see jobs, check in and out, stream camera | `/cleaner` |
| Agency (partner, back office only) | desktop | manage own cleaners, availability and assignments of routed jobs, view own cleaners' video | `/agency` |
| Admin | desktop | services and prices, support inbox, multi-feed live grid, recording replay | `/admin` |
| Owner | desktop | business numbers, partner agency oversight, admin accounts | `/owner` |

## Stack (free tiers)
Next.js 16 (App Router, Cache Components) + TypeScript (strict) + Tailwind CSS 4 on Vercel; Supabase (Postgres with row-level security, Auth, Realtime, Storage); next-intl (Indonesian default, English); Midtrans **Sandbox** (simulated payment, no real money); LiveKit Cloud for the real live stream (the demo uses pre-recorded clips, see `docs/adr/0002`). Tests: Vitest (unit and integration against a separate test project) and Playwright (mobile and desktop).

## Run it locally
1. Node 24 and npm. `npm ci`.
2. Copy `.env.example` to `.env` and fill it in; every key is explained there. The URL and publishable key are on the Supabase dashboard (Project Settings > API Keys); the secret key can be fetched with the project script (`npm run supabase -- keys <live|test>`, needs `SUPABASE_ACCESS_TOKEN`). Never commit `.env`.
3. Database: `npm run supabase -- migrate <live|test>` applies `supabase/migrations/` in order; `npm run db:seed -- <live|test>` adds the fictional demo accounts, the catalog, the partner agencies and their windows, the FAQ, and the demo jobs. Put the demo clips (`.mp4` or `.webm`, under 50 MB each) in the git-ignored `clips/` folder before seeding. Seed again shortly before a demo: it starts the demo jobs over (a job starting 10 minutes later for check-in, finished jobs with fresh recordings).
4. `npm run dev` and open http://localhost:3000.

Demo accounts (all `@example.com`, password `SEED_DEMO_PASSWORD` from `.env`): `pelanggan` (customer), `petugas.yuliana` and three more cleaners, `agensi.kilau` and `agensi.cemara` (agencies), `admin`, `pemilik` (owner).

## Commands
| Command | What it does |
|---|---|
| `npm run check` | typecheck, lint, unit and integration tests (needs the `TEST_SUPABASE_*` keys) |
| `npm run test:e2e` | builds the app against the test project and runs Playwright on mobile and desktop |
| `npm run screenshots -- <task>` | saves screenshots to `docs/screenshots/<task>/` |
| `npm run supabase -- <command>` | project helper: `migrate`, `keys`, `smtp`, `ethereal`, `test-rate-limits`, ... (see the top of `scripts/supabase.mjs`) |
| `npm run db:seed -- <live\|test>` | seeds the demo data |

Tests never touch the live project and never send real email. CI (`.github/workflows/ci.yml`) runs the same checks on every push, with the test project's keys as repository secrets; Vercel deploys `main`.

## Settings outside the code
| Where | What |
|---|---|
| Vercel | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `SITE_URL`, `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `CRON_SECRET`, and the `LIVEKIT_*` keys once LiveKit is set up |
| Midtrans Sandbox dashboard | Settings > Payment > Notification URL: `https://home-klin.vercel.app/api/payments/midtrans` |
| Vercel Cron (`vercel.json`) | daily `/api/cron/recordings`: deletes recordings older than 7 days |
| GitHub secrets | `TEST_SUPABASE_URL`, `TEST_SUPABASE_PUBLISHABLE_KEY`, `TEST_SUPABASE_SECRET_KEY`, `MIDTRANS_SERVER_KEY` |
| UptimeRobot | a monitor on `https://home-klin.vercel.app/api/health` (also keeps the free Supabase project awake) |

## How it is built
- `src/app/[locale]/`: every page, per role group; `src/app/api/`: route handlers (health, Midtrans notification, recording links, live streams, LiveKit tokens, the daily cleanup).
- `src/lib/`: one folder per feature (`booking`, `payment`, `jobs`, `recordings`, `stream`, `support`, `agency`, `owner`, `reviews`), each with its readers and its server actions; `src/lib/supabase/` has the clients.
- `supabase/migrations/`: the schema, the row-level security and every database function, with comments saying who may call what. Authorization lives here (`docs/adr/0005`).
- Decisions and why: `docs/adr/`. Quality bar: `markdown/CONSTRAINTS.md`. Scope: `markdown/SPEC.md`.

## Hand-over (Contract)
Source code (this repository), the documentation (`README.md`, `docs/adr/`, `markdown/`), the configuration (`.env.example`, `vercel.json`, `supabase/migrations/`, `.github/workflows/`), the test evidence (`docs/`), and access to the Vercel, Supabase, Midtrans Sandbox and LiveKit projects, handed over by the software house's project lead on request.

## Deadline
The Contract ends on **9 November 2026**.
