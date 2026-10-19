# HomeKlin: instructions for Claude

This folder is a university project (Software Audit and Quality Assurance, Semester 5): a hosted, bilingual website that connects customers with cleaning agencies. The user plays the software house and builds the product for a client group, who assess it against their own Contract and Quality Plan. The Contract ends on 9 Nov 2026.

## Start every session like this
1. Read `markdown/Progress.md` first. It has the current state, the decisions already made, and what to do next.
2. Then read `markdown/SPEC.md` (what we are building), `markdown/tasks/plan.md` (plan, risks, which skills to use when) and `markdown/tasks/todo.md` (the tasks).
3. Do not re-ask decisions that `markdown/Progress.md` lists as made.
4. Before starting any work, tell the user in one or two lines where we are and which task is next, and confirm. Planning is finished; building starts at the first unchecked task in `markdown/tasks/todo.md`.

## How to work
- Read `markdown/CONSTRAINTS.md` before writing code. Do not weaken it to make a change pass.
- One task at a time, in the order of `markdown/tasks/todo.md`. Tests first. Run `npm run check` (typecheck, lint, unit tests), plus `npm run test:e2e` for UI tasks, before calling a task done.
- This is Next.js 16: read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (see `AGENTS.md`).
- Stop at each checkpoint and let the user review.
- Tick finished tasks in `markdown/tasks/todo.md` and update the "Where we are" table in `markdown/Progress.md` before ending a session.
- Use the skills named for each task in `markdown/tasks/plan.md` (the `agent-skills:*` skills, plus a UI design skill for UI work). Skip the Figma skills unless the Figma connection works.
- Keep explanations short and plain. The user must be able to demo and defend the product.
- Stay inside `markdown/SPEC.md`. If something is missing or conflicts, ask rather than guess. Ask before adding dependencies, changing the stack, or spending money.
- Never commit secrets. The user supplies accounts, keys and the demo clips.

## Do not
- Rely on the Development Plan's process (Scrum, costs, iOS, store submission). The user does not need to implement it.
- Treat the Contract's "Android app" as the platform. The agreed platform is a website.
- Overwrite `markdown/Progress.md`, `markdown/SPEC.md` or the `markdown/tasks/` files wholesale. Edit them in place.

## Environment quirks
See the "Environment notes" and "Reading the source documents" sections of `markdown/Progress.md` (Windows, PowerShell 5.1 encoding, reading the `.docx` files).
