# HomeKlin Design System

The visual rules for every HomeKlin screen. The tokens live in `src/app/globals.css` (Tailwind v4 `@theme`); this file explains them and how to use them. Brand brief: `PRODUCT.md`. Business model: one brand to the customer (`SPEC.md`, decisions of 2026-10-18).

Rewritten in T3b (2026-10-18) with the `design-taste-frontend` skill, as a "Redesign - Overhaul" of the T3 visuals (the T3 version is in git history). Screenshots: `docs/screenshots/t3b/` (before: `docs/screenshots/t3/`).

## 1. Visual theme and atmosphere

**Design read, landing page (`/`):** a landing page for a single-brand home-cleaning service, for Indonesian city households deciding whether to let a cleaner into their home, with a calm, trust-first, plain-facts language, leaning toward Tailwind v4 tokens, a friendly grotesque display face over a clean text face, real home photography and restrained CSS-only motion.

**Design read, customer app (`/home`, `/services`, ...):** a mobile-first booking app for the same customers on a mid-range Android phone, with a status-first "is my home OK?" language, leaning toward familiar app patterns (bottom bar, list rows, one primary action per screen), the same tokens at a tighter rhythm, and near-static motion.

What that means on screen:
- **HomeKlin is the only brand.** Every customer page speaks as one cleaning company: HomeKlin's services, HomeKlin's prices, a "Petugas HomeKlin" with a name and a face. Partner agencies never appear on a customer page.
- **Evergreen on a cool off-white.** One brand colour, a deep calm green, carries primary actions, the current selection and "live". Everything else is a green-tinted off-white and green-black ink. No gradients, no glass, no glow.
- **Real homes, real people.** Warm, daylight photos of a cleaner working in a bright home. Photos are content, never decoration behind text.
- **Facts over decoration.** Full prices, real free slots, what happens next, who can watch. No promo banners, vouchers, badges, review counts or claims the product cannot back up.
- **Two densities, one vocabulary.** The landing page breathes; the app is tighter and touch-first; agency and admin back offices are dense desktop tools. Same colours, type, radii and words.
- **Light theme only** (user decision, 2026-10-18). A parent checks on their home from a phone in daylight; agency staff work at desks in lit rooms. There is no dark-mode token set; the taste skill's dark-mode requirement is "N/A by user decision".
- **Live video is reassuring, not CCTV.** "Live" is a slow green breathing dot next to words. Never a red REC dot, never a dark control-room grid.

### Dials (taste skill Section 1)

| Surface | DESIGN_VARIANCE | MOTION_INTENSITY | VISUAL_DENSITY | Why |
|---|---|---|---|---|
| Landing `/` | 5 | 4 | 4 | The skill's trust-first preset is 3-4 / 2-3 / 4-5 and its landing default is 7 / 6 / 4. `PRODUCT.md` says "trustworthy, calm, clear" and "calm is not lifeless", and the user found T3 too generic, so variance sits one step above trust-first (an asymmetric split hero, an offset bento, a timeline) while motion stays low: one hero entry, press feedback, the live dot. No scroll hijack, parallax or marquee. |
| Customer app | 3 | 3 | 5 | A product surface used one-handed: predictable layout, familiar patterns, motion only as feedback for state changes. |
| Agency and admin | 2 | 2 | 7 | Desktop tools; unchanged from T3 apart from the new tokens. |

## 2. Colour palette and roles

All colours are OKLCH at hue 165 (evergreen). Contrast ratios are WCAG 2.x, computed from the token values. Tailwind's default palette is cleared, so these are the only colours that exist in components.

**Why the periwinkle went:** blue-violet sits in the "AI lilac/blue" family the taste skill names as the most common default, and it is what made T3 look like every home-services template, including the reference screenshot it was copied from. Evergreen reads as clean, fresh and safe, is rare among Indonesian cleaning and super-app brands, sits well next to the warm wood and skin tones in the photos, and keeps "go/safe" connotations without the hype of a bright lime.

### Neutrals (tinted toward the brand hue; cool, not cream)

