# HomeKlin

A website that connects customers with partner cleaning agencies. To the customer, HomeKlin is one cleaning company: they book a HomeKlin service in their area, pay (simulated), and can watch their cleaner's live camera feed during the job. They can replay the recording for 7 days afterwards. Behind the scenes each booking is routed to a partner agency with the slot free; agencies manage their cleaners and availability, and admins set the prices, monitor jobs and answer support chats.

This is a university project for **Software Audit and Quality Assurance** (Semester 5). We build the product as the software house, and the client group assesses it against their Contract and Quality Plan.

## Status
Planning is done. **No code has been written yet.**

## Who uses it
| Role | Device | What they do |
|---|---|---|
| Customer | phone (mobile-first) | browse, book, pay, watch live, replay recordings, FAQ and chat |
| Cleaner | phone (mobile-first) | see jobs, check in and out, stream camera |
| Agency (partner, back office only) | desktop | manage own cleaners, availability and assignments of routed jobs, view own cleaners' video |
| Admin | desktop | support inbox, multi-feed live grid, recording replay |

The site is available in Indonesian (default) and English.

## Planned tech stack (free tiers)
Next.js + TypeScript + Tailwind on Vercel, Supabase (database, login, chat, file storage), Midtrans Sandbox (simulated payments), LiveKit (real live streaming, built last).

For the demo, pre-recorded short clips stand in for the live camera.

## Project files
| File | What it is |
|---|---|
| `HomeKlin Contract.docx` | the client's Contract (in Indonesian) |
| `HomeKlin Development and Quality Plan.docx` | the client's development and quality plan |
| `SPEC.md` | what we are building and how we'll know it's done |
| `tasks/plan.md` | the implementation plan, risks, and which skills to use when |
| `tasks/todo.md` | the 39 tasks with acceptance criteria |
| `Progress.md` | progress notes and decisions, for resuming in a new session |
| `CLAUDE.md` | standing instructions that Claude reads at the start of each session |

## Deadline
The Contract ends on **9 November 2026**.
