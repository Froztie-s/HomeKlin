# HomeKlin: Progress and Handoff Notes

Last updated: 2026-10-18. Written so that a **brand-new Claude session with no memory** can pick up exactly where we stopped.

## Instructions for the next Claude session (read this first)
1. Read, in this order: this file, `README.md`, `SPEC.md`, `tasks/plan.md`, `tasks/todo.md`. Do not read the two `.docx` files unless you need to check a Contract detail (see "Reading the source documents").
2. **Current state: T1 and T2 done (2026-10-18).** Live at **https://home-klin.vercel.app** (Vercel, auto-deploys on push to `main`; per-deployment URLs sit behind Vercel login, which is expected). Code at https://github.com/Froztie-s/HomeKlin (public). CI passes. `/api/health` returns 200 with Supabase `ok` locally and live. Env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set in Vercel and in the local git-ignored `.env`.
3. **T3 done (2026-10-18)**, built by the dedicated frontend agent (`.claude/agents/homeklin-frontend.md`; after a restart it is the `homeklin-frontend` agent type; use it for every UI task). Design system in `docs/design.md`, screenshots in `docs/screenshots/t3/`. **The user found the T3 look too generic and corrected the business model** (see "Decisions made": one brand to the customer).
   **Next action: T3b redesign.** The user restarts Claude Code (this loads impeccable 4.6.0, the Vercel plugin and the `homeklin-frontend` agent type), then runs `/design-taste-frontend Follow docs/prompts/t3b-redesign.md`. That prompt holds every confirmed decision, the steps and the definition of done. After T3b comes T4 (bilingual switch; needs the user's OK to add `next-intl`, already in the approved stack). Open item from T2: the user still has to add an UptimeRobot monitor on `https://home-klin.vercel.app/api/health`. The Vercel plugin (`vercel-plugin@vercel`) is installed at user scope; the Vercel CLI is not logged in.
4. Follow the plan's workflow: one task at a time, tests first, checkpoint reviews, tick the box in `tasks/todo.md` as tasks finish, and update this file's "Where we are" table.
5. The user wants to **review at checkpoints** and wants things explained, because they must be able to demo and defend the product. Keep answers short and plain. Do not make large unrequested changes.
6. Skills installed that matter (invoke with the Skill tool): `agent-skills:*` (e.g. `incremental-implementation`, `test-driven-development`, `frontend-ui-engineering`, `security-and-hardening`, `source-driven-development`, `code-review-and-quality`, `shipping-and-launch`), plus the UI skills `design-taste-frontend`, `impeccable` and `ui-ux-pro-max`. The mapping of skill to task is in `tasks/plan.md`. The Figma connection failed earlier, so skip the Figma skills.

## What this project is
- A university project for **Software Audit and Quality Assurance** (Semester 5). It is a **role-play**: another group wrote the client's Contract and Development and Quality Plan. The user is the **software house** (PIHAK PERTAMA in the Contract) and must build the product. The client and QA/UAT party is **another student group** (PIHAK KEDUA in the Contract), who assess the product against their own Contract and Quality Plan.
- Product: **HomeKlin**, a hosted, bilingual (Indonesian default, English) website that is a middleman between customers and cleaning agencies.
- Whether the user's own product is graded is unknown. It is not a blocker.
- Contract term: **8 Sep to 9 Nov 2026**. From 17 Oct that leaves about 3 weeks.

## Where we are
| Step | Status | File |
|---|---|---|
| Interview (what the user actually wants) | done | summarised below |
| Spec | done, approved | `SPEC.md` |
| Plan and task list (39 tasks, 11 phases) | done, approved | `tasks/plan.md`, `tasks/todo.md` |
| Build | **in progress: T1–T3 done, next T3b redesign (prompt ready)** | `tasks/todo.md`, `docs/prompts/t3b-redesign.md` |

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
- **One brand to the customer (2026-10-18, user correction; overrides the agency-browsing parts of SPEC.md, PRODUCT.md and the T3 build):** customers see HomeKlin as one cleaning company with its own services and never see, or learn the names of, partner agencies. Behind the scenes:
  - **Routing:** automatic by area. Customers see the combined free slots of the partner agencies in their area; the booking goes to an agency with that slot free.
  - **Pricing:** HomeKlin admin sets one price list. Agencies manage only their cleaners and availability, and assign their cleaners to the jobs routed to them.
  - **Cleaner:** shown to the customer by name and photo as "Petugas HomeKlin", never the agency.
  - **Landing page** at `/` for visitors (one CTA "Pesan sekarang"); the customer app home moves to `/home`.
  - **Photos:** free stock photos (Unsplash/Pexels).
  - **Theme:** light only.
  - The SPEC/PRODUCT/task updates are step 1 of `docs/prompts/t3b-redesign.md`.
- **Design direction (2026-10-18):** brief in `PRODUCT.md`: product register; personality "trustworthy, calm, clear"; avoid busy super-app, cold corporate, CCTV look. The T3 build (periwinkle header, agency cards, Plus Jakarta Sans) was judged **too generic** by the user; T3b redoes it with the `design-taste-frontend` skill and references researched online, driven by `PRODUCT.md` and `docs/design.md`. Agency/admin keep a denser desktop sidebar layout.
- **Frontend agent:** every UI task goes to the dedicated frontend agent (user request). Vercel work goes to a separate Vercel agent.
- **Dependencies approved:** `lucide-react` (icons).
- **Not required:** the Development Plan's Scrum process, cost estimates, iOS app, store submission, wearable camera hardware.

One answer was ambiguous and I interpreted it: the user said replay "should not include the livestreaming". I took that to mean no recording of the live stream is captured and live streaming stays. The user later clarified they do want recording storage with demo clips, so the spec now reflects that.

## Build priority (from the spec)
1. Foundation  2. Catalog and ordering with payment  3. Customer recording replay  4. Check-in  5. Support (FAQ and chat)  6. Live viewer with demo clips  7. Admin console and grid  8. Agency back office  9. Reviews  10. Real LiveKit stream.

## Things only the user can do
- Create accounts and keys: Vercel and Supabase (needed at T2), Midtrans Sandbox (T10), LiveKit Cloud (T31).
- Supply the short demo clips, kept small because free storage is about 1 GB (needed at T13).
- Get the client's agreement to the website in writing.
- Optional: set up the Chrome DevTools connection for browser checks (T35).

## Known risks and open items
- About 3 weeks for a large scope. The dates in `tasks/plan.md` are estimates.
- Free-tier figures came from a web search on 17 Oct 2026 and conflicted between sources, so re-check the official pages: LiveKit free is about 5,000 participant minutes and 50 GB downstream per month with only about 60 minutes of recording-type egress. Supabase free is about 1 GB file storage and 5 GB egress, and **projects pause after about a week of inactivity** (wake it before the demo).
- Vercel Hobby (checked 2026-10-18 on vercel.com/docs): 1M function invocations and 100 GB transfer per month, 300 s max function duration, 100 deployments per day, non-commercial use only. **Cron jobs run at most once per day, with up to 59 minutes of jitter**, which is enough for the 7-day recording cleanup (T16); anything more frequent needs Supabase pg_cron.
- Supabase keys: use the new publishable key (`sb_publishable_...`, browser-safe) and secret key (`sb_secret_...`, server only, bypasses RLS). The legacy `anon`/`service_role` keys are deprecated by end of 2026. Supabase sends keys in the `apikey` header. Never paste the secret key in chat or commit it.
- **Repo is public, so docs use role titles, not real names** (user's decision). Keep it that way in every file and commit message.
- With clips standing in for the stream, the Quality Plan's 3-second latency target can only be shown once the real LiveKit source exists.
- The Plan promises "end-to-end encryption", but a hosted stream is encrypted in transit, not end to end. T38 includes an ADR that says so plainly.

## Reading the source documents
- The Contract and Plan are `.docx` files in Indonesian (the Plan is mixed Indonesian and English). The Read tool could not open the earlier PDF versions because `pdftoppm` is not installed. The `.docx` files can be read with Python's `zipfile` to read `word/document.xml` and strip the tags.
- Key Contract facts: scope is the Check-in and Order modules only (Pasal 1); there is no fixed feature list, since scope is agreed at sprint planning on the 1st and 15th; term ends 9 Nov 2026 (Pasal 5); the developer must do internal testing before client QA/UAT (Pasal 4); the developer hands over source code, documentation, config and access (Pasal 4); additions go in as addenda (Pasal 8).
- Key Quality Plan targets are in `SPEC.md` under Success Criteria.

## Environment notes
- Windows 11. The shell tools are PowerShell 5.1 and Git Bash. In PowerShell 5.1, `>>` writes UTF-16, so use `Out-File -Encoding ascii` or write files with the Write tool. Passing multi-line Python to `python -c` through PowerShell mangles quotes, so use a Bash heredoc (`python -I - <<'PY'`) instead.
- Node 24.11, npm 11.6. Scaffolded with Next.js 16.4.2 and React 19.3. Next 16 ships its docs in `node_modules/next/dist/docs/`; read them before writing Next.js code (`AGENTS.md`). `@types/node` was raised to `^24` because Vitest 5 needs 22 or newer.
- The `.docx` client documents are git-ignored (they hold names and signatures), so they stay local.
- **npm version mismatch:** CI uses Node 24.22 with npm 11.19.1. The local npm 11.6.1 on Windows left `@emnapi/*` entries out of `package-lock.json`, which broke `npm ci` in CI. Until the user upgrades npm, add dependencies with `npx npm@11.19.1 install ...` so the lockfile stays valid.
- Pushing works over HTTPS through Git Credential Manager (no SSH key on GitHub). `gh` CLI is not installed; the public GitHub REST API (curl) is enough to read CI run status.
- Windows OpenSSH here is too old for GitHub's key exchange. Git for Windows' `ssh-keyscan` works. The GitHub host key has already been added to `~/.ssh/known_hosts`. The `agent-skills` plugin is installed.

## Files in this folder
| File | What it is |
|---|---|
| `README.md` | short overview of the project |
| `Progress.md` | this file |
| `CLAUDE.md` | standing instructions that point new sessions to this file |
| `CONSTRAINTS.md` | the quality bar (checks that must pass, banned shortcuts) |
| `PRODUCT.md` | design brief: users, personality, anti-references, design principles |
| `.claude/agents/homeklin-frontend.md` | the dedicated frontend agent's role and rules |
| `docs/prompts/t3b-redesign.md` | the ready-to-run prompt for the T3b redesign (one-brand model, landing page, taste skill) |
| `AGENTS.md` | Next.js 16 agent notes (generated by Next.js) plus a pointer to `CONSTRAINTS.md` |
| `SPEC.md` | what we are building and how we'll know it's done |
| `tasks/plan.md` | the implementation plan, risks, and which skills to use when |
| `tasks/todo.md` | the 39 tasks with acceptance criteria |
| `HomeKlin Contract.docx`, `HomeKlin Development and Quality Plan.docx` | the client's documents |
