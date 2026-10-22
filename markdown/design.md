---
name: HomeKlin
description: A calm, trustworthy home-cleaning system pairing deep forest green with one electric lime action colour on a warm cream canvas, with italic serif accent words set into tight grotesk headlines. Soft-bento cards, alternating dark-green bands, and a reassuring live-job status card at its centre.
colors:
  # Core brand
  primary: "#1B3D2B"              # Deep forest green: primary buttons, selected cards, the job status card, active toggles
  on-primary: "#FFFFFF"           # 12.0:1 on primary
  primary-container: "#22513A"    # Lifted green: booking/CTA shell, job status card on the customer home
  on-primary-container: "#F3F2EA" # 8.1:1 on primary-container
  secondary: "#D8EF6B"            # Electric lime: THE action colour (one per viewport), icon circles, highlight blob. Never a text colour on light surfaces
  on-secondary: "#14271C"         # 12.3:1 on secondary
  secondary-container: "#E6EDC8"  # Lime wash: quiet bands, icon wells, FAQ toggle, active bottom-nav pill, "Contoh" sample label
  on-secondary-container: "#1B3D2B" # 9.9:1 on secondary-container
  tertiary: "#2F7A55"             # Mint: check icons, progress/status graphics, white text on it 5.2:1 (the reference #3C8A64 was only 4.2:1)
  on-tertiary: "#FFFFFF"
  tertiary-bright: "#3C8A64"      # The breathing live dot only. Graphic, always next to a word; never under text
  # Surfaces
  surface: "#F3F2EA"              # Warm cream page background
  surface-dim: "#ECEBE2"          # Section separators, sunken chips, table header fill
  surface-container-lowest: "#FFFFFF"  # Cards, nav pills, FAQ rows, tables, form panel
  surface-container-low: "#F7F6F0"     # Input fill inside a white panel
  surface-container: "#ECEBE2"
  surface-container-high: "#24443A"    # Step cards and active sidebar item on a dark band
  on-surface: "#14271C"           # Headings and body text: 14.0:1 on surface
  on-surface-variant: "#55625A"   # Secondary text, captions: 5.7:1 on surface, 5.35:1 on surface-dim (reference #5E6A62 was 4.7:1 on dim)
  inverse-surface: "#132A1F"      # Dark bands, footer, back-office sidebar
  inverse-on-surface: "#F3F2EA"   # 13.6:1 on inverse-surface
  inverse-on-surface-variant: "#B3C4B8"  # Muted text on dark: 8.3:1 on inverse-surface, 5.9:1 on surface-container-high (reference #9DB0A4 was 4.7:1)
  # Lines
  outline: "#1B3D2B"              # Outline buttons and circular icon buttons (10.7:1)
  outline-control: "#7A877E"      # Edge of every input, select and toggle track: 3.7:1 on white, 3.5:1 on surface-container-low (WCAG 1.4.11 needs 3:1)
  outline-variant: "#E2E2D8"      # Decorative hairlines only (card edges, row dividers). Never the only edge of a control
  # Feedback (text colour plus a tinted container; each pair is 5:1 or better)
  error: "#B5381F"
  on-error: "#FFFFFF"
  error-container: "#FBEAE6"
  success: "#276B49"
  success-container: "#E4F3EA"
  warning: "#8A5A00"
  warning-container: "#FFF3D6"
  info: "#185A85"
  info-container: "#E3F0F8"
  rating: "#E2B93B"               # The star icon in reviews (T30) only; the number beside it carries the meaning, in on-surface
  wordmark-ghost: "#24503A"       # Oversized footer wordmark, tone-on-tone over inverse-surface. Decorative, aria-hidden

typography:
  display-lg:
    fontFamily: "Inter Tight"     # Hero h1, landing only. Lowered from the reference's 72px so Indonesian copy fits three lines in a 6-column text block
    fontSize: 64px
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: -0.045em
  display-accent:
    fontFamily: "Instrument Serif"
    fontSize: 70px                # About 10% above the grotesk so the x-heights match
    fontWeight: 400
    fontStyle: italic
    lineHeight: 1.0
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: "Inter Tight"     # Landing h2
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -0.035em
  headline-accent:
    fontFamily: "Instrument Serif"
    fontSize: 52px
    fontWeight: 400
    fontStyle: italic
    lineHeight: 1.05
    letterSpacing: -0.015em
  headline-md:
    fontFamily: "Inter Tight"     # App page title (h1) on desktop, back-office h1 is title-lg
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.03em
  fact:
    fontFamily: "Inter Tight"     # Fact chip figure ("7 hari")
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.0
    letterSpacing: -0.03em
  price:
    fontFamily: "Inter Tight"     # Prices on service cards. Always tabular-nums and formatRupiah. 24px (not 32) so "Rp 250.000" and the duration share one line in a 265px card
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.0
    letterSpacing: -0.03em
  title-lg:
    fontFamily: "Inter Tight"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.015em
  title-md:
    fontFamily: "Inter Tight"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.01em
  card-index:
    fontFamily: "Instrument Serif"  # Italic numerals "01" to "04" on landing service cards only
    fontSize: 28px
    fontWeight: 400
    fontStyle: italic
    lineHeight: 1.0
    letterSpacing: 0em
  body-lg:
    fontFamily: "Inter"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: -0.005em
  body-md:
    fontFamily: "Inter"           # Default text size in the apps
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0em
  body-sm:
    fontFamily: "Inter"
    fontSize: 14px                # Raised from the reference's 13px: inputs and meta stay legible on a mid-range phone
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  label-md:
    fontFamily: "Inter"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.005em
  label-sm:
    fontFamily: "Inter"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0em
  eyebrow:
    fontFamily: "Inter"           # At most one per three landing sections
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.1em
    textTransform: uppercase

rounded:
  sm: 8px        # Inputs, small tags, icon wells, table cells' chips
  md: 14px       # Status card, fact chips, FAQ rows, nested thumbnails
  lg: 20px       # Service cards, step cards, panels, empty states
  xl: 28px       # Hero photo frame, CTA shell, section bands
  full: 9999px   # Buttons, toggles, pills, avatars, circular icon buttons

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  3xl: 120px             # Landing vertical section padding from 1280px; 96px at 768px, 64px on phones
  container: 1280px      # Landing max width (a 1440px canvas leaves 80px gutters)
  gutter: 80px           # Landing desktop side margin; 32px from 768px, 16px (notch-safe) on phones
  grid-gap: 20px         # Card grid gap
  touch: 44px            # Minimum touch target
  bottom-nav: 64px       # Customer and cleaner bottom navigation, before the safe-area inset
  top-bar: 44px          # Landing utility bar (desktop only). 44px, not the reference's 36px, so its link is a full touch target
  sidebar: 256px         # Back-office sidebar

