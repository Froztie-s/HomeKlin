# Where the frontend lives (for the redesign)

A map of every page and component, so the design can be redone without hunting. Written 2026-11-05.
The backend (database, server actions, route handlers) is separate and does not need to change for a
redesign: see "What not to change" below.

## The short version
| What | Where |
|---|---|
| Every page (one file per address) | `src/app/[locale]/` |
| All page components (screens, forms, cards) | `src/components/<area>/` |
| Colours, spacing, radii, shadows, motion (design tokens) | `src/app/globals.css` (`@theme`) |
| Fonts | `src/app/fonts.ts` (apps), `src/app/[locale]/(marketing)/layout.tsx` (landing page) |
| All visible text, both languages | `src/messages/id.json` and `src/messages/en.json` |
| Images | `public/images/` (credits in `markdown/image-sources.md`) |
| Design rules and brand | `markdown/design.md`, `markdown/PRODUCT.md` |
| Screenshots of every screen, before and after | `docs/screenshots/t3` to `t29b` (each task's screens at 360, 390, 1280 and 1440 px) |

`npm run screenshots -- <task>` retakes a task's screenshots (`e2e/screenshots/`), which is the easiest
way to compare before and after.

## Pages by role
Addresses are shown without the language prefix (English adds `/en`). A page file is thin: a title, the
role check (`RoleGate`) and one content component.

### Visitors and customers (phone first)
| Address | Page file (under `src/app/[locale]/`) | Components (`src/components/`) |
|---|---|---|
| `/` landing | `(marketing)/page.tsx`, `(marketing)/layout.tsx` | `marketing/`: hero, hero-job-card, trust-row, services-grid, how-it-works, safety, faq-teaser, cta-shell, marketing-header, marketing-footer |
| `/home` app home | `(customer)/home/page.tsx` | `customer/`: area-picker, job-status-card, service-row (uses sample data in `home-preview-data.ts`) |
| `/services` catalog | `(customer)/services/page.tsx` | `customer/`: service-catalog, service-card, catalog-filters, catalog-form, free-windows, service-visual, catalog-skeleton; `reviews/service-rating.tsx` |
| `/pesan` order form (with the emailed code) | `(customer)/pesan/page.tsx` | `customer/`: order-content, order-form, order-where, booking-window-picker, booking-controls, booking-unavailable; `auth/code-entry` |
| `/login` | `(auth)/login/page.tsx`, `(auth)/layout.tsx` | `auth/`: auth-card, login-code-form, login-form, switch-link |
| `/orders` list and `/orders?order=` details | `(customer)/orders/page.tsx` | `customer/`: orders-content, order-list, order-confirmation, order-status, order-job, order-recording, recording-player, recording-countdown, recording-notice, payment-form, order-live; `reviews/`: order-review, review-form, stars |
| `/orders/live` live view | `(customer)/orders/live/page.tsx` | `customer/`: live-content, live-viewer, live-waiting, order-live |
| `/support` help, FAQ and chat | `(customer)/support/page.tsx` | `support/`: support-content, faq-search, faq-results, contact-admin, ticket-form, my-tickets, customer-ticket, ticket-chat |
| `/account` | `(customer)/account/page.tsx` | `auth/account-summary` |
| `/book` | redirects to `/pesan` | |

### Cleaner (phone first)
| Address | Page file | Components |
|---|---|---|
| `/cleaner` jobs, check-in, stream, check-out | `(cleaner)/cleaner/page.tsx` | `cleaner/`: cleaner-jobs-content, job-card, check-in-button, check-out-form, stream-control, finished-notes |
| `/cleaner/account` | `(cleaner)/cleaner/account/page.tsx` | `auth/account-summary` |

### Agency, admin and owner (desktop first, sidebar layout)
| Address | Page file | Components |
|---|---|---|
| `/agency` dashboard | `(agency)/agency/page.tsx` | `agency/dashboard-content` |
| `/agency/schedule` windows | `(agency)/agency/schedule/page.tsx` | `agency/`: schedule-content, add-slot-form, slot-row-actions |
| `/agency/cleaners` | `(agency)/agency/cleaners/page.tsx` | `agency/`: cleaners-content, add-cleaner-form |
| `/agency/orders` jobs, assign | `(agency)/agency/orders/page.tsx` | `agency/assign-cleaner`, `back-office/jobs-table` |
| `/agency/recordings` live and replay | `(agency)/agency/recordings/page.tsx` | `agency/`: recordings-content, live-tile, live-video, agency-recording-player |
| `/admin` dashboard | `(admin)/admin/page.tsx` | `back-office/`: summary-tile, jobs-table, open-tickets |
| `/admin/services`, `/new`, `/edit` | `(admin)/admin/services/...` | `admin/`: services-table, service-form, service-switch |
| `/admin/tickets` inbox and chat | `(admin)/admin/tickets/page.tsx` | `admin/`: ticket-inbox, inbox-live, close-ticket; `support/ticket-chat` |
| `/admin/monitor` live grid | `(admin)/admin/monitor/page.tsx` | `back-office/`: feed-tile, feed-video, feed-status |
| `/admin/recordings` replay | `(admin)/admin/recordings/page.tsx` | `back-office/`: recordings-table, admin-recording-player |
| `/admin/faq` | `(admin)/admin/faq/page.tsx` | placeholder |
| `/owner` business numbers | `(owner)/owner/page.tsx` | `owner/`: numbers, trend-chart, agency-status-pill |
| `/owner/agencies` | `(owner)/owner/agencies/page.tsx` | `owner/`: add-agency-form, confirm-action |
| `/owner/admins` | `(owner)/owner/admins/page.tsx` | `owner/create-admin-form` |

## Shared pieces (change these and every page changes)
- **Layouts and shells:** `src/app/[locale]/layout.tsx` (root), one `layout.tsx` per group, and
  `src/components/shell/`: `mobile-shell` and `app-header`, `bottom-nav` (customer and cleaner on phones),
  `sidebar-shell`, `side-nav-list`, `back-office-top-bar` (agency, admin, owner), `language-switch`,
  `role-badge`, `skip-link`. Menu entries (labels and links): `app-navigation.ts`,
  `back-office-navigation.ts`.
- **Small building blocks:** `src/components/ui/`: page-container, page-header, empty-state, button-link,
  live-indicator, sample-note, no-break. `src/components/brand/wordmark.tsx` is the logo.
- **Shared status and notices:** `admin/notice.tsx`, `customer/order-status.tsx`.
- **Sign-in pieces:** `src/components/auth/`: also `account-slot` (the "Masuk" or account chip in headers),
  `role-gate`, `gate-fallback` (the loading state shown while the role is checked).
- **Tokens:** `src/app/globals.css`: colours (`--color-*`, `brand-*`, `success-*`, `danger-*` and so on), radii,
  shadows, easing, fonts. Tailwind's own defaults are cleared, so only these tokens exist (`text-zinc-600`
  would do nothing). The landing page re-skins the same names with the class `theme-forest`
  (`markdown/design.md`, "Token mapping").

