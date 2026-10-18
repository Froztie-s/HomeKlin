# HomeKlin Design System

The visual rules for every HomeKlin screen. The tokens live in `src/app/globals.css` (Tailwind v4 `@theme`); this file explains them and how to use them. Brand brief: `PRODUCT.md`.

Written in T3 (2026-10-18). Screenshots: `docs/screenshots/t3/`.

## 1. Visual theme and atmosphere

Calm, trustworthy and clear, like a good banking or health app. A customer is letting a stranger into their home, so every screen answers "is my home OK?" first, in plain words, and then helps them choose.

- **One brand colour, used with restraint.** A soft periwinkle blue carries the customer home header, primary actions and the current selection. Everything else is cool off-white and deep navy ink.
- **Facts over decoration.** No promo banners, vouchers, badges competing for attention, gradients or glass. Prices, ratings, times and status are the content.
- **Two densities, one vocabulary.** Customer and cleaner pages are roomy and touch-first. Agency and admin pages are denser desktop tools (Linear or Stripe dashboard density). Both use the same colours, type, radii and words.
- **Light theme only.** Physical scene: a parent glances at their phone in daylight (at the office, on the KRL) to check the cleaner arrived; agency staff work at desks in lit rooms. Dark mode would serve neither, so the scaffold's dark-mode block was removed.
- **Live video is reassuring, not CCTV.** "Live" is a slow teal pulse next to words. Never a red REC dot, never a dark control-room grid.

## 2. Colour palette and roles

All colours are OKLCH, hue 269 (the reference periwinkle). Contrast ratios are WCAG 2.x, measured from the token values. Tailwind's default palette is cleared, so these are the only colours that exist in components.

### Neutrals (cool, tinted toward the brand hue; not cream, not grey)

| Token | OKLCH | Hex | Role | Contrast |
|---|---|---|---|---|
| `canvas` | 0.977 0.006 269 | #f6f7fc | page background | |
| `surface` | 1 0 0 | #ffffff | cards, bars, inputs | |
| `surface-sunken` | 0.958 0.01 269 | #eef1f8 | chips, hover fill on surface | |
| `panel` | 0.962 0.009 269 | #f0f2f9 | back-office sidebar (second neutral layer) | |
| `border` | 0.905 0.012 269 | #dcdfe8 | dividers, card edges | decorative |
| `border-control` | 0.62 0.02 269 | #818693 | form-control edges | 3.64:1 on surface (UI component, needs 3:1) |
| `ink` | 0.25 0.035 269 | #1b2133 | body text, headings | 16.0:1 surface, 15.0:1 canvas |
| `ink-muted` | 0.46 0.03 269 | #515869 | secondary text, inactive nav | 7.1:1 surface, 6.7:1 canvas, 6.4:1 panel |
| `ink-faint` | 0.53 0.025 269 | #666c7b | meta text, placeholders, idle icons | 5.3:1 surface, 4.9:1 canvas, 4.7:1 panel |
| `on-brand` | 1 0 0 | #ffffff | text and icons on brand-600 and darker | see brand |

### Brand (periwinkle)

| Token | OKLCH | Hex | Role | Contrast |
|---|---|---|---|---|
| `brand-50` | 0.97 0.014 269 | #f1f5ff | icon circles, quiet hover | |
| `brand-100` | 0.935 0.03 269 | #e1e9fe | selected nav item, avatar tile | brand-800 text on it 7.4:1 |
| `brand-200` | 0.87 0.06 269 | #c4d3fd | pressed fill on tints, hover border | |
| `brand-400` | 0.7 0.13 269 | #7d9aef | reserved (charts, illustrations) | |
| `brand-500` | 0.635 0.155 269 | #6583e8 | the reference colour; decoration only | white on it 3.5:1, so never under text |
| `brand-600` | 0.56 0.15 269 | #516dcc | home header, primary buttons, focus ring | **white text 4.76:1** (passes AA at any size) |
| `brand-700` | 0.49 0.145 269 | #3f58b2 | button hover, links, active nav label, filter button | 6.5:1 on surface; white on it 6.5:1 |
| `brand-800` | 0.41 0.12 269 | #30448b | pressed, text on brand-100 | white on it 9.0:1 |
| `brand-900` | 0.32 0.09 269 | #202e60 | pressed on brand-700 | |