shadows:
  none: "none"           # Default: white cards on cream separate by contrast, not shadow
  float: "0 16px 40px rgba(20, 39, 28, 0.10)"      # The status card floating over the hero photo
  card-hover: "0 10px 28px rgba(20, 39, 28, 0.08)" # Service card on hover and focus-within
  nav: "0 -1px 12px rgba(20, 39, 28, 0.06)"        # Upward edge of the bottom navigation

components:
  top-bar:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-on-surface}"
    typography: "{typography.label-sm}"
    height: 44px
  nav-link:
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "10px 10px 10px 20px"
    height: 44px
  button-primary-icon:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.full}"
    size: 24px
  button-accent:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "14px 28px"
    height: 52px
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    borderColor: "{colors.outline}"
    borderWidth: 1.5px
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    height: 44px
  button-icon-circle:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    borderColor: "{colors.outline}"
    borderWidth: 1.5px
    rounded: "{rounded.full}"
    size: 44px
  badge-live:
    backgroundColor: "{colors.success-container}"
    textColor: "{colors.success}"
    dotColor: "{colors.tertiary-bright}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  badge-live-on-dark:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.secondary}"
    dotColor: "{colors.secondary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  badge-sample:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  segmented-toggle:
    backgroundColor: "{colors.surface-container-lowest}"
    borderColor: "{colors.outline-control}"
    activeBackgroundColor: "{colors.primary}"
    activeTextColor: "{colors.on-primary}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 4px
    height: 44px
  service-card:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    mutedTextColor: "{colors.on-surface-variant}"
    rounded: "{rounded.lg}"
    padding: 10px
  service-card-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    accentColor: "{colors.secondary}"
    rounded: "{rounded.lg}"
    padding: 10px
  fact-chip-dark:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.secondary}"
    mutedTextColor: "{colors.inverse-on-surface-variant}"
    typography: "{typography.fact}"
    rounded: "{rounded.md}"
    padding: "20px 24px"
  fact-chip-light:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    mutedTextColor: "{colors.on-surface-variant}"
    typography: "{typography.fact}"
    rounded: "{rounded.md}"
    padding: "20px 24px"
  status-card:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    mutedTextColor: "{colors.on-surface-variant}"
    rounded: "{rounded.md}"
    padding: 16px
    shadow: "{shadows.float}"
  status-card-hero:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    accentColor: "{colors.secondary}"
    rounded: "{rounded.lg}"
    padding: 20px
  icon-well:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    size: 32px
  icon-well-on-dark:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.sm}"
    size: 40px
  step-card:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.inverse-on-surface}"
    mutedTextColor: "{colors.inverse-on-surface-variant}"
    borderColor: "rgba(243, 242, 234, 0.08)"
    rounded: "{rounded.lg}"
    padding: 24px
  safety-panel:
    backgroundColor: "{colors.secondary}"           # Full lime, not the wash: lime-wash on cream is 1.08:1, so the panel vanished
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.lg}"
    padding: 32px
  review-card:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    starColor: "{colors.rating}"
    rounded: "{rounded.md}"
    padding: 24px
  cta-shell:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.xl}"
    padding: 56px
  form-panel:
    backgroundColor: "{colors.surface-container-lowest}"
    rounded: "{rounded.lg}"
    padding: 32px
  input-field:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.on-surface}"
    placeholderColor: "{colors.on-surface-variant}"
    borderColor: "{colors.outline-control}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    height: 44px
    padding: "0 14px"
  input-field-error:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.on-surface}"
    borderColor: "{colors.error}"
    rounded: "{rounded.sm}"
    height: 44px
  button-submit:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    height: 48px
  faq-item:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "20px 24px"
  faq-toggle-closed:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    size: 24px
  faq-toggle-open:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-on-surface}"
    rounded: "{rounded.full}"
    size: 24px
  bottom-nav:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface-variant}"
    activeBackgroundColor: "{colors.secondary-container}"
    activeTextColor: "{colors.on-secondary-container}"
    typography: "{typography.label-sm}"
    shadow: "{shadows.nav}"
    height: 64px
  sidebar:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-on-surface-variant}"
    activeBackgroundColor: "{colors.surface-container-high}"
    activeTextColor: "{colors.secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    width: 256px
  data-table:
    backgroundColor: "{colors.surface-container-lowest}"
    headerBackgroundColor: "{colors.surface-dim}"
    textColor: "{colors.on-surface}"
    mutedTextColor: "{colors.on-surface-variant}"
    borderColor: "{colors.outline-variant}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
  status-pill-warning:
    backgroundColor: "{colors.warning-container}"
    textColor: "{colors.warning}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
  status-pill-error:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.error}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
  status-pill-info:
    backgroundColor: "{colors.info-container}"
    textColor: "{colors.info}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
  footer:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-on-surface}"
    linkColor: "{colors.inverse-on-surface-variant}"
    headingColor: "{colors.secondary}"
---

# HomeKlin Design System (redesign, October 2026)

Written 2026-10-19 as the specification for redesigning the whole site. It follows the Stitch `DESIGN.md` format of the user's reference (`markdown/references/brightnest-design.md`) and replaces the T3b system. The T3b doc was deleted on 2026-10-19 (user request); read it with `git show 96335bf:markdown/design-t3b.md`. The Token mapping table below lists every T3b token and what replaces it. Brand brief: `markdown/PRODUCT.md`. Business rules: `markdown/SPEC.md`. Until the migration below is done, `src/app/globals.css` still holds the T3b tokens.

## Brand & Style

HomeKlin is a cleaning service built to feel **calm, trustworthy and clear**, which is `PRODUCT.md`'s personality, now with more warmth and more character than T3b. It avoids the sterile blue-and-white of the category and the busy super-app. It uses **deep forest green** for trust, **one electric lime** for the single action that matters on a screen, and a **warm cream** canvas that feels like a lived-in home, not a clinic.