## What not to change in a redesign
These are the contracts between a screen and the backend. Restyle, rearrange and rename freely around them.
- **Server actions and their form field names.** The forms post to actions in `src/lib/*/actions.ts` (for
  example `openTicket`, `checkIn`, `addSlot`, `startPayment`) with fixed field names (`orderId`, `lat`,
  `lng`, `question`, ...). Keep each form's `name=` attributes and hidden fields (such as `locale` and
  `orderId`), and keep using `useActionState` with the action's returned `formError` key; the key to text
  mapping is in the messages.
- **Data readers.** Components receive plain objects from `src/lib/*` readers (`listMyOrders`,
  `listAgencyJobs`, `getBusinessNumbers`, ...). Their shapes are in those files; a redesign only changes how
  the data is shown.
- **The role check.** Every protected page wraps its content in `<Suspense><RoleGate roles={[...]}>`;
  `tests/protected-pages.test.ts` fails if one does not. A layout's check does not protect its pages.
- **Messages.** Every visible string goes through next-intl: add each key to both `id.json` and `en.json`
  (`tests/messages.test.ts` checks the keys match, and a wrong key is a type error). Customer pages must
  never say "agensi", "agency" or "mitra" (`e2e/no-agency-wording.spec.ts`).
- **Realtime and polling components** (`support/use-realtime.ts`, `ticket-chat`, `live-viewer`, `feed-status`,
  `live-status`) hold logic, not just looks: restyle their markup but keep their behaviour.
- **Server-rendered video.** The signed video links are made on the server inside `<Suspense>` (for
  example `order-recording.tsx`, `order-live.tsx`, `feed-tile.tsx`). Do not move them into the browser.

## The tests that look at the screens
`e2e/*.spec.ts` (Playwright, phone and desktop) find things by their visible Indonesian text and by role
(for example the button "Bayar sekarang", the heading "Pekerjaan hari ini"). After a redesign, either keep
the wording and roles or update the specs; run `npm run test:e2e`. Also checked on every page:
`e2e/no-horizontal-scroll.mobile.spec.ts` (nothing scrolls sideways at 360 px) and
`e2e/no-agency-wording.spec.ts`. The screenshot specs are `e2e/screenshots/*.screenshots.ts`.

## Design brief to start from
`markdown/PRODUCT.md` (who it is for, brand: trustworthy, calm, clear; what to avoid) and
`markdown/design.md` (the landing page's forest green and lime, Inter Tight with Instrument Serif italic;
the other pages still use the older evergreen tokens, Bricolage Grotesque and Figtree, listed under
"Migration notes" there). Rules already set: customer and cleaner screens are mobile first with a bottom
navigation; agency, admin and owner screens are desktop first with a sidebar; light theme only; touch
targets of at least 44 px; status is never shown by colour alone; each interactive element has hover,
focus, active, disabled and loading states; both languages (English runs about 30% longer).
