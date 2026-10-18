# Product

## Register

product

## Users

- **Customers** (phone, mobile-first): households in Indonesian cities booking a home cleaning. They are letting a stranger into their home, often while they are away, so their underlying question on every screen is "is my home OK?". They book, pay (simulated), watch the live view of their own cleaner during the job, and replay the recording for 7 days.
- **Cleaners** (phone, mobile-first): on the job, often one-handed, on a mid-range Android phone and mobile data. They see today's jobs, check in and out at the address, and stream from the phone camera.
- **Agency staff** (desktop-first): run a cleaning agency's back office: services, prices, schedule slots, cleaners, job assignment, and video of their own cleaners.
- **Admins** (desktop-first): monitor all live jobs in a multi-feed grid, answer escalated support chats, review recordings, and manage the FAQ.

## Product Purpose

HomeKlin is the middleman between customers who want their home cleaned and the agencies that do it. It exists to make letting a cleaner into your home feel safe: verified agencies, clear prices, a check-in at the door, and live video of the job that only you can see. Success means a customer books and pays without help, and feels calm while the job happens.

## Brand Personality

**Trustworthy, calm, clear.** Reassuring and plain, like a good banking or health app. The interface states facts (who is coming, when, for how much, what is happening now) and never hypes. Voice: polite, direct Indonesian (formal "Anda"), short sentences; English is a full equal. Emotional goal: peace of mind, not excitement.

## Anti-references

- **Busy super-app:** promo banners, vouchers, ads and badges competing on every screen. HomeKlin shows one task per screen.
- **Cold corporate:** grey enterprise software that feels like a government form. Calm is not the same as lifeless.
- **CCTV / surveillance:** live video must feel reassuring, not like a security control room (dark camera grids, red REC dots everywhere, timestamps burned over footage). Even the admin multi-feed grid stays calm and legible.

## Design Principles

1. **Reassurance through clarity.** Always show the current state of the job (booked, paid, cleaner on the way, checked in, live, finished) in plain words, before anything else.
2. **Facts, not hype.** Full prices with no hidden fees, real schedule slots, honest empty and error states. No promotional noise.
3. **Video is for peace of mind.** Live view and recordings are framed around the customer's home and their job, with calm states and clear privacy (who can see this, until when).
4. **Two densities, one vocabulary.** Roomy and touch-first for customers and cleaners; dense and efficient for agency and admin desktops. Same components, colours and words on both.
5. **Bilingual by design.** Indonesian first, English equal. Layouts hold longer strings without breaking.

## Accessibility & Inclusion

- WCAG 2.1 AA (target in `CONSTRAINTS.md`; axe check at T35): 4.5:1 text contrast, visible focus, full keyboard use on desktop surfaces.
- Mobile from 360 px wide with no horizontal scroll; touch targets at least 44 px.
- Status is never shown by colour alone (icon or text too), for colour-blind users.
- Respect `prefers-reduced-motion`.
- Fast on mid-range Android over mobile data (performance pass at T36).