The visual voice is **editorial-modern**. Tight, confident grotesk headlines are interrupted by **one to three italic serif words**, the word that carries the benefit: "Rumah bersih yang bisa Anda *tonton langsung*". The serif always marks the emotional word and is never used for labels, buttons, tables or body text.

The UI is **soft-bento**: rounded white cards on cream, alternated with full-bleed dark-green bands ("Cara kerja", the footer) and one lime-wash panel (safety). Photography is bright, natural-light and people-forward: real cleaners in real homes. It sits in large rounded frames, and one product fragment, the order status card, overlaps the hero photo to show what the product is.

**Fixed by the product, not by taste:**
- **One brand to the customer.** Every customer page speaks as HomeKlin ("Petugas HomeKlin", "layanan HomeKlin"). No partner agency is ever shown, named or hinted at on a customer page (`PRODUCT.md` principle 6; `e2e/no-agency-wording.spec.ts` fails the build on "agensi", "agency" or "mitra").
- **Live video is reassuring, not CCTV.** "Live" is a breathing green dot beside words. Never a red REC dot, never a dark control-room grid, not even in the admin multi-feed grid.
- **Facts, not hype.** Full prices ("mulai dari Rp ..."), real free slots, what happens next, who can watch. No invented numbers, ratings, testimonials, press logos, vouchers or "most popular" labels. Anything illustrative is labelled "Contoh".
- **Light theme only** (user decision, 2026-10-18). Full-bleed dark-green bands are sections inside a light page, not a dark mode. There is no dark token set.
- **Key attributes:** trustworthy, fresh, premium-but-approachable, organised, human.

### What changes against T3b

| Area | T3b (built) | Redesign |
|---|---|---|
| Canvas | cool green-tinted off-white | warm cream `#F3F2EA`; cards are pure white |
| Brand | evergreen `#1c7456` mid-green buttons | deep forest `#1B3D2B` buttons, dark green bands and cards |
| Action colour | brand green for every action | lime `#D8EF6B` for the one main action per viewport; forest green for the rest |
| Type | Bricolage Grotesque + Figtree, one family per role | Inter Tight (display) + Instrument Serif italic (accent word) + Inter (text) |
| Shape | pill / 20 px / 12 px | pill / 28 / 20 / 14 / 8 px (five steps, listed under Shapes) |
| Landing | white sections, timeline, safety card on a mint panel | cream and dark-green rhythm, hero with floating status card, trust row, bento safety, dark "Cara kerja" band |
| Customer home | white job card | the current job is a forest-green status card with a lime "Tonton langsung" |
| Back office | light sidebar | dark-green sidebar, white data tables, no decoration |

## Colors

The palette is a tight three-part system: **green for trust, lime for action, cream for calm.** All values are in the front matter; WCAG ratios are in the Accessibility table.

- **Primary, Deep Forest (`#1B3D2B`):** Anchor of the brand. Primary buttons ("Pesan sekarang" in the header, "Bayar"), the selected service card, the active state of every segmented toggle, outline buttons and circular icon buttons.
- **Inverse Surface (`#132A1F`):** A slightly darker green for every full-bleed dark area: the "Cara kerja" band, the footer, the landing utility bar, the back-office sidebar, the dark fact chip. All dark areas share this hue, so the page never switches to neutral black.
- **Primary Container (`#22513A`):** A lifted green for the CTA shell at the end of the landing and for the **order status card on the customer home**. A large, slightly darker circle bleeding off one corner adds depth (decorative, no blur).
- **Secondary, Electric Lime (`#D8EF6B`):** The only high-energy colour. It appears on the main conversion button ("Pesan sekarang" in the hero and the CTA shell, "Tonton langsung" on the status card), the circle holding the arrow inside primary buttons, the hero's corner blob, icon wells on dark bands, the live dot on dark surfaces, and footer column headings. It always means "act here" or "this is the highlight". **Lime is a text colour only on dark green** (11.95:1 on `inverse-surface`); on cream or white it fails, so there it is a fill with dark text on it.
- **Secondary Container, Lime Wash (`#E6EDC8`):** Icon wells on light surfaces, the FAQ toggle, the active bottom-nav pill and the "Contoh" label. Never a large panel on cream: the two are 1.08:1 apart, so a lime-wash panel disappears (the safety panel uses full lime instead).
- **Tertiary, Mint (`#2F7A55`):** Check icons, progress and status graphics. Darker than the reference's `#3C8A64` so white text on it passes. `tertiary-bright` (`#3C8A64`) exists only for the live dot, which is a graphic next to a word.
- **Surface, Cream (`#F3F2EA`):** The page background. White cards stay visible on it without borders.
- **Surface Container Lowest (`#FFFFFF`):** All light cards, FAQ rows, nav pills, tables and form panels.
- **On Surface (`#14271C`) / On Surface Variant (`#55625A`):** Headline and body text; even the text colour is green-tinted so the palette stays cohesive. The reference's variant (`#5E6A62`) was 4.7:1 on `surface-dim`, so it was darkened.
- **Outline (`#1B3D2B`) / Outline Control (`#7A877E`) / Outline Variant (`#E2E2D8`):** Full-strength green for outline buttons; a mid grey-green for the edge of every input and toggle (3:1 or better, required to identify a control); a faint warm grey for decorative hairlines only.
- **Feedback:** `error`, `success`, `warning`, `info`, each a text colour plus a tinted container at 5:1 or better. `success` is also the text of the live pill. Status is never colour alone: every state has a word, usually an icon.
- **Rating `#E2B93B`:** the star icon in reviews (T30) only. The score beside it is in `on-surface`.

## Typography

The system pairs a **tight neo-grotesk** with an **italic display serif** and a plain text face. All three are free on `next/font/google` and cover Latin text with Indonesian names.

- **Inter Tight (display and headings):** weight 600, strong negative tracking (-0.03 to -0.045em), near-solid leading (1.0 to 1.05) at display sizes. Used for h1 to h3, the wordmark, prices and fact figures.
- **Instrument Serif Italic (accent):** one to three words per headline, plus the italic index numerals ("01" to "04") on landing service cards. About 10% larger than the grotesk beside it so the x-heights match, in the same colour as the headline (lime only on a dark band). Instrument Serif ships in regular and italic at one weight (400), so never set it bold.
- **Inter (body and UI):** 400 for paragraphs at 15 to 17 px with 1.55 to 1.6 leading; 600 for buttons, nav, card titles and FAQ questions; 500 for small labels.
- Not used any more: Bricolage Grotesque and Figtree (T3b). The T3b rule "no Inter, Fraunces or Instrument Serif" came from the taste skill's default bans; the user's new reference overrides it (see Decisions to review).