| Token | OKLCH | Hex | Role | Contrast |
|---|---|---|---|---|
| `canvas` | 0.982 0.005 165 | #f6faf8 | page background | |
| `surface` | 0.997 0.002 165 | #fdfefe | cards, bars, inputs (off-white, never pure #fff) | |
| `surface-sunken` | 0.958 0.009 165 | #ecf3f0 | chips, hover fill on surface, timeline track | |
| `panel` | 0.966 0.008 165 | #eff6f2 | back-office sidebar, landing footer | |
| `border` | 0.91 0.012 165 | #dae4df | dividers, card edges | decorative |
| `border-control` | 0.6 0.02 165 | #76847d | form-control edges, secondary-button edge | 3.9:1 on surface (UI component, needs 3:1) |
| `ink` | 0.24 0.025 165 | #14231c | headings, body text | 16.2:1 surface, 15.5:1 canvas |
| `ink-muted` | 0.44 0.02 165 | #495650 | paragraphs on the landing, secondary text, inactive nav | 7.6:1 surface, 7.3:1 canvas, 6.8:1 sunken |
| `ink-faint` | 0.52 0.018 165 | #606c66 | meta, placeholders, idle icons | 5.4:1 surface, 5.2:1 canvas, 5.0:1 panel, 4.8:1 sunken |
| `on-brand` | 0.995 0.003 165 | #fbfefc | text and icons on brand-600 and darker | see below |

### Brand (evergreen)

| Token | OKLCH | Hex | Role | Contrast |
|---|---|---|---|---|
| `brand-50` | 0.968 0.02 165 | #e9f9f1 | live pill, icon circles, tinted panels (safety, CTA band) | brand-700 text on it 7.1:1 |
| `brand-100` | 0.935 0.04 165 | #d2f3e3 | selected nav item, pressed tint | brand-800 text on it 8.8:1 |
| `brand-200` | 0.875 0.065 165 | #aee4cb | hover border on tints | |
| `brand-300` | 0.79 0.09 165 | #81cdac | timeline line, decorative strokes | |
| `brand-500` | 0.6 0.11 165 | #2d9570 | live dot, decoration only | white on it 3.7:1, so never under text |
| `brand-600` | 0.5 0.095 165 | #1c7456 | primary buttons, focus ring, links on tints | **white text 5.7:1**; 5.7:1 on surface |
| `brand-700` | 0.43 0.082 165 | #145e44 | button hover, text links, active nav label, live text | 7.7:1 on surface; white on it 7.8:1 |
| `brand-800` | 0.36 0.068 165 | #0e4834 | pressed, text on brand-100 | white on it 10.5:1 |
| `brand-900` | 0.29 0.05 165 | #0d3325 | pressed on brand-700 | |

`focus` is `brand-600` (5.4:1 on canvas). Containers on brand colour set `--color-focus` to `on-brand`.

**One accent, locked.** Evergreen is the only accent on every page. The `rating` amber (0.7 0.15 70) exists only for the star icon in reviews (T30) and is never used for buttons, links or backgrounds.

### Semantic states (text at 5:1 or better on its own surface)

