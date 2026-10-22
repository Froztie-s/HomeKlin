# HomeKlin: Progress and Handoff Notes

Last updated: 2026-10-21. Written so that a **brand-new Claude session with no memory** can pick up exactly where we stopped.

## Instructions for the next Claude session (read this first)
1. Read, in this order: this file, `README.md`, `markdown/SPEC.md`, `markdown/tasks/plan.md`, `markdown/tasks/todo.md`. Do not read the two `.docx` files unless you need to check a Contract detail (see "Reading the source documents").
2. **Current state (2026-10-22): T1 to T4 done; next T5.** The hold of 2026-10-19 (the user re-editing user flows) was lifted by the user on 2026-10-22 ("just work through the build"); if changed flows arrive later, update `markdown/SPEC.md` and the affected tasks first. The user lets Claude commit without asking. T3c (landing redesign, `96335bf`) is pushed, CI green, live. T1 and T2 (2026-10-18): live at **https://home-klin.vercel.app** (Vercel, auto-deploys on push to `main`; per-deployment URLs sit behind Vercel login, which is expected). Code at https://github.com/Froztie-s/HomeKlin (public). CI passes. `/api/health` returns 200 with Supabase `ok` locally and live. Env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set in Vercel and in the local git-ignored `.env`.
3. **T3 done (2026-10-18)**, built by the dedicated frontend agent (`.claude/agents/homeklin-frontend.md`; after a restart it is the `homeklin-frontend` agent type; use it for every UI task). Screenshots in `docs/screenshots/t3/`. **The user found the T3 look too generic and corrected the business model** (see "Decisions made": one brand to the customer).
   **T3b done (2026-10-18)** with the `design-taste-frontend` skill (prompt: `markdown/prompts/t3b-redesign.md`): docs rewritten for the one-brand model; new design direction (evergreen OKLCH palette, Bricolage Grotesque + Figtree, one radius rule, CSS-only motion, five researched references; its doc was deleted on 2026-10-19 at the user's request and is in git history: `git show 96335bf:markdown/design-t3b.md`); landing page at `/`; customer app home at `/home` plus `/services`; `/agencies` and the agency "Layanan" page removed; admin "Layanan & Harga" placeholder at `/admin/services`; free stock photos in `public/images/` credited in `markdown/image-sources.md`; an e2e test fails if any customer page says "agensi", "agency" or "mitra". Screenshots: `docs/screenshots/t3b/` (before: `docs/screenshots/t3/`). The landing part was superseded by T3c.
   **T3c done (2026-10-19), user request:** the landing page `/` rebuilt on the redesign system in `markdown/design.md` (written 2026-10-19 from the user's Brightnest reference; forest green + lime + cream, Inter Tight + Instrument Serif italic + Inter), with the user's reference screenshot as the layout. Scoped: the landing wrapper has class `theme-forest`, which gives shared token names their new values there only; the customer, cleaner, agency and admin pages still look like T3b until their migration (design.md "Migration notes"). Built directly with the `design-taste-frontend` skill at the user's request (not the frontend agent). Screenshots: `docs/screenshots/t3c/` (before: `docs/screenshots/t3b/`). Pushed as `96335bf`, CI green, live. The open choices are under design.md "Decisions to review" (fonts, the floating card over the photo, the dark back-office sidebar, no form in the CTA shell).
   **T4 done (2026-10-22)**, built by the frontend agent: `next-intl` 4.14.9; every page moved under `src/app/[locale]/` (Indonesian unprefixed, English under `/en`); `src/proxy.ts` makes every new visitor Indonesian (it hides the browser's Accept-Language from next-intl) while an explicit switch is remembered for a year in the `NEXT_LOCALE` cookie; locale from `next/root-params`, so all pages stay prerendered in both languages; all visible text in `src/messages/{id,en}.json` (192 messages), with a key-parity unit test and typed keys and ICU arguments; English numbers formatted `en-ID` ("Rp 85.000"); the ID | EN switch in the landing utility bar/header, a new slim app bar for customer and cleaner pages, and the back-office sidebar/menu. Screenshots: `docs/screenshots/t4/`.
   **T5 in progress (2026-10-22), on the local branch `t5-auth` (not pushed, not on `main`), blocked on the user's Supabase access token.** Done so far ( `npm run check` passes except the integration tests, which need the test project):
   - `@supabase/supabase-js`, `@supabase/ssr`, `zod` installed (all in the approved stack).
   - `supabase/migrations/20261022120000_profiles_and_roles.sql`: `profiles` (role enum customer/cleaner/agency/admin, default customer), RLS "read own row only", no insert/update/delete rights for users, `handle_new_user` trigger that ignores any role in sign-up metadata.
   - `src/lib/auth/roles.ts` (role homes, protected sections, open-redirect-safe `next`), `src/lib/validation/auth.ts` (Zod), `src/lib/auth/errors.ts`, `src/lib/auth/dal.ts` (`getCurrentUser`, `requireRole`), `src/lib/auth/actions.ts` (signIn, signUp, signOut server actions), `src/components/auth/role-gate.tsx`, `src/lib/supabase/{config,server,proxy-session}.ts`; `src/proxy.ts` refreshes the session first, then language routing, then sends visitors without a session from protected sections to `/login?next=...`. Unit tests: roles, validation, errors, proxy gate (91 pass).
   - `scripts/supabase.mjs` (`npm run supabase -- <command>`): Management API helper to create the separate test project, apply migrations, switch off email confirmation and fetch keys into `.env` (never printed).
   - `tests/integration/profiles-rls.test.ts` against the test project (fails loudly until its keys exist; no skipping).
   - `playwright.config.ts` points the e2e build at the test project; `.github/workflows/ci.yml` reads `TEST_SUPABASE_*` from repository secrets; `.env.example` documents every key.
   **Next steps once `SUPABASE_ACCESS_TOKEN` is in `.env`:** `npm run supabase -- create-test-project`, `migrate test`, `migrate live`, `autoconfirm test`, `autoconfirm live`; then the frontend agent builds `/login` and `/signup` (`src/app/[locale]/(auth)/`), sign-out, the "Masuk" link and account chip, RoleGate wiring (cleaner/agency/admin layouts, customer `/orders` and `/account`), Auth messages in both languages, and moves the e2e suite to signed-in users per role (Playwright setup project with storage states; users created in the test project and deleted after); then the user adds the three `TEST_SUPABASE_*` GitHub secrets; then commit, push, CI. After T5: T6, then Checkpoint 1. The app migration to the redesign (`markdown/design.md`, Migration notes) is not a numbered task yet. The T3b review points were settled by the user on 2026-10-21 (see "Decisions made"). Open item from T2: the user still has to add an UptimeRobot monitor on `https://home-klin.vercel.app/api/health`. The Vercel plugin (`vercel-plugin@vercel`) is installed at user scope; the Vercel CLI is not logged in.
4. Follow the plan's workflow: one task at a time, tests first, checkpoint reviews, tick the box in `markdown/tasks/todo.md` as tasks finish, and update this file's "Where we are" table.
5. The user wants to **review at checkpoints** and wants things explained, because they must be able to demo and defend the product. Keep answers short and plain. Do not make large unrequested changes.
6. Skills installed that matter (invoke with the Skill tool): `agent-skills:*` (e.g. `incremental-implementation`, `test-driven-development`, `frontend-ui-engineering`, `security-and-hardening`, `source-driven-development`, `code-review-and-quality`, `shipping-and-launch`), plus the UI skills `design-taste-frontend`, `impeccable` and `ui-ux-pro-max`. The mapping of skill to task is in `markdown/tasks/plan.md`. The Figma connection failed earlier, so skip the Figma skills.

## What this project is
- A university project for **Software Audit and Quality Assurance** (Semester 5). It is a **role-play**: another group wrote the client's Contract and Development and Quality Plan. The user is the **software house** (PIHAK PERTAMA in the Contract) and must build the product. The client and QA/UAT party is **another student group** (PIHAK KEDUA in the Contract), who assess the product against their own Contract and Quality Plan.
- Product: **HomeKlin**, a hosted, bilingual (Indonesian default, English) website that is a middleman between customers and cleaning agencies.
- Whether the user's own product is graded is unknown. It is not a blocker.
- Contract term: **8 Sep to 9 Nov 2026**. From 17 Oct that leaves about 3 weeks.

## Where we are
| Step | Status | File |
|---|---|---|
| Interview (what the user actually wants) | done | summarised below |
| Spec | done, approved | `markdown/SPEC.md` |
| Plan and task list (39 tasks, 11 phases) | done, approved | `markdown/tasks/plan.md`, `markdown/tasks/todo.md` |
| Build | **in progress: T1–T4 done; T5 half built, waiting for the user's Supabase access token** | `markdown/tasks/todo.md` |

## Decisions made (do not re-ask these)
- **Platform:** a website, not the Android app the Contract names. The client agreed, but it should still be written as a Contract addendum (Pasal 8).
- **Layout:** customer and cleaner pages are mobile-first. Agency and admin pages are desktop-first (a real desktop site, not a mobile view).
- **Scope:** everything the Quality Plan tests: booking, simulated payment, cleaner check-in/out, live viewing, FAQ with escalation to admin chat, admin monitoring (multi-feed grid), recording replay, agency back office, reviews.
- **Stack (free tiers only):** Next.js + TypeScript + Tailwind on Vercel; Supabase (Postgres, Auth, Realtime, Storage); Midtrans Sandbox for simulated payment; LiveKit Cloud for the real live stream, built last. The user left the stack choice to Claude.
- **Streaming:** the demo uses **pre-recorded short clips supplied by the user**, as a stand-in for a real live stream. The code uses a swappable stream source so real LiveKit can replace the clips (task priority 10). The user will present the user-side UI/UX flow and explain the clips stand in for live video.
- **Recordings:** storage and the 7-day deletion are **real**; the footage is the demo clips. Replay is allowed for the booking's customer, the owning agency, and admin. **Customer replay is the user's top priority**, so it is Phase 3, straight after booking and payment.
- **Video access rules:** a customer sees only their own cleaner's live stream, only during their active job. An agency sees only its own cleaners. Admin sees all, in a multi-feed grid. Each cleaner has one camera.
- **Payment:** simulated with the Midtrans Sandbox.
- **Working style:** Claude builds, the user reviews at checkpoints.
- **Everything stays in scope.** If time runs short, the lowest-priority tasks stay unfinished, in this order: real LiveKit stream, reviews, agency back office, admin grid.
- **One brand to the customer (2026-10-18, user correction; overrides the agency-browsing parts of markdown/SPEC.md, markdown/PRODUCT.md and the T3 build):** customers see HomeKlin as one cleaning company with its own services and never see, or learn the names of, partner agencies. Behind the scenes:
  - **Routing:** automatic by area. Customers see the combined free slots of the partner agencies in their area; the booking goes to an agency with that slot free.
  - **Pricing:** HomeKlin admin sets one price list. Agencies manage only their cleaners and availability, and assign their cleaners to the jobs routed to them.
  - **Cleaner:** shown to the customer by name and photo as "Petugas HomeKlin", never the agency.
  - **Landing page** at `/` for visitors (one CTA "Pesan sekarang"); the customer app home moves to `/home`.
  - **Photos:** free stock photos (Unsplash/Pexels).
  - **Theme:** light only.
  - `markdown/SPEC.md`, `markdown/PRODUCT.md`, `README.md` and the tasks were updated for this in T3b (new task T7b: admin services and price list; T7, T8, T9, T27, T28, T30 reworded; new risk "no partner agency free in an area").
- **Design direction (2026-10-18):** brief in `markdown/PRODUCT.md`: product register; personality "trustworthy, calm, clear"; avoid busy super-app, cold corporate, CCTV look. The T3 build (periwinkle header, agency cards, Plus Jakarta Sans) was judged **too generic** by the user; T3b redid it with the `design-taste-frontend` skill. Agency/admin keep a denser desktop sidebar layout.
- **Redesign (2026-10-19, user request):** `markdown/design.md` is now the only design doc and the source of truth (Stitch format, adapted from the user's Brightnest reference). It is live on the landing page (T3c) through the scoped class `theme-forest`; the customer, cleaner, agency and admin pages still run on the T3b tokens until their migration (design.md "Migration notes"). The T3b design doc was deleted at the user's request.
- **T3b design system (2026-10-18; its doc is deleted, read it with `git show 96335bf:markdown/design-t3b.md`):** evergreen brand colour (OKLCH hue 165) on green-tinted off-white, all text pairs AA; Bricolage Grotesque (headings) + Figtree (text); radius rule: interactive = pill, containers = 20 px, nested = 12 px; CSS-only motion (hero entry, press feedback, live dot), no animation library; light only. Dials: landing 5/4/4, app 3/3/5. References: MyClean, Fantastic Services, KliknClean, Justlife, Wise (what was borrowed from each is in section 8 of that doc). Navigation data is split into `app-navigation.ts` and `back-office-navigation.ts` so customer bundles never carry agency labels.
- **Languages (T4, 2026-10-22):** Indonesian is the default for every new visitor, whatever the browser's language; English lives under `/en/...`; a switch is remembered for a year; English text formats numbers the Indonesian way (`en-ID`). Copy rules and the switch's placement are in `markdown/design.md`.
- **Landing copy (user, 2026-10-21):** the live-view wording follows `markdown/SPEC.md`: "Anda dan tim pemantau HomeKlin", not "only you", because admin and the agency can watch too. The hero headline stays "Jasa kebersihan rumah yang bisa Anda tonton langsung".
- **Frontend agent:** every UI task goes to the dedicated frontend agent (user request). Vercel work goes to a separate Vercel agent.
- **Dependencies approved:** `lucide-react` (icons); `next-intl` (named in the approved stack in `markdown/SPEC.md`; installed at T4 after the user said on 2026-10-22 to work through the build without stopping to ask).
- **Not required:** the Development Plan's Scrum process, cost estimates, iOS app, store submission, wearable camera hardware.

One answer was ambiguous and I interpreted it: the user said replay "should not include the livestreaming". I took that to mean no recording of the live stream is captured and live streaming stays. The user later clarified they do want recording storage with demo clips, so the spec now reflects that.

## Build priority (from the spec)
1. Foundation  2. Catalog and ordering with payment  3. Customer recording replay  4. Check-in  5. Support (FAQ and chat)  6. Live viewer with demo clips  7. Admin console and grid  8. Agency back office  9. Reviews  10. Real LiveKit stream.

## Things only the user can do
- Create accounts and keys: Vercel and Supabase (needed at T2), Midtrans Sandbox (T10), LiveKit Cloud (T31).
- **T5 (asked 2026-10-22):** a Supabase personal access token in `.env` as `SUPABASE_ACCESS_TOKEN` (https://supabase.com/dashboard/account/tokens); after the test project exists, three GitHub repository secrets copied from `.env`: `TEST_SUPABASE_URL`, `TEST_SUPABASE_PUBLISHABLE_KEY`, `TEST_SUPABASE_SECRET_KEY` (GitHub repo > Settings > Secrets and variables > Actions > New repository secret).
- Supply the short demo clips, kept small because free storage is about 1 GB (needed at T13).
- Get the client's agreement to the website in writing.
- Optional: set up the Chrome DevTools connection for browser checks (T35).

## Known risks and open items
- About 3 weeks for a large scope. The dates in `markdown/tasks/plan.md` are estimates.
- Free-tier figures came from a web search on 17 Oct 2026 and conflicted between sources, so re-check the official pages: LiveKit free is about 5,000 participant minutes and 50 GB downstream per month with only about 60 minutes of recording-type egress. Supabase free is about 1 GB file storage and 5 GB egress, and **projects pause after about a week of inactivity** (wake it before the demo).
- Vercel Hobby (checked 2026-10-18 on vercel.com/docs): 1M function invocations and 100 GB transfer per month, 300 s max function duration, 100 deployments per day, non-commercial use only. **Cron jobs run at most once per day, with up to 59 minutes of jitter**, which is enough for the 7-day recording cleanup (T16); anything more frequent needs Supabase pg_cron.
- Supabase keys: use the new publishable key (`sb_publishable_...`, browser-safe) and secret key (`sb_secret_...`, server only, bypasses RLS). The legacy `anon`/`service_role` keys are deprecated by end of 2026. Supabase sends keys in the `apikey` header. Never paste the secret key in chat or commit it.
- **Repo is public, so docs use role titles, not real names** (user's decision). Keep it that way in every file and commit message.
- With clips standing in for the stream, the Quality Plan's 3-second latency target can only be shown once the real LiveKit source exists.
- The Plan promises "end-to-end encryption", but a hosted stream is encrypted in transit, not end to end. T38 includes an ADR that says so plainly.
- **T4 known limits:** with Cache Components, Next.js 16.4 renders the 404 page (`/agencies`, `/en/agencies`) as a shell the browser fills in, so its text needs JavaScript (status 404 is correct either way). Typed ICU arguments use next-intl's experimental `createMessagesDeclaration`, which writes the git-ignored `src/messages/id.d.json.ts` on `typecheck`, `dev` and `build`. Next's docs name the proxy test helper `unstable_doesProxyMatch`, but 16.4.2 exports `unstable_doesMiddlewareMatch` (used in `tests/proxy.test.ts`).
- **Noted, no decision needed (T3b):** the sample cleaner "Wulan Anggraeni" is a stock photo with an invented name, labelled as sample data until T28; the landing's service cards link to `/services`, and nothing is bookable until T9. (The live-view wording and the hero headline were settled by the user on 2026-10-21; see "Decisions made".)
## Reading the source documents
- The Contract and Plan are `.docx` files in Indonesian (the Plan is mixed Indonesian and English). The Read tool could not open the earlier PDF versions because `pdftoppm` is not installed. The `.docx` files can be read with Python's `zipfile` to read `word/document.xml` and strip the tags.
- Key Contract facts: scope is the Check-in and Order modules only (Pasal 1); there is no fixed feature list, since scope is agreed at sprint planning on the 1st and 15th; term ends 9 Nov 2026 (Pasal 5); the developer must do internal testing before client QA/UAT (Pasal 4); the developer hands over source code, documentation, config and access (Pasal 4); additions go in as addenda (Pasal 8).
- Key Quality Plan targets are in `markdown/SPEC.md` under Success Criteria.

## Environment notes
- Windows 11. The shell tools are PowerShell 5.1 and Git Bash. In PowerShell 5.1, `>>` writes UTF-16, so use `Out-File -Encoding ascii` or write files with the Write tool. Passing multi-line Python to `python -c` through PowerShell mangles quotes, so use a Bash heredoc (`python -I - <<'PY'`) instead.
- Node 24.11, npm 11.6. Scaffolded with Next.js 16.4.2 and React 19.3. Next 16 ships its docs in `node_modules/next/dist/docs/`; read them before writing Next.js code (`AGENTS.md`). `@types/node` was raised to `^24` because Vitest 5 needs 22 or newer.
- The `.docx` client documents are git-ignored (they hold names and signatures), so they stay local.
- **npm version mismatch:** CI uses Node 24.22 with npm 11.19.1. The local npm 11.6.1 on Windows left `@emnapi/*` entries out of `package-lock.json`, which broke `npm ci` in CI. Until the user upgrades npm, add dependencies with `npx npm@11.19.1 install ...` so the lockfile stays valid.
- Pushing works over HTTPS through Git Credential Manager (no SSH key on GitHub). `gh` CLI is not installed; the public GitHub REST API (curl) is enough to read CI run status.
- Windows OpenSSH here is too old for GitHub's key exchange. Git for Windows' `ssh-keyscan` works. The GitHub host key has already been added to `~/.ssh/known_hosts`. The `agent-skills` plugin is installed.

## Files in this folder
All project markdown lives in `markdown/` and the client Word files in `docx/`. Only `CLAUDE.md`, `AGENTS.md`, `README.md` and `.claude/agents/` stay in the root, because tools look for them there.

| File | What it is |
|---|---|
| `README.md` | short overview of the project |
| `markdown/Progress.md` | this file |
| `CLAUDE.md` | standing instructions that point new sessions to this file |
| `markdown/CONSTRAINTS.md` | the quality bar (checks that must pass, banned shortcuts) |
| `markdown/PRODUCT.md` | design brief: users, personality, anti-references, design principles |
| `.claude/agents/homeklin-frontend.md` | the dedicated frontend agent's role and rules |
| `markdown/prompts/t3b-redesign.md` | the prompt that ran T3b (one-brand model, landing page, taste skill) |
| `markdown/design.md` | the redesign spec (Stitch format: tokens, components, contrast table, migration plan), written 2026-10-19; built on the landing page in T3c |
| `markdown/references/brightnest-design.md` | the user's reference design.md (Brightnest); format and mood only, not HomeKlin content |
| `.claude/settings.json` | sets `IMPECCABLE_CONTEXT_DIR=markdown` so the Impeccable skill still finds `PRODUCT.md` and `design.md` |
| `markdown/image-sources.md` | source, photographer and licence of every photo in `public/images/` |
| `AGENTS.md` | Next.js 16 agent notes (generated by Next.js) plus a pointer to `markdown/CONSTRAINTS.md` |
| `markdown/SPEC.md` | what we are building and how we'll know it's done |
| `markdown/tasks/plan.md` | the implementation plan, risks, and which skills to use when |
| `markdown/tasks/todo.md` | the 39 tasks with acceptance criteria |
| `docx/HomeKlin Contract.docx`, `docx/HomeKlin Development and Quality Plan.docx` | the client's documents |