**Scale at desktop (1280 px and up), then how it steps down:**

| Token | Desktop | 768 to 1279 | Phone (360 to 767) |
|---|---|---|---|
| `display-lg` (+ `display-accent`) | 64 px (70 px) | 52 px (57 px) | 40 px (44 px) |
| `headline-lg` (+ `headline-accent`) | 48 px (52 px) | 40 px (44 px) | 30 px (33 px) |
| `headline-md` | 32 px | 28 px | 24 px |
| `title-lg` | 22 px | 22 px | 20 px |
| `title-md` | 18 px | 18 px | 17 px |
| `price` | 32 px | 28 px | 26 px |
| `body-lg` / `body-md` / `body-sm` | 17 / 15 / 14 px | same | 16 / 15 / 14 px (inputs 16 px, so iOS never zooms) |

**Rules**
- **Italic-accent rule for Indonesian and English:** put the serif on the benefit phrase, two words at most in a heading that wraps, at the end of a line when possible, never on a preposition or on "HomeKlin". Indonesian runs about 20% longer than English, so check both at 360 px. Text may wrap inside the italic phrase; headlines use `text-wrap: balance` so no line is left with one orphan word.
- **Hero headline:** at most three lines at 1024, 1280 and 1440 px, at most five at 360 px. This is one line more than the T3b rule, because the type is bigger; `e2e/landing.desktop.spec.ts` changes from "two lines" to "three lines" with it.
- Running text is at most 65 characters wide. Prices use `tabular-nums` and `formatRupiah` ("Rp 85.000"). Headings use `text-wrap: balance`, paragraphs `text-wrap: pretty`.
- Eyebrows: 12 px uppercase, 0.1em tracking, preceded by a 6 px green dot. At most one per three landing sections, never in the apps.
- No italic serif in the apps' data views, tables, buttons, nav or forms.

## Layout & Spacing

A **12-column fixed-width grid** inside a 1280 px container at a 1440 px canvas, with 80 px side gutters on the landing. Everything collapses to one column below 768 px.

**Landing (`/`)**, in this order:
1. **Utility bar** (desktop only, 44 px, `inverse-surface`, scrolls away while the header row stays): a plain price promise on the left ("Bayar di muka. Harga tampil penuh, tanpa biaya tersembunyi.") and "Bantuan" on the right. The language switch (SPEC) joins it at T4, when there is a second language to switch to; a switch that does nothing would be a fake control. It carries no promotion.
2. **Header** (64 px): wordmark, in-page links in the middle (Layanan, Cara kerja, Keamanan, Pertanyaan), and the forest **button-primary** "Pesan sekarang" with its lime arrow circle. "Masuk" joins at T5 (sign-in).
3. **Hero:** asymmetric two-column split, 7/12 text and 5/12 photo (built and measured: at 6/6 the Indonesian headline took four lines). The photo is a tall `xl` frame with the lime quarter-circle and a sparkle in its top-right corner. The **status card** overlaps its left edge, **low on the photo**, labelled "Contoh": the cleaner in the hero photo stands on the left, so a high card covered her face. Text: the h1, one sentence (20 words or fewer), the lime **button-accent** "Pesan sekarang", and one quiet link "Lihat harga" behind a 44 px outlined arrow circle. No eyebrow, no announcement badge. On phones and tablets the card sits **below** the photo, with no overlap.
4. **Trust row:** four equal facts in one band between hairlines (~40 px padding), each an icon well and one plain line: only you watch your job live, the cleaner checks in at your address, recordings kept 7 days then deleted, your consent is asked at booking. Every one is a `SPEC.md` fact.
5. **Services** (`#layanan`): eyebrow "Daftar harga", headline "Layanan dan harga, *tanpa kejutan*" left, an outline "Lihat semua layanan" link right (the service-type filter SPEC asks for lives on `/services`; four cards do not need a filter), then a four-column card grid from 1280 px with 20 px gaps (two columns from 640 px, one on phones; at 1024 px four cards were too narrow for the price and duration on one line). Each card: inset photo, italic index numeral, circular ↗, name, one line, duration and "mulai dari Rp ...". The whole card is one link; on hover or keyboard focus it inverts to forest with a lime numeral and arrow. One note under the grid says the prices are samples.
6. **Safety** (`#keamanan`), bento: a large photo (7/12, two rows) beside a full-lime `safety-panel` (5/12) with the headline "Rumah Anda tetap dalam *pantauan Anda*" and one sentence, and two fact chips below it (dark: "7 hari", rekaman dapat diputar ulang; white: "Check-in", at the address before work). Wording stays inside SPEC: the live view is for "Anda dan tim pemantau HomeKlin".
7. **Cara kerja:** a full-bleed `inverse-surface` band, headline with one supporting sentence stacked under it (the taste skill bans the left-headline, right-paragraph split header), then **five step cards** (Pesan, Bayar, Petugas check-in, Tonton langsung, Putar ulang 7 hari): five columns from 1280 px, three plus two at 768, one column on phones. Each has a lime icon well, a large low-opacity numeral top-right, a title and a muted line. The verb is the label; there is no "Langkah 1".
8. **Pertanyaan umum** (`#pertanyaan`): 4/12 heading with a link to `/support`, 8/12 accordion of four native `<details>` rows, 12 px apart.
9. **CTA shell:** a contained `primary-container` shell with one sentence ("Pilih jadwal yang masih kosong di area Anda") and the lime "Pesan sekarang". A large darker circle sits in the lower-left corner. It is not a form: the landing adds no inputs beyond SPEC.
10. **Footer:** `inverse-surface`, wordmark and tagline left, link columns right (existing pages only), a legal line saying that prices and data on this site are samples, then a full-width ghost wordmark cropped by the bottom edge (`aria-hidden`).

**Reviews band:** the reference's lime-wash testimonials band is **not built now**. Reviews are P2 (SPEC, T30) and must not be invented. When T30 lands, `review-card` goes in a lime-wash band between Services and Safety, with real submitted reviews only.