| State | Text token | Surface token | Text on surface |
|---|---|---|---|
| success | `success` 0.5 0.11 150 (#2b7440) | `success-surface` 0.955 0.035 150 | 5.06:1 |
| warning | `warning` 0.52 0.11 65 (#935a11) | `warning-surface` 0.962 0.04 85 | 5.08:1 |
| danger | `danger` 0.52 0.17 25 (#b63132) | `danger-surface` 0.962 0.018 25 | 5.35:1 |
| info | `info` 0.5 0.1 235 (#136b94) | `info-surface` 0.958 0.022 235 | 5.23:1 |
| live | `live` = brand-700 | `live-surface` = brand-50, dot `live-dot` = brand-500 | 7.1:1 |

"Live" uses the brand green on purpose: watching your home is the reassuring core of the product, not an alarm. Status is never shown by colour alone: every state has a word ("Sedang berlangsung") and usually an icon.

## 3. Typography

Two families, both through `next/font/google`:

- **Display: Bricolage Grotesque** (variable: weight 200-800, optical size 12-96, width 75-100), CSS variable `--font-bricolage`, token `font-display`. A grotesque with a little warmth and character at large sizes; it gives HomeKlin a recognisable voice without the "creative serif" cliché. Used for h1 and h2, the wordmark, and large prices on the landing. Weight 600; optical sizing automatic.
- **Text: Figtree** (variable: weight 300-900), CSS variable `--font-figtree`, token `font-sans` (the default). Friendly, open and very legible at 14-16 px on a phone, with Latin Extended for Indonesian names. Used for everything else: body, nav, buttons, labels, inputs.
- Not Inter (taste-skill default ban), not Fraunces or Instrument Serif, and not Plus Jakarta Sans any more (part of the T3 look the user found generic).
- Emphasis inside a headline uses weight or colour of the same family, never a second family.

**Scale** (fixed rem steps; Tailwind's default sizes are cleared):

| Token | Size / line height | Use |
|---|---|---|
| `text-xs` | 12 / 16 px | bottom-nav labels, badges, meta |
| `text-sm` | 14 / 20 px | secondary text, buttons, sidebar items |
| `text-base` | 16 / 24 px | body, card titles, inputs (16 px stops iOS zoom) |
| `text-lg` | 18 / 28 px | landing body lead, list-row titles |
| `text-xl` | 20 / 28 px | h3 on the landing, app section headings |
| `text-2xl` | 24 / 30 px | app page titles (h1), back-office h1 |
| `text-3xl` | 30 / 36 px | landing h2 on phones, app h1 on desktop |
| `text-4xl` | 36 / 40 px | landing h1 on phones, landing h2 on desktop |
| `text-5xl` | 48 / 52 px | landing h1 on tablets and from 1280 px |
| `text-6xl` | 56 / 60 px | reserved; not used by the hero |

- **Hero headline:** `text-4xl md:text-5xl lg:text-4xl xl:text-5xl`. The 52-character headline takes three lines at 56 px on every desktop width, and at 48 px on a 1024 px screen, so it steps down at `lg` and back up at `xl`. `e2e/landing.desktop.spec.ts` fails if it wraps to more than two lines at 1024, 1280 or 1440 px.
- Display sizes (`text-3xl` and up) use `tracking-display` (-0.02em) and the line height from the scale above (48/52, not `leading-tight`, which would loosen them); text sizes use `tracking-normal`. Headings use `text-wrap: balance`, paragraphs `text-wrap: pretty`.
- Running text is at most 65 characters wide (`max-w-prose`).
- Weights: Figtree 400 body, 500 labels and nav, 600 buttons and selected items; Bricolage 600 headings and prices, 700 the wordmark.
- Prices use `tabular-nums` and `formatRupiah` (`Rp 85.000`).

## 4. Components

All in `src/components/`. Every interactive element has hover, `:focus-visible` (one global 2 px ring, offset 2 px), active (`scale-[0.98]` press on buttons) and, where it applies, disabled states, and a touch target of at least 44 px (`min-h-touch`). Icons: `lucide-react` only, default stroke width 2 everywhere (the wordmark's house uses 2.5).

**Shared**
- **Button and button link** (`ui/button-link.tsx`): pill (`rounded-full`). Primary: `brand-600` fill, `on-brand` label, hover `brand-700`, pressed `brand-800`. Secondary: `surface` with a `border-control` edge, `ink` label. Sizes: `md` 44 px (app), `lg` 52 px (landing hero and CTA band). Labels are verbs and never wrap at desktop.
- **Wordmark** (`brand/wordmark.tsx`): same structure as T3 (house mark plus "HomeKlin"), now in the display face and evergreen.
- **Live indicator** (`ui/live-indicator.tsx`): `live-surface` pill, `live` text, a 2.4 s breathing `live-dot` (static under reduced motion), always with a word.
- **Empty state** (`ui/empty-state.tsx`): icon in a `brand-50` circle, a plain title, one or two sentences on what will appear and how. `rounded-xl`, dashed `border`.
- **Page header** (`ui/page-header.tsx`): h1 in the display face, optional one-line description. `size="large"` (customer pages) grows the h1 to `text-3xl` from `md`; the back office keeps `text-2xl`.
- **Sample-data note** (`ui/sample-note.tsx`) and **no-break** (`ui/no-break.tsx`, keeps "check-in" from splitting at its hyphen).
- **Navigation data** lives in `shell/app-navigation.ts` (customer, cleaner) and `shell/back-office-navigation.ts` (agency, admin); `shell/navigation.ts` re-exports both for server code and tests. Client components import only their own module, so the customer app's JavaScript never carries agency menu labels or routes (a unit test guards this).
- **Skip link** (`shell/skip-link.tsx`): first focusable element on every page, including the landing.

**Landing page** (`src/components/marketing/`, route group `src/app/(marketing)`, no app navigation)
- **Header:** wordmark left; from `lg` the in-page links Layanan, Cara kerja, Keamanan and the Bantuan page; the primary "Pesan sekarang" pill on the right (also on phones). One line, 64 px tall.
- **Hero:** asymmetric split, text 7 of 12 columns, photo 5 of 12 (`rounded-xl`, preloaded with `next/image`). At most four text elements: h1, one sentence of subtext (20 words or fewer), the primary "Pesan sekarang" and one quiet secondary link to the price list. No eyebrow, no trust strip. On phones the text comes first and the CTA is visible without scrolling; the photo follows.
- **Services and prices:** a bento of exactly four cells (one per service) on a 12-column grid in a 7/5 then 5/7 rhythm, each with its photo on top, name, one line, duration and "mulai dari Rp ..."; a single note under the grid says the prices are samples. Each cell is one link to `/services` (the name's link is stretched over the cell), which is what the photo zoom on hover gives feedback for. One column on phones.
- **How it works:** an ordered timeline of five verbs (Pesan, Bayar, Petugas check-in, Tonton langsung, Putar ulang 7 hari), horizontal with a `brand-300` line from `lg`, vertical below. No "Step 1" labels; the verb is the label.
- **Safety and privacy:** a split on a `brand-50` panel: a real, live-rendered job status card (the same component as the app, with sample data and an h3 heading here) beside four plain facts with icons. A visible caption under the card ("Contoh tampilan pesanan berjalan di aplikasi HomeKlin.") says it is an example. Not a fake screenshot.
- **FAQ teaser** (`#pertanyaan`): four native `<details>` questions and a link to `/support`.
- **CTA band** (`#pesan`): one sentence and the same "Pesan sekarang" (one label per intent, everywhere).
- **Footer:** `panel` background, wordmark, links to existing pages only, a line saying prices and data are samples.

**Customer app** (route group `src/app/(customer)`, home at `/home`)
- **Bottom navigation** (phones): Beranda `/home`, Layanan `/services`, Pesanan `/orders`, Bantuan `/support`, Akun `/account`. Fixed, `surface`, top `border` and `shadow-nav`, safe-area padding; icon above an always-visible label; current item in a `brand-100` pill with a `brand-700` label and `aria-current="page"`.
- **Top navigation** (from 768 px): wordmark (links to `/home`) and the same five sections; current item `brand-100` pill.
- **Area picker** (`customer/area-picker.tsx`): a native `<select>` styled as a pill with a map-pin icon and a visible "Area layanan" label beside it. It decides which free slots are shown (wired in T8).
- **Sample data** (`customer/home-preview-data.ts`): the one source of fictional services, prices, slots, cleaner and job for the landing and the app. Photos are `{ src, width, height, alt, focus? }` objects pointing at `/images/...` (not static imports, which Vitest cannot load from `public/`); a unit test checks every file exists.
- **Job status card** (`customer/job-status-card.tsx`): the first content block on `/home`. Live indicator, status in plain words, the assigned cleaner as "Petugas HomeKlin" with name and round photo, service and time, the privacy line, and one primary "Tonton langsung".
- **Service row** (home) and **service card** (`/services`): photo thumbnail (`rounded-md`) or photo header, name, "mulai dari" price, duration, the next free slot in the chosen area. The same facts in the same place on every item.
- **Sample-data note:** one small line with an info icon at the bottom of pages that show sample data.

**Back office** (agency and admin): the T3 sidebar shell, top bar and menu, unchanged in structure, on the new tokens and radii.

## 5. Layout

- **Spacing:** 4 px base (Tailwind's numeric scale). Rhythm 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96. Named values: `gutter` 16 px (phones, notch-safe `px-safe`), `gutter-wide` 32 px (desktop), `touch` 44 px, `bottom-nav` 64 px, `top-bar` 56 px, `sidebar` 256 px.
- **Landing rhythm:** sections `py-16` on phones, `py-24` from `lg`. Hero top padding at most `pt-24`; the hero fits the first viewport (`min-h-[calc(100dvh-4rem)]` from `lg`, never `h-screen`).
- **Widths:** `max-w-page` 76 rem for the landing, `max-w-content` 60 rem for customer and cleaner pages, `max-w-dashboard` 76 rem for agency and admin, running text `max-w-prose` (65ch).
- **Breakpoints (Tailwind defaults):** every multi-column landing section collapses to one column below 768 px, declared in the same component. Customer and cleaner use the bottom bar below 768 px and the top bar from 768 px; agency and admin show the sidebar from 1024 px.
- **Route groups:** `src/app/(marketing)` (landing), `(customer)` (app, home at `/home`), `(cleaner)/cleaner`, `(agency)/agency`, `(admin)/admin`, each with its shell in `layout.tsx`.
- Works from 360 px with no horizontal scroll (`e2e/no-horizontal-scroll.mobile.spec.ts` covers every page).
- **Radii, one documented rule:** everything interactive is a pill (`rounded-full`: buttons, inputs, selects, chips, nav items, badges, avatars); every container is 20 px (`rounded-xl`: cards, photos, panels, empty states); anything nested inside a container is 12 px (`rounded-md`: thumbnails, inner tiles). No other radii exist.

## 6. Depth and elevation

Mostly flat: tonal surfaces (`canvas` behind `surface`) and 1 px `border` do the separating. Shadows are few, soft and tinted with the ink hue (165), never black.

| Token | Use |
|---|---|
| `shadow-card` | raised cards on canvas (job status card, service cards) |
| `shadow-raised` | floating things: skip link, the job card on the landing's safety panel |
| `shadow-nav` | the bottom navigation's upward edge |

Layering scale (use as `z-(--z-nav)`): `sticky` 20, `nav` 30, `overlay` 40, `drawer` 50, `toast` 60, `tooltip` 70. No arbitrary z-index values.

**Motion (CSS only; no animation library):**
- Colour and border changes: 150 ms, `ease-out-quart`.
- Press feedback on buttons and links that look like buttons: `active:scale-[0.98]` (feedback).
- Landing hero entry: the headline, subtext and CTAs rise 12 px and fade in once, 500 ms, staggered by 80 ms (`animate-rise` plus `animate-delay-80` / `animate-delay-160`), to set reading order (hierarchy). The hero photo is not animated, so it never delays the largest paint.
- Service photos on the landing scale to 1.03 inside their frame on hover (feedback).
- The live dot breathes (state).
- Nothing else moves: no scroll-triggered reveals, no marquee, no parallax. `prefers-reduced-motion: reduce` turns every animation and transition off.

## 7. Do and don't

**Do**
- Speak as HomeKlin on every customer page: "Petugas HomeKlin", "layanan HomeKlin", "harga HomeKlin".
- Use tokens only (`bg-surface`, `text-ink-muted`, `rounded-xl`). Raw colours and Tailwind's default palette do not compile.
- Put the current job state first on `/home`, in plain words.
- Pair every status colour with a word or an icon.
- Keep one primary (filled `brand-600`) action per card or screen, and one label per intent across a page ("Pesan sekarang" everywhere).
- Keep each component's strings together in a `copy` object (T4 moves them into next-intl).
- Write Indonesian with formal "Anda", short sentences, verb plus object on buttons.
- Show full prices with `formatRupiah`, and mark sample prices as samples.
- Use the real component (with sample data) when the landing needs to show the product.

**Don't**
- Show, name or hint at a partner agency on a customer page: no agency lists, cards, names, ratings, "verified agency" badges or "our partners" copy. An e2e test fails the build if a customer page contains "agensi", "agency" or "mitra".
- Use em dashes or en dashes in any visible text; use a hyphen, a comma or two sentences.
- Put text on `brand-500` or lighter brand tints.
- Add promo banners, vouchers, countdown deals, review counts, press logos or claims beyond `SPEC.md`.
- Use red, REC dots or dark grids for live video.
- Overlay pills or labels on photos, or caption stock photos as if they were our staff.
- Build fake screenshots out of divs, or use gradients, glass, glows or gradient text.
- Use section numbers or eyebrows above every heading (at most one eyebrow per three sections).
- Nest cards, or add a card where a list row would do.

## 8. References, decisions and the design skill

**Skill:** `design-taste-frontend` (taste skill), for the landing page and the redesign, including its Section 14 pre-flight. `frontend-ui-engineering` for accessibility and responsive behaviour. T3 used `impeccable`; its accessibility wins (AA contrast, focus ring, 44 px targets, reduced motion, skip link, fixed type scale) are kept.

**References** (researched 2026-10-18; single-brand cleaning companies plus one trust-first consumer service; no marketplaces). The fetches returned page text, not styles, so what was borrowed is patterns and wording, not colours.

| Reference | What was borrowed | What was left out |
|---|---|---|
| [MyClean](https://www.myclean.com/) (New York; one company, own staff) | A flat "starting at" price per service right on the landing page ("Book from $92"; "Standard $92/visit") became "mulai dari Rp ..." on every service; the plain "No hidden fees, ever." promise; short, declarative copy. | Claims HomeKlin cannot make (employees, insurance, guarantee, review counts, press logos). |
| [Fantastic Services](https://www.fantasticservices.com/cleaning/) (UK; one brand, in-house cleaners) | Photography of a cleaner at work in a real home; a short, plain "how it works" sequence. | Deal tags ("£10 OFF") and several CTA labels for the same intent (promo noise is a `PRODUCT.md` anti-reference). |
| [KliknClean](https://www.kliknclean.com/) (Indonesia; one operator, "Helper KliknClean") | The CTA label "Pesan Sekarang" that Indonesian customers already know; "mulai dari Rp .../jam" price wording; naming staff with the brand ("Helper KliknClean" became "Petugas HomeKlin"); steps written as verbs (Pilih Layanan, Lakukan Pembayaran). | Trust labels with no facts behind them ("Terpercaya", "Berkualitas"), the partner-logo wall, WhatsApp and app-store detours. |
| [Justlife](https://www.justlife.com/en-AE/house-cleaning) (UAE; one brand that picks the professional) | The customer never chooses a provider ("You do not have to worry about picking a professional, as we will take care of it"), which is exactly HomeKlin's automatic routing; booking starts with location, then service, then slots, so `/home` starts with the area picker. | "Super app" framing and rating badges. |
| [Wise](https://wise.com/) and [Wise pricing](https://wise.com/pricing/) (trust-first consumer service) | A short hero (five-word headline, one CTA); price shown upfront as the full amount ("you always know exactly what to pay upfront"); safety stated as plain facts in its own block ("Safe at every step"). | The calculator widget and the bright lime accent. |

**Photos:** free stock photos (Pexels and Unsplash licences) in `public/images/`, chosen for Asian cleaners in bright homes with no visible brand logos; sources, authors and licences in `docs/image-sources.md`. Two candidates were rejected for visible brands (product bottles, a cartoon T-shirt).

**Decisions to review**
- The hero headline states what HomeKlin is in one sentence ("Jasa kebersihan rumah yang bisa Anda tonton langsung") rather than a slogan.
- `SPEC.md` lets admin watch every live feed and an agency watch its own cleaners, so the copy says the live view is for "Anda dan tim pemantau HomeKlin", not "only you". This keeps the landing inside `SPEC.md`; the agency stays invisible because, to the customer, its staff are part of HomeKlin.
- The sample cleaner is a stock photo with an invented name, labelled as sample data, until T28 assigns real cleaners.

## 9. Screenshots

`npm run screenshots -- t3b` rebuilds the app and saves `docs/screenshots/t3b/<page>-<width>.png` (whole page, fixed bars at their real place) and, for phones, `<page>-<width>-fold.png` (the first screen as it opens), at 360, 390, 1280 and 1440 px. It is kept out of `npm run test:e2e` so a normal run never overwrites an earlier task's evidence (`docs/screenshots/t3/` is the "before").