Why 600 and not the reference's own colour: the reference periwinkle (`brand-500`) gives white text only 3.5:1, which fails AA for normal text. `brand-600` is the same hue made a little deeper so the header's white text and the white button labels pass at every size.

`focus` defaults to `brand-600` (4.5:1 on canvas, 4.8:1 on surface). Containers on brand colour set `--color-focus` to `on-brand`, so the ring turns white on the blue header (4.8:1).

### Semantic states (text colour at 5:1 or better on its own surface)

| State | Text token | Surface token | Text on surface |
|---|---|---|---|
| success | `success` 0.5 0.11 155 (#1e7546) | `success-surface` 0.955 0.035 155 | 5.07:1 |
| warning | `warning` 0.52 0.11 65 (#935a11) | `warning-surface` 0.962 0.04 85 | 5.06:1 |
| danger | `danger` 0.52 0.17 25 (#b63132) | `danger-surface` 0.962 0.018 25 | 5.38:1 |
| info | `info` 0.5 0.1 235 (#136b94) | `info-surface` 0.958 0.022 235 | 5.25:1 |
| live | `live` 0.5 0.09 180 (#037465) | `live-surface` 0.955 0.03 180 | 5.05:1 |

Plus `live-dot` (0.6 0.11 175) for the pulsing dot and `rating` (0.7 0.15 70) for the star icon. Both are graphics next to text that carries the meaning (the word "Sedang berlangsung", the number "4,9"), so status is never shown by colour alone.

## 3. Typography

- **Family:** Plus Jakarta Sans (an Indonesian-designed typeface), loaded with `next/font/google` as the variable `--font-jakarta`. One family for everything; hierarchy comes from size and weight. Fallback: `ui-sans-serif, system-ui`.
- **Scale:** fixed rem steps, ratio about 1.125 to 1.2. Tailwind's default sizes are cleared and replaced with these:

| Token | Size / line height | Use |
|---|---|---|
| `text-xs` | 12 / 16 px | bottom-nav labels, badges, meta, category tiles |
| `text-sm` | 14 / 20 px | secondary text, buttons, sidebar items, empty-state body |
| `text-base` | 16 / 24 px | body, card titles, inputs (16 px stops iOS zooming) |
| `text-lg` | 18 / 26 px | section headings (h2), status title |
| `text-xl` | 20 / 28 px | reserved |
| `text-2xl` | 24 / 32 px | page titles (h1) on phones and back office |
| `text-3xl` | 28 / 36 px | home h1 on desktop |

- **Weights:** 400 body, 500 labels and nav, 600 headings, selected items and buttons, 700 page titles, prices and the wordmark.
- Headings use `text-wrap: balance` and `tracking-heading` (-0.012em). Prices use `tabular-nums`.
- Numbers follow Indonesian conventions through `src/lib/format.ts`: `Rp 150.000` (no decimals) and ratings with a decimal comma (`4,9`).

## 4. Components

All in `src/components/`. Every interactive element has hover, `:focus-visible` (one global 2 px ring, offset 2 px), active and (where it applies) disabled states, and a touch target of at least 44 px (`min-h-touch`).

- **Primary button** (`ui/button-link.tsx`): `brand-600` fill, white 14 px semibold label, `radius-md`, 44 px tall; hover `brand-700`, pressed `brand-800`. One primary action per card or screen. Secondary: white with `border`.
- **Bottom navigation** (`shell/bottom-nav.tsx`, phones): fixed, white, top border and a soft upward shadow, safe-area padding for the home indicator. Icon above an always-visible label. Current item: icon sits in a `brand-100` pill, label `brand-700` semibold, `aria-current="page"`.
- **Top navigation** (`shell/top-nav.tsx`, customer and cleaner from 768 px): wordmark left, sections right as icon plus label; current item has a `brand-100` fill.
- **Sidebar** (`shell/sidebar-shell.tsx`, agency and admin from 1024 px): 16 rem, `panel` background, wordmark plus a role badge, 14 px items; current item `brand-100` fill with `brand-800` text. No coloured side stripes.
- **Narrow back-office bar** (`shell/back-office-top-bar.tsx`, below 1024 px): wordmark, role badge and a "Menu" button (`aria-expanded`). The menu opens in the page flow (pushes content down, no overlay), closes on navigation and on Escape, and returns focus to the button.
- **Home header** (`customer/home-header.tsx`): `brand-600`, bottom corners `radius-xl` on phones (all corners on desktop). Holds the wordmark, the h1, the service-area picker (a native `<select>`) and the search field with a filter button. It is a real GET form to `/agencies`.
- **Job status card** (`customer/job-status-card.tsx`): the first thing under the header. Live indicator, status in plain words ("Petugas sudah check-in"), who and when, a privacy line ("Hanya Anda yang dapat menonton. Rekaman tersimpan 7 hari.") and one primary action ("Tonton langsung").
- **Service category tiles** (`customer/service-categories.tsx`): round `brand-50` icon tiles, four across, on phones; horizontal cards from 768 px.
- **Agency card** (`customer/agency-card.tsx`): initials tile, name, "Terverifikasi" (icon plus word), rating with review count, district, service chips, next free slot and "mulai dari Rp ...". The same facts sit in the same place on every card so agencies can be compared at a glance.
- **Live indicator** (`ui/live-indicator.tsx`): teal pill, slow 2.4 s breathing dot (static under reduced motion), always with a word.
- **Empty state** (`ui/empty-state.tsx`): icon in a `brand-50` circle, a plain title, one or two sentences that say what will appear and how. No "coming soon".
- **Page header** (`ui/page-header.tsx`): h1 at `text-2xl` bold, optional one-line description.
- **Role badge** (`shell/role-badge.tsx`): small bordered label ("Petugas", "Agensi", "Admin") next to the wordmark on staff shells.
- **Skip link** (`shell/skip-link.tsx`): first focusable element on every page, jumps to `#konten`.

## 5. Layout

- **Spacing:** 4 px base (Tailwind's numeric scale). Rhythm: 4 / 8 / 12 / 16 / 24 / 32 / 48. Named values: `gutter` 16 px (phones, with notch-safe `px-safe`), `gutter-wide` 32 px (desktop), `touch` 44 px, `bottom-nav` 64 px, `top-bar` 56 px, `sidebar` 256 px.
- **Widths:** `max-w-content` 60 rem for customer and cleaner pages; `max-w-dashboard` 76 rem for agency and admin; running text `max-w-prose` (65ch).
- **Breakpoints (Tailwind defaults):** below 768 px customer and cleaner use the bottom bar; from 768 px (`md`) a top bar. Agency and admin show the sidebar from 1024 px (`lg`) and the narrow bar with Menu below that.
- **Route groups:** `src/app/(customer)`, `(cleaner)/cleaner`, `(agency)/agency`, `(admin)/admin`, each with its shell in `layout.tsx`.
- Works from 360 px with no horizontal scroll (checked by `e2e/no-horizontal-scroll.mobile.spec.ts` on every page).
- **Radii:** `xs` 6 px badges, `sm` 8 px sidebar items and small tiles, `md` 12 px buttons and inputs, `lg` 16 px cards, `xl` 24 px home header, `full` pills and icon circles.

## 6. Depth and elevation

Few, soft shadows tinted with the ink hue; borders do most of the separating.

| Token | Use |
|---|---|
| `shadow-xs` | inputs on the header, desktop category cards |
| `shadow-card` | cards (with a 1 px `border`) |
| `shadow-raised` | floating things: skip link, future menus and toasts |
| `shadow-nav` | the bottom navigation's upward edge |

Layering scale (use as `z-(--z-nav)`): `sticky` 20, `nav` 30, `overlay` 40, `drawer` 50, `toast` 60, `tooltip` 70. No arbitrary z-index values.

Motion: 150 ms colour transitions with `ease-out-quart`, for state changes only. `prefers-reduced-motion` turns animations and transitions off.

## 7. Do and don't

**Do**
- Use tokens only (`bg-surface`, `text-ink-muted`, `rounded-md`). Raw colours and Tailwind's default palette do not compile.
- Put the current job state first, in plain words, before anything else.
- Pair every status colour with an icon or a word.
- Keep one primary (filled `brand-600`) action per card or screen.
- Keep each component's strings together in a `copy` object (T4 moves them into next-intl).
- Write Indonesian with formal "Anda", short sentences, verb plus object on buttons.
- Show full prices with `formatRupiah`, never a hand-typed "Rp".

**Don't**
- Put text on `brand-500` or lighter brand tints (contrast fails).
- Add promo banners, vouchers, countdown deals or decorative badges.
- Use red, REC dots or dark grids for live video; "live" is teal and calm.
- Use coloured side-stripe borders, gradient text, glass effects or decorative motion.
- Nest cards, or add a card where a list row would do.
- Hide content behind horizontal scroll on phones.

## 8. Design skill, reference and decisions

**Skill chosen: `impeccable`** (product register). It was picked over `design-taste-frontend` because it is built for product UI, app shells and dashboards rather than landing pages: it asks for state-rich semantic colour, fixed type scales, earned familiarity in navigation and complete interaction states, which is what HomeKlin's four shells need. `PRODUCT.md` is its brief. `ui-ux-pro-max` and `frontend-ui-engineering` were used as checklists for accessibility and responsive behaviour.

**Visual reference (customer side only):** a home-services app screen with a soft periwinkle header with rounded bottom corners, a location picker, a search field with a filter button, round service icons, provider cards with rating badges, a promo carousel and a five-item bottom bar. How it was adapted:

| In the reference | In HomeKlin | Why |
|---|---|---|
| Periwinkle header, rounded bottom | Kept; deepened from `brand-500` to `brand-600` | white text must pass AA |
| Location picker | Service-area picker ("Jakarta Selatan") | area is a catalog filter in the spec |
| Search plus filter button | Kept; submits to the agency list | customers start by choosing an agency |
| Round service icons | Pembersihan Rutin, Deep Cleaning, Sofa & Karpet, Dapur & Kamar Mandi | the four service types |
| "Popular service provider" cards | Agency cards built for comparison | choosing between agencies is the core task |
| "#SpecialForYou" promo carousel | Removed; replaced by the current-job status card | promo banners are an anti-reference; job status comes first |
| Bottom bar (Home, Explore, Bookmark, Chat, Profile) | Beranda, Agensi, Pesanan, Bantuan, Akun | HomeKlin's sections |

The agency and admin side does not follow the reference: same tokens and font, but a calm, dense desktop layout with a sidebar.

**Decisions to review**
- The home h1 is the task ("Pilih agensi kebersihan di area Anda"); the name "HomeKlin" is the wordmark above it.
- The customer side gets a top bar from 768 px instead of a phone column centred on a wide screen, because customers also book from laptops (Quality Plan compatibility list).
- The home preview uses fictional sample data (`src/components/customer/home-preview-data.ts`) and says so in a one-line note at the bottom of the page, because the site is public.
- Cleaner pages show a slim "HomeKlin · Petugas" bar on phones so a cleaner always knows which mode they are in.

## 9. Screenshots

`npm run screenshots -- t3` rebuilds the app and saves `docs/screenshots/t3/<page>-<width>.png` (whole page, fixed bars at their real place) and, for phones, `<page>-<width>-fold.png` (the first screen as it opens), for `/`, `/cleaner`, `/agency` and `/admin` at 360, 390, 1280 and 1440 px. It is kept out of `npm run test:e2e` so a normal test run never overwrites an earlier task's evidence.