**Customer app (mobile-first, `/home` and the rest of `src/app/(customer)`)**
- **Bottom navigation** (below 768 px): Beranda, Layanan, Pesanan, Bantuan, Akun. 64 px plus the safe-area inset, white, `shadow-nav`, always-visible labels, the current item in a lime-wash pill with a dark-green label and `aria-current="page"`. From 768 px a top bar with the same five sections replaces it.
- **`/home`** starts with the **hero status card** (`status-card-hero`): a forest-green card with a live badge, the state in plain words ("Petugas sudah check-in pukul 09.04"), the assigned "Petugas HomeKlin" with name and round photo, service and time, the privacy line, and the lime "Tonton langsung". Under it: the area picker, then service rows. With no active job the card becomes an empty state in `secondary-container` with one action.
- **`/services`:** the segmented toggle filters by type; service cards as on the landing (no index numerals); the next free slot for the chosen area sits on each card. The **selected** service inverts to forest green.
- **Booking, payment, support chat:** a white `form-panel` on cream, 44 px inputs, one primary action per screen (button-accent only if it is the single action in the viewport, otherwise `button-primary`).
- Content width 960 px (`container-content` 60 rem); `pb-clear-nav` keeps content above the bottom bar.

**Cleaner app (mobile-first)**: same shell. Today's job list as white cards; a full-width 52 px check-in button (lime when it is the one action, forest green once checked in); stream status chips "Aktif", "Sinyal lemah", "Terputus", each with an icon and a word on success, warning and error containers.

**Agency and admin back office (desktop-first, from 1024 px)**: a real desktop layout, not a stretched phone view.
- **Sidebar:** 256 px, `inverse-surface`, `inverse-on-surface-variant` links, the active item on `surface-container-high` with lime text and a 3 px lime marker. Below 1024 px it becomes a drawer.
- **Content:** cream canvas, max width 1216 px (76 rem), 32 px gutters, white `data-table` with `surface-dim` header, 14 px text, 44 px rows (40 px allowed for dense tables, with 44 px hit areas). Page title in `headline-md`/`title-lg`.
- **Admin live grid:** white tiles in a 20 px grid, each with a calm live badge, the cleaner's name and the job, never a black tile, a REC dot or a burned-in timestamp. The video itself keeps its own aspect ratio inside a `rounded.md` frame.
- **No decoration:** no italic accent words, no floating cards, no blob or circle, no photography beyond avatars and video.

**Rhythm:** landing sections use 120 px vertical padding from 1280 px, 96 px from 768 px and 64 px on phones. Spacing inside cards follows an 8 px base (8, 16, 24, 40). Headline to content is 40 to 56 px on the landing; apps use 16 to 24 px. Customer and cleaner pages work from 360 px with no horizontal scroll (`e2e/no-horizontal-scroll.mobile.spec.ts` covers every page).

## Elevation & Depth

Depth comes mostly from **colour contrast and layering, not shadow.**
- **Level 0:** cream canvas.
- **Level 1:** flat white cards on cream, no shadow; at most a 1 px `outline-variant` hairline where a card sits on white or lime wash.
- **Level 2, floating fragment:** the **status card** over the hero photo uses `shadows.float`. It is the only large shadow in the system. `card-hover` lifts a service card on hover and `:focus-within`; `nav` is the bottom bar's upward edge.
- **Tonal elevation on dark bands:** step cards rise from `inverse-surface` by a lighter `surface-container-high` fill and an 8%-cream border, not a shadow.
- **Decorative depth:** the lime blob off the hero photo, the darker circle in the CTA shell and the ghost wordmark. No blur, glass, glow or gradient.
- **Layering scale** (use as `z-(--z-nav)`): sticky 20, nav 30, overlay 40, drawer 50, toast 60, tooltip 70. No arbitrary z-index values.

## Shapes

Generously rounded and friendly, with fully pill-shaped interactive elements.

- **Pills (`full`):** every button, segmented toggle, badge, chip, bottom-nav pill, select and avatar. Circular icon buttons (↗, carousel, FAQ toggles) are perfect circles.
- **`xl` 28 px:** hero photo frame, CTA shell, section bands.
- **`lg` 20 px:** service cards, step cards, safety panel, form panel, data table, empty states. A photo inside a card is inset 10 px and carries its own `md` radius, a "card within a card".
- **`md` 14 px:** status card, fact chips, FAQ rows, review card, nested thumbnails.
- **`sm` 8 px:** inputs, selects, icon wells, sidebar items.
- **Organic accents:** the hero's lime quarter-circle and a four-point sparkle glyph (✦) are the only non-rectangular decoration.
- **Rule:** anything interactive is a pill, except form fields (`sm`) and the sidebar items (`sm`); containers use `lg` or `xl`; anything nested inside a container is one step smaller.

## Components

All live in `src/components/`. Every interactive element has hover, `:focus-visible` (2 px ring in `primary`, `secondary` on dark bands, 2 px offset), active (`scale(0.98)` press on buttons), disabled and, where relevant, loading and error states, with a target of at least 44 px (`min-h-touch`). Icons: `lucide-react`, stroke width 2.

### Buttons
- **Primary ("Pesan sekarang", "Bayar"):** forest-green pill, white semibold label, and a 24 px lime circle holding a dark arrow, right-aligned inside the button. 44 px high. Hover `primary-container`.
- **Accent:** lime pill with dark-green label, 52 px. **The main conversion button, at most once per viewport** (hero "Pesan sekarang", CTA shell, status card "Tonton langsung", the single action of a screen). One label per intent everywhere.
- **Outline ("Lihat harga", "Batalkan"):** transparent pill, 1.5 px `outline` border.
- **Submit:** full-width `inverse-surface` pill, 48 px, inline arrow ("Bayar sekarang →").
- **Icon circle:** 44 px outlined circle; the active or next control is filled `primary`.
- **Disabled:** `surface-dim` fill, `on-surface-variant` label (5.35:1), no shadow, `aria-disabled`.

### Navigation
- **Utility bar, header, bottom navigation, top navigation, sidebar:** as in Layout. Logo: a forest-green rounded square with a house glyph plus "HomeKlin" in `title-lg` (20 px semibold), in `inverse-on-surface` on dark.
- **Skip link:** first focusable element on every page, lime fill with dark text, `shadows.float`.
- **Language switch:** a two-segment toggle ID | EN, remembers the choice.

