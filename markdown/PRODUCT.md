# Product

## Register

product

## What HomeKlin Is

HomeKlin is a remote cleaning agency: a website and brand that sells home cleaning without employing the cleaners. HomeKlin owns the customer relationship, the service list, the one price list, booking, payment, safety (check-in and live video) and support. Third-party partner cleaning companies, called partner agencies, supply the people and the schedule and do the actual cleaning.

The customer never sees this. To them HomeKlin is an ordinary cleaning company with its own services, its own prices and its own "Petugas HomeKlin". Behind the scenes, HomeKlin routes each booking to a partner agency in the customer's area that has the chosen slot free, and that agency assigns one of its cleaners.

The product is a landing page plus four dashboards, one for each kind of person who runs or uses the business:

| Surface | For | Device | What it is for |
|---|---|---|---|
| Landing page `/` | visitors | phone or desktop | what HomeKlin is, its services, how it works, safety facts; one action, "Pesan sekarang" |
| Customer dashboard | customers | phone | book, pay, follow orders, watch the live view, replay recordings, get support |
| Partner dashboard | partner agency staff | desktop | their cleaners, their availability, assigning their cleaners to routed jobs, video of their own cleaners |
| Admin dashboard | HomeKlin admins | desktop | services and prices, live monitoring, support chats, FAQ, recordings |
| Owner dashboard | the owner of HomeKlin | desktop | business numbers, partner agency oversight, admin accounts |
| Cleaner work screens (not a dashboard) | cleaners | phone | today's jobs, check in and out, stream from the phone camera |

## Users

- **Customers** (phone, mobile-first): households in Indonesian cities booking a home cleaning from HomeKlin. They are letting a stranger into their home, often while they are away, so their underlying question on every screen is "is my home OK?". They choose a HomeKlin service and a free time slot in their area, pay (simulated), watch the live view of their own cleaner during the job, and replay the recording for 7 days. They deal only with HomeKlin and never see which partner agency does the job.
- **Cleaners** (phone, mobile-first, work screens rather than a dashboard): on the job, often one-handed, on a mid-range Android phone and mobile data. They see today's jobs, check in and out at the address, and stream from the phone camera. To the customer they are "Petugas HomeKlin".
- **Partner agency staff** (desktop-first, back office only): run a partner agency's side of HomeKlin: their cleaners, their availability (schedule slots), assigning their own cleaners to the jobs HomeKlin routes to them, and video of their own cleaners. They do not set customer prices, and customers never see them.
- **Admins** (desktop-first): run HomeKlin day to day. They set the service list and price list, monitor all live jobs in a multi-feed grid, answer escalated support chats, review recordings, and manage the FAQ.
- **Owner** (desktop-first): the person who owns HomeKlin and runs the business behind the brand. They see how the business is doing (revenue, orders, trends, what each partner agency earned), decide which partner agencies HomeKlin works with (add, suspend, see performance), and create and remove admin accounts.

## Product Purpose

HomeKlin is the brand the customer trusts: to the customer it is one cleaning company with its own services, one price list and its own "Petugas HomeKlin". Behind the scenes, partner agencies supply the cleaners, and HomeKlin routes each booking to an agency in the customer's area that has the chosen slot free. The owner runs that business: which partners to work with, who administers it, and how it is doing. HomeKlin exists to make letting a cleaner into your home feel safe: one clear price list, real free slots, a check-in at the door, and live video of the job that only you can see. Success means a customer books and pays without help, and feels calm while the job happens.

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
4. **Two densities, one vocabulary.** Roomy and touch-first for customers and cleaners; dense and efficient for agency, admin and owner desktops. Same components, colours and words on both.
5. **Bilingual by design.** Indonesian first, English equal. Layouts hold longer strings without breaking.
6. **One brand to the customer.** Every customer page speaks as HomeKlin: HomeKlin's services, HomeKlin's prices, a "Petugas HomeKlin" shown by name and photo once assigned. Partner agencies are never shown, named or hinted at on a customer page (no agency lists, names, ratings, "verified agency" badges or "our partners" copy). Agency, admin and owner back offices may name agencies.

## Accessibility & Inclusion

- WCAG 2.1 AA (target in `markdown/CONSTRAINTS.md`; axe check at T35): 4.5:1 text contrast, visible focus, full keyboard use on desktop surfaces.
- Mobile from 360 px wide with no horizontal scroll; touch targets at least 44 px.
- Status is never shown by colour alone (icon or text too), for colour-blind users.
- Respect `prefers-reduced-motion`.
- Fast on mid-range Android over mobile data (performance pass at T36).