### Badges and chips
- **Live badge:** `success-container` pill, `success` text, a 2.4 s breathing `tertiary-bright` dot, **always with a word** ("Sedang berlangsung"). On dark surfaces the on-dark variant uses a lime dot and lime text. Static under reduced motion.
- **"Contoh" label:** `secondary-container` pill marking any sample content (the hero status card, sample prices, sample reviews).
- **Fact chip:** dark (lime figure) or white (dark figure) with a 12 px caption. Figures are real facts only ("7 hari").
- **Status pills:** warning, error, info for back-office and job states, text plus icon.

### Cards
- **Service card:** white, inset rounded photo, italic serif index numeral bottom-left (landing only), circular ↗ button, `title-lg` name, muted line, duration, "mulai dari" with `price`. The **selected** variant inverts to forest green with a lime numeral and lime-filled arrow.
- **Status card:** the product fragment. Live badge, state in words, "Petugas HomeKlin" with name and round photo, service and time, one privacy line, one button. Light variant (hero, floating, labelled "Contoh") and forest-green variant (`/home`).
- **Step card:** on the dark band. Lime icon well top-left, a very large low-opacity numeral top-right, title, muted description.
- **Review card (T30, not on the landing yet):** white, star icon plus score, quote in 15 px semibold, first name only, the service name. Never an agency.
- **Empty state:** an icon well, a plain title, one or two sentences on what will appear and how. `lg` radius, dashed `outline-variant` border.

### Forms
- **Inputs:** 44 px, `sm` radius, `surface-container-low` fill, 1 px `outline-control` border, a visible 12 px label above (never placeholder-only). Error: `error-container` fill, `error` border, an icon and a message below in `error`.
- **Area picker:** a native `<select>` styled as a pill with a map-pin icon and a visible "Area layanan" label.
- **Segmented toggle:** white track with a 1 px `outline-control` border and 4 px padding; the active segment is a forest-green pill with white text. Used for the language switch and the service-type filter (and, in booking, one-time or repeat).
- **Checkbox and consent toggle** (streaming consent at booking): 24 px visual, 44 px hit area, label beside it.

### FAQ accordion
White `md` rows with semibold questions, native `<details>`. A **lime-wash circle "+"** marks a closed item and a **dark circle "−"** the open one, which reveals muted body text.

### Tables (back office)
White `lg` container, `surface-dim` header row in `label-sm`, 14 px cells, `outline-variant` row dividers, hover fill `surface-container-low`, status in a pill with a word. Numbers right-aligned and `tabular-nums`.

### Footer
`inverse-surface`; lime uppercase column headings (`eyebrow`), muted links, the sample-data line, the ghost wordmark.

## Motion

CSS only; no animation library.
- Colour and border changes 150 ms, `ease-out-quart`; `card-hover` lift 150 ms.
- Press feedback: `scale(0.98)` on buttons.
- Hero entry, once: headline, subtext and buttons rise 12 px and fade in over 500 ms, staggered by 80 ms. The hero photo and the status card do not animate, so the largest paint is never delayed.
- The live dot breathes (2.4 s).
- Nothing else moves: no scroll reveals, marquee, parallax or carousel auto-play. `prefers-reduced-motion: reduce` turns every animation and transition off.

## Accessibility

WCAG 2.1 AA is a floor (target in `CONSTRAINTS.md`; axe at T35). Ratios computed with the WCAG relative-luminance formula from the hex values above (2026-10-19).

| Pair | Ratio | Needs | Result |
|---|---|---|---|
| `on-surface` on `surface` | 14.0 | 4.5 | pass |
| `on-surface` on `surface-container-lowest` | 15.7 | 4.5 | pass |
| `on-surface` on `surface-dim` | 13.1 | 4.5 | pass |
| `on-surface` on `secondary-container` | 13.0 | 4.5 | pass |
| `on-surface-variant` on `surface` | 5.7 | 4.5 | pass |
| `on-surface-variant` on `surface-container-lowest` | 6.4 | 4.5 | pass |
| `on-surface-variant` on `surface-container-low` | 5.9 | 4.5 | pass |
| `on-surface-variant` on `surface-dim` | 5.35 | 4.5 | pass |
| `on-primary` on `primary` | 12.0 | 4.5 | pass |
| `on-primary-container` on `primary-container` | 8.1 | 4.5 | pass |
| `on-primary` on `primary-container` | 9.1 | 4.5 | pass |
| `on-secondary` on `secondary` | 12.3 | 4.5 | pass |
| `on-secondary-container` on `secondary-container` | 9.9 | 4.5 | pass |
| `inverse-on-surface` on `inverse-surface` | 13.6 | 4.5 | pass |
| `inverse-on-surface-variant` on `inverse-surface` | 8.3 | 4.5 | pass |
| `inverse-on-surface-variant` on `primary-container` | 5.0 | 4.5 | pass |
| `inverse-on-surface-variant` on `surface-container-high` | 5.9 | 4.5 | pass |
| `inverse-on-surface` on `surface-container-high` | 9.5 | 4.5 | pass |
| `secondary` (lime text) on `inverse-surface` | 12.0 | 4.5 | pass |
| `secondary` (lime text) on `primary` | 9.4 | 4.5 | pass |
| `secondary` (lime text) on `primary-container` | 7.2 | 4.5 | pass |
| `secondary` (lime text) on `surface-container-high` | 8.4 | 4.5 | pass |
| `on-tertiary` (white) on `tertiary` | 5.2 | 4.5 | pass |
| `tertiary` on `surface-container-lowest` (icons) | 5.2 | 3 | pass |
| `tertiary` on `secondary-container` (icons only) | 4.3 | 3 | pass (graphic, never text) |
| `success` on `success-container` | 5.6 | 4.5 | pass |
| `success` on `surface` | 5.7 | 4.5 | pass |
| `error` on `surface-container-lowest` | 5.9 | 4.5 | pass |
| `error` on `error-container` | 5.1 | 4.5 | pass |
| `warning` on `warning-container` | 5.4 | 4.5 | pass |
| `info` on `info-container` | 6.4 | 4.5 | pass |
| `outline-control` on `surface-container-lowest` (control edge) | 3.75 | 3 | pass |
| `outline-control` on `surface-container-low` (control edge) | 3.5 | 3 | pass |
| `outline` on `surface` (outline button edge) | 10.7 | 3 | pass |
| Focus ring: `primary` on `surface`; `secondary` on `inverse-surface` | 10.7; 12.0 | 3 | pass |
| `tertiary-bright` on white (live dot, beside a word) | 4.2 | 3 | pass (graphic) |

Colours that are **decorative only** and so exempt: `outline-variant` hairlines, `wordmark-ghost` (1.7:1 on `inverse-surface`, `aria-hidden`), `rating` star (the score beside it is text), the lime blob and darker circle.

Rules:
- **Never** lime, `tertiary` or `tertiary-bright` as text on cream, white or lime wash; lime text only on the dark greens in the table.
- Status is never colour alone: every live, warning, error or success state has a word and usually an icon.
- Touch targets at least 44 px; visible `:focus-visible` everywhere; the whole site usable by keyboard on desktop; headings in order; the hero image and status card carry meaningful `alt` or `aria-label`; the ghost wordmark and decorative shapes are `aria-hidden`.
- Respect `prefers-reduced-motion`. No horizontal scroll from 360 px.
- Language: `lang="id"` by default, `lang="en"` when switched; layouts hold strings 30% longer than the Indonesian default.
- Performance: the hero photo is the only `priority` image; Inter Tight, Inter and Instrument Serif load through `next/font` with `display: swap` and the Latin subset only; Instrument Serif loads the italic style only, since the upright style is never used. LCP at most 2.5 s on key customer pages (T36).

## Do and Don't

**Do**
- Speak as HomeKlin on every customer page; Indonesian with formal "Anda", short sentences, verb plus object on buttons.
- Use tokens only. A component must not contain a hex value, a pixel radius or a raw shadow.
- Put the current job state first on `/home`, in plain words.
- Use lime for one action per viewport and forest green for every other primary action.
- Mark any illustrative content "Contoh" and keep one `copy` object of strings per component (T4 moves them into next-intl).
- Show full prices with `formatRupiah`, prices marked as samples until admin sets them.
- Use the real component with sample data when the landing needs to show the product (the status card).
- Keep the back office dense and plain: same palette and type, no accent serif, no photography.

**Don't**
- Show, name or hint at a partner agency on a customer page.
- Invent proof: no review counts, ratings, "12k+ customers", named testimonials, "most popular" chips, press logos, vouchers, countdowns, newsletters or awards.
- Use em dashes or en dashes in visible text; use a hyphen, a comma or two sentences.
- Use a red or dark treatment for live video, a REC dot, or burned-in timestamps.
- Put lime or mint text on a light surface, or put text on `tertiary-bright`.
- Use gradients, glass, glows or gradient text; draw fake screenshots out of divs.
- Nest cards, or add a card where a list row would do.
- Put the italic serif on buttons, labels, nav, table text or body text.
- Add a second lime button to a viewport, or two labels for the same intent.
- Use section numbers or an eyebrow above every heading.

## Token mapping

Target: `src/app/globals.css` (Tailwind v4 `@theme static`, defaults cleared as today). Names in the right column are the Tailwind utilities (`bg-…`, `text-…`).

| Front-matter token | New `@theme` name | Replaces (T3b) | Status |
|---|---|---|---|
| `colors.primary` | `primary` | `brand-600` | new, darker |
| `colors.primary-container` | `primary-container` | `brand-700` | new |
| `colors.on-primary` / `on-primary-container` | `on-primary` / `on-primary-container` | `on-brand` | new |
| `colors.secondary` / `on-secondary` | `lime` / `on-lime` | none | new |
| `colors.secondary-container` / `on-secondary-container` | `lime-wash` / `on-lime-wash` | `brand-50`, `brand-100` | new |
| `colors.tertiary` / `tertiary-bright` | `mint` / `mint-bright` | `brand-500` (live dot) | new |
| `colors.surface` | `canvas` | `canvas` | **same name, new value (warm cream)** |
| `colors.surface-container-lowest` | `card` | `surface` | **renamed**: T3b's `surface` becomes `card` |
| `colors.surface-container-low` | `field` | none | new |
| `colors.surface-dim` / `surface-container` | `sunken` | `surface-sunken`, `panel` | renamed |
| `colors.surface-container-high` | `band-raised` | none | new |
| `colors.inverse-surface` | `band` | none | new |
| `colors.inverse-on-surface` / `-variant` | `on-band` / `on-band-muted` | none | new |
| `colors.on-surface` | `ink` | `ink` | same name, new value |
| `colors.on-surface-variant` | `ink-muted` | `ink-muted`, `ink-faint` | merged into one |
| `colors.outline` | `outline` | none | new |
| `colors.outline-control` | `border-control` | `border-control` | same name, new value |
| `colors.outline-variant` | `border` | `border` | same name, new value |
| `colors.error` / `success` / `warning` / `info` and `-container` | `danger` / `success` / `warning` / `info` and `-surface` | same | values changed to pass 5:1 on the new surfaces |
| `colors.rating`, `wordmark-ghost` | `rating`, `wordmark-ghost` | `rating` | `wordmark-ghost` new |
| `colors.focus` (derived) | `focus` | `focus` | same; `lime` inside `band` containers |
| `typography.*` families | `font-display` (Inter Tight), `font-accent` (Instrument Serif), `font-sans` (Inter) | Bricolage, Figtree | replaced; `next/font` variables `--font-inter-tight`, `--font-instrument-serif`, `--font-inter` |
| `typography.*` sizes | add `text-display` 64, `text-display-accent` 70; keep `text-xs` to `text-5xl`; remove `text-6xl` (was reserved, unused) | scale | extended |
| `rounded.sm/md/lg/xl/full` | `rounded-sm` 8, `rounded-md` 14, `rounded-lg` 20, `rounded-xl` 28, `rounded-full` | `md` 12, `xl` 20, `full` | **meanings shift**: T3b `xl` (20) becomes `lg`; T3b `md` (12) becomes `md` (14) |
| `spacing.*` named values | `gutter` 16, `gutter-wide` 32, `gutter-landing` 80, `touch`, `bottom-nav`, `top-bar` (36 landing utility bar; the T3b 56 px app bar becomes `app-bar`), `sidebar`, `container-page` 80 rem (1280) | as T3b | `container-page` widens from 76 rem |
| `shadows.*` | `shadow-float`, `shadow-card-hover`, `shadow-nav`; `shadow-card` and `shadow-raised` removed | `card`, `raised`, `nav` | changed |

Two renames are traps: **`surface` now means cream-versus-white the other way round**, and **`rounded-xl` shrinks a size**. Do the renames with one reviewed codemod before any visual change, and run the full e2e suite after it.

## Migration notes

For `homeklin-frontend`, in this order. After each step `npm run check` and `npm run test:e2e` pass and the site still works.

**Done in T3c (2026-10-19): the landing page.** The new tokens sit beside the T3b ones in `src/app/globals.css`. The landing opts in with the class `theme-forest` on its layout wrapper, which gives the shared names (`canvas`, `ink`, `border`, `rounded-md`, `rounded-xl`, the font tokens) their new values inside the landing only; the three fonts load in `src/app/(marketing)/layout.tsx`, so the apps do not download them yet. `ButtonLink` has the redesign's `forest` and `accent` variants and `Wordmark` a `forest` palette, beside the T3b defaults. Steps 1 and 6 are done for the landing; the apps follow steps 2 to 5, after which the `.theme-forest` values move into `@theme` and the wrapper class goes away.

1. **Fonts and tokens:** add Inter Tight, Instrument Serif (italic) and Inter through `next/font`; add the new tokens beside the old ones in `globals.css`; do not delete anything yet. (Done for the landing.)
2. **Codemod the two traps** (`surface` → `card`, T3b radius names), then switch the old token names to the new values one family at a time (colours, radii, shadows). Screenshots after each.
3. **Primitives:** `button-link` (primary with lime arrow circle, accent, outline, submit), `live-indicator`, segmented toggle, `empty-state`, inputs, new `badge-sample`, `fact-chip`, `icon-well`.
4. **Shells:** `bottom-nav`, `top-nav`, `mobile-shell`; then `sidebar-shell` and the back-office top bar on the dark sidebar and white tables.
5. **Customer app:** `job-status-card` as the forest-green hero card, `service-card`/`service-row`, `area-picker`.
6. **Landing:** utility bar and header, hero (status card overlap, blob), trust row, services, safety bento, dark "Cara kerja" band, FAQ, CTA shell, footer with ghost wordmark. (Done in T3c.)
7. **Tests that change:** done for the landing in T3c (`e2e/landing.spec.ts`, `landing.desktop.spec.ts` with three headline rows and a 44 + 64 px header, new `landing.mobile.spec.ts`, screenshots `npm run screenshots -- t3c`). For the apps: `tests/navigation.test.ts` only if labels change. `e2e/no-agency-wording.spec.ts` and the horizontal-scroll test must keep passing unchanged.
8. **Docs:** update `markdown/Progress.md`, the `globals.css` header comment and the code comments that mention the T3b tokens (for example in `src/app/layout.tsx` and `src/components/ui/button-link.tsx`).

## References

- **Brightnest** (`markdown/references/brightnest-design.md`): the format and the whole mood: forest green, lime accent, cream canvas, grotesk with serif-italic accent, soft-bento, dark bands, pill buttons, floating product fragment, ghost wordmark.
- **T3b research** (section 8 of the deleted T3b doc, `git show 96335bf:markdown/design-t3b.md`: MyClean, Fantastic Services, KliknClean, Justlife, Wise) still informs the content decisions: full upfront "mulai dari" prices, the customer never choosing a provider, short verb-led steps, the "Pesan Sekarang" label Indonesian customers know. No new research was done for this redesign.

**What was left out of the reference, and why:** stat chips with invented numbers, the "4.9 rating / 2k+" avatar cluster, named testimonials (reviews are P2), "NEW" announcement badge, pricing tiers with "Most popular" (HomeKlin has a service list, not subscriptions), the newsletter input, the "Get an instant quote" form, "For business" toggle (HomeKlin serves households only), the Brightnest wordmark and copy.

## Decisions to review

1. **Fonts.** Inter Tight, Instrument Serif and Inter follow your reference, and reverse the T3b rule that banned Inter and Instrument Serif (that ban came from the taste skill's defaults, not from you). Say if you would rather keep Bricolage Grotesque and Figtree and use a different italic accent.
2. **Hero type is 64 px, not the reference's 72 px, and the hero is 7/5, not the reference's 5/7.** Indonesian headlines are longer; measured in T3c, the headline takes three lines at 1024, 1280 and 1440 px this way (four at 6/6). The hero spec's "max two lines" becomes "max three lines", one more than the taste skill's rule.
3. **Colours changed to pass AA.** Mint `#3C8A64` → `#2F7A55` for anything under text; `on-surface-variant` `#5E6A62` → `#55625A`; muted text on dark `#9DB0A4` → `#B3C4B8`; input borders use a new `outline-control` instead of the 1.2:1 hairline; `error` `#C2412D` → `#B5381F`. `#3C8A64` survives only as the live dot.
4. **One floating card over the hero photo.** The old rule forbade labels over photos. It is kept for the status card only, labelled "Contoh", because it shows the product's core promise; the reference's second floating chip is dropped.
5. **No reviews band, no stats, no "most popular".** They would need data HomeKlin does not have. The lime-wash band is reserved for real reviews at T30.
6. **CTA shell has no form.** The reference's booking shell embeds a form. SPEC lists only one primary action on the landing, so the shell holds one sentence and one button. An area-and-date quick start would be new scope.
7. **Utility bar.** The reference's announcement bar has no HomeKlin use, so it carries a plain price promise and "Bantuan", desktop only, 44 px tall. The language switch (SPEC) joins it at T4; on phones it will sit in the header.
8. **Dark-green sidebar for agency and admin.** This changes the back office as well, because you asked for the whole page. It stays dense and undecorated.
9. **Token renames.** `surface` and `rounded-xl` change meaning; see the traps under Token mapping. The migration does them in one codemod first.
10. **Checked in T3c on the landing:** the fonts render with Indonesian copy, the hero is three lines at 1024, 1280 and 1440 px (e2e), and no visible text has an em or en dash (e2e). Still not measured: the Instrument Serif size ratio (+10%) is the reference's.
11. **Built differently from the first draft of this file (T3c):** the safety panel is full lime (lime wash vanished on cream); the services header has a link, not a filter toggle; prices on cards are 24 px; the hero card sits low on the photo; the utility bar is 44 px. Each is recorded where it applies above.
