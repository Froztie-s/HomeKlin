<!--
Reference only. This is the user's pasted example of a design.md (Stitch DESIGN.md format) for a fictional
cleaning brand called "Brightnest". It is NOT HomeKlin's design. The `homeklin-design-writer` agent copies
its FORMAT and MOOD and rewrites the content for HomeKlin. Do not build from this file.
-->
---
name: Brightnest
description: A warm, trustworthy home-services marketing system pairing deep forest green with an electric lime accent on a soft cream canvas, with editorial serif italics set into confident grotesk headlines.
colors:
  # Core brand
  primary: "#1B3D2B"              # Deep forest green: primary buttons, dark cards, top bar, footer
  on-primary: "#FFFFFF"
  primary-container: "#22513A"    # Lifted green: booking-form shell, featured service card. UNCERTAIN: may be #1F4D37 (±1 step)
  on-primary-container: "#F3F2EA"
  secondary: "#D8EF6B"            # Electric lime: accent CTAs, highlight blob, popular chip, icon wells
  on-secondary: "#14271C"
  secondary-container: "#E6EDC8"  # Pale lime wash: testimonials band, trust-icon tiles
  on-secondary-container: "#1B3D2B"
  tertiary: "#3C8A64"             # Mint green: status dots ("Team confirmed"), check icons, progress fill
  on-tertiary: "#FFFFFF"
  # Surfaces
  surface: "#F3F2EA"              # Warm cream page background
  surface-dim: "#ECEBE2"          # Dividers, section separators, input fills on cream
  surface-container-lowest: "#FFFFFF"  # Cards, nav pills, FAQ rows, form panel
  surface-container-low: "#F7F6F0"     # Input fill inside white form panel. UNCERTAIN: may be #F4F4EE
  surface-container: "#ECEBE2"
  surface-container-high: "#24443A"    # Step cards on the dark "How it works" band. UNCERTAIN: estimated, low contrast against band
  on-surface: "#14271C"           # Primary text, near-black green
  on-surface-variant: "#5E6A62"   # Body copy, captions, secondary labels
  inverse-surface: "#132A1F"      # "How it works" band and footer background
  inverse-on-surface: "#F3F2EA"
  inverse-on-surface-variant: "#9DB0A4"  # Muted text and links on dark bands
  # Lines
  outline: "#1B3D2B"              # Outline buttons ("Choose Essential") and circular icon buttons
  outline-variant: "#E2E2D8"      # Hairline card borders, row dividers
  # Feedback & utility
  rating: "#E2B93B"               # Star ratings. UNCERTAIN: renders lime-gold at this size, estimated
  error: "#C2412D"                # UNCERTAIN: not shown in source; warm red chosen to sit with the palette
  on-error: "#FFFFFF"
  wordmark-ghost: "#24503A"       # Oversized footer wordmark, set tone-on-tone over inverse-surface

typography:
  display-lg:
    fontFamily: "Inter Tight"     # UNCERTAIN: tight grotesk; could be Satoshi or General Sans
    fontSize: 72px
    fontWeight: 600
    lineHeight: 1.0
    letterSpacing: -0.045em
  display-accent:
    fontFamily: "Instrument Serif"
    fontSize: 80px                # Optically upsized about 10% to match the grotesk's cap height
    fontWeight: 400
    fontStyle: italic
    lineHeight: 1.0
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: "Inter Tight"
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
    fontFamily: "Inter Tight"
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.03em
  stat:
    fontFamily: "Inter Tight"
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.0
    letterSpacing: -0.03em
  price:
    fontFamily: "Inter Tight"
    fontSize: 44px
    fontWeight: 600
    lineHeight: 1.0
    letterSpacing: -0.035em
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
    fontFamily: "Instrument Serif"
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
    fontFamily: "Inter"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0em
  body-sm:
    fontFamily: "Inter"
    fontSize: 13px
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
    fontFamily: "Inter"
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.1em
    textTransform: uppercase

rounded:
  sm: 8px        # Inputs, small tags, icon wells
  md: 14px       # Floating info cards, FAQ rows, stat chips
  lg: 20px       # Service, pricing, testimonial and step cards
  xl: 28px       # Hero image frame, booking-form shell, section bands
  full: 9999px   # Buttons, segmented toggles, avatars, circular icon buttons

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  3xl: 120px             # Vertical section padding
  container: 1280px      # Max content width at a 1440px canvas
  gutter: 80px           # Desktop side margin. UNCERTAIN: measured about 73-80px
  grid-gap: 20px         # Card grid gap

shadows:
  none: "none"           # Default: cards rely on white-on-cream contrast, not shadows
  float: "0 16px 40px rgba(20, 39, 28, 0.10)"   # "Next visit" floating card over the hero image
  card-hover: "0 10px 28px rgba(20, 39, 28, 0.08)"  # UNCERTAIN: hover not shown, inferred from float

components:
  top-bar:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-on-surface}"
    typography: "{typography.label-sm}"
    height: 36px
  nav-link:
    textColor: "{colors.on-surface}"
    typography: "{typography.label-sm}"
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
  badge-announcement:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "4px 12px 4px 4px"
  badge-new:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  segmented-toggle:
    backgroundColor: "{colors.surface-container-lowest}"
    activeBackgroundColor: "{colors.primary}"
    activeTextColor: "{colors.on-primary}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 4px
  service-card:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 10px
  service-card-featured:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    accentColor: "{colors.secondary}"
    rounded: "{rounded.lg}"
    padding: 10px
  stat-chip-dark:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.stat}"
    rounded: "{rounded.md}"
    padding: "20px 24px"
  stat-chip-light:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    typography: "{typography.stat}"
    rounded: "{rounded.md}"
    padding: "20px 24px"
  info-card-floating:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 16px
    shadow: "{shadows.float}"
  trust-badge-icon:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    size: 32px
  step-card:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.inverse-on-surface}"
    borderColor: "rgba(243, 242, 234, 0.08)"
    rounded: "{rounded.lg}"
    padding: 24px
  pricing-card:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 28px
  pricing-card-featured:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    priceColor: "{colors.secondary}"
    rounded: "{rounded.lg}"
    padding: 28px
  testimonial-card:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 24px
  testimonial-card-dark:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-on-surface}"
    rounded: "{rounded.md}"
    padding: 24px
  booking-shell:
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
    borderColor: "{colors.outline-variant}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    height: 44px
    padding: "0 14px"
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
  footer:
    backgroundColor: "{colors.inverse-surface}"
    textColor: "{colors.inverse-on-surface}"
    linkColor: "{colors.inverse-on-surface-variant}"
    headingColor: "{colors.secondary}"
  newsletter-input:
    backgroundColor: "rgba(243, 242, 234, 0.06)"
    textColor: "{colors.inverse-on-surface}"
    rounded: "{rounded.full}"
    height: 44px
---

## Brand & Style

Brightnest is a cleaning-services brand built to feel **calm, competent and fresh**. It avoids the sterile blue-and-white look common in the category. It uses **deep forest green** for trust and an **electric lime** for freshness and energy, on a **warm cream** canvas that feels more like a lived-in home than a clinic.

The visual voice is **editorial-modern**. Confident, tightly tracked grotesk headlines are interrupted by **italic serif words** ("*spotless*", "*how you live*", "*three easy steps*", "*speak for themselves*", "*today*"), which add warmth and a human, hand-touched tone. The serif always marks the emotional or benefit-carrying word in a headline.

The UI follows a **soft-bento** style: rounded white cards laid on cream, alternated with full-bleed dark-green bands ("How it works", footer) and a pale-lime band (testimonials) to set the page's rhythm. Photography is bright, natural-light and people-forward: real cleaners, real homes, warm skin tones. It is framed in large rounded containers and often overlapped by floating UI fragments (a booking card, stat chips) that suggest the product experience.

**Key attributes:** trustworthy, fresh, premium-but-approachable, organized, eco-conscious.

## Colors

The palette is a tight three-part system: **green for trust, lime for action, cream for calm**.

- **Primary, Deep Forest (#1B3D2B):** The brand's anchor. Used for primary buttons ("Book a clean"), featured cards (the active service card and the "Signature" pricing tier), stat chips, and the active state of every segmented toggle. Its near-black depth gives the strong contrast that grey would otherwise provide.
- **Inverse Surface (#132A1F):** A slightly darker green for full-bleed bands: the announcement top bar, the "A cleaner space in three easy steps" section, the dark testimonial card, and the footer. All dark areas share this hue family, so the page never switches to neutral black.
- **Primary Container (#22513A):** A lifted green used for the booking-form shell. A subtle oversized circle in a darker green tone adds depth in the lower-left corner.
- **Secondary, Electric Lime (#D8EF6B):** The single high-energy accent. It appears on the main conversion CTA ("Get an instant quote"), the circular arrow inside primary buttons, the corner blob on the hero image, the "Most popular" chip, the "Choose Signature" CTA, price figures on dark cards, step-card icon wells, and the footer's "Subscribe" button and column headings. It is used sparingly, so it always means "act here" or "this is the highlight".
- **Secondary Container, Lime Wash (#E6EDC8):** A desaturated lime for the testimonials band background and small icon tiles in the trust-badge row and FAQ toggles.
- **Tertiary, Mint (#3C8A64):** A functional status green for check icons in pricing lists, the "Team confirmed" dot, and the progress bar in the floating "Next visit" card.
- **Surface, Cream (#F3F2EA):** The page background. Warm, slightly yellowed off-white that keeps white cards visible without borders.
- **Surface Container Lowest (#FFFFFF):** All light cards, FAQ rows, nav pills, toggles and form panels.
- **On Surface (#14271C) / On Surface Variant (#5E6A62):** Headline and body text. Even the text color is tinted green, so the palette stays cohesive.
- **Outline (#1B3D2B) / Outline Variant (#E2E2D8):** Full-strength green for outline buttons and circular icon buttons. A faint warm grey for section dividers (for example, above and below the trust-badge row).

## Typography

The system pairs a **tight neo-grotesk** with a **condensed italic display serif**.

- **Inter Tight (display and headings):** Set heavy (600) with strong negative tracking (-0.03 to -0.045em) and near-solid leading (1.0–1.05) at display sizes. Headlines read as dense, confident blocks. *UNCERTAIN: the face could also be Satoshi or General Sans; letterforms are consistent with Inter Tight.*
- **Instrument Serif Italic (accent):** A high-contrast, narrow italic used only for one to three emphasis words per headline, and for the italic index numerals on service cards ("*01*", "*02*"). Set about 8–10% larger than the surrounding grotesk so the x-heights look matched, and in the same on-surface color (or lime on dark bands) rather than a contrasting hue.
- **Inter (body and UI):** Regular 400 for paragraphs at 15–17px with generous 1.55–1.6 leading. Semibold 600 for buttons, nav links, card titles and FAQ questions.

**Hierarchy observed:**
- Hero: 72px grotesk across three lines, with an 80px italic serif word inline.
- Section headings: 48px, usually split over two lines with the serif phrase wrapping to the second line.
- Prices and stats: 40–44px grotesk semibold, paired with a small 12px "/ visit" or caption beneath.
- Card titles: 22px semibold.
- Eyebrows: 11px uppercase, 0.1em tracking, preceded by a 6px solid green dot ("● OUR SERVICES", "● PRICING", "● FAQ").

## Layout & Spacing

The layout uses a **12-column fixed-width grid** within a 1280px container at a 1440px canvas, with ~80px side gutters.

- **Hero:** Asymmetric two-column split (about 5/12 text, 7/12 image). The image frame is a tall rounded rectangle with floating UI overlapping its left edge: a "Next visit" card top-left and a dark stat chip bottom-left. This breaks the column boundary and creates depth.
- **Trust row:** Four equal items in a single band, framed by hairline dividers above and below, with ~40px vertical padding.
- **Services:** Header row with left-aligned headline and a right-aligned segmented toggle, then a four-column card grid with 20px gaps.
- **Approach:** Bento layout. A large photo (about 7/12) sits beside a stacked lime text panel and two stat chips (about 5/12).
- **How it works:** Full-bleed dark band with headline left and supporting copy right-aligned, then three equal step cards.
- **Pricing:** Centered header and toggle, then three equal cards. The center card is featured.
- **Testimonials:** Full-bleed lime-wash band. About 4/12 for heading and carousel arrows, 8/12 for two cards.
- **Booking:** A contained rounded green shell, split 50/50 into copy and contact info on the left and a white form panel on the right.
- **FAQ:** About 4/12 heading, 8/12 accordion stack with 12px gaps between rows.
- **Footer:** Newsletter left, three link columns right, then a full-width oversized wordmark cropped by the bottom edge.

**Rhythm:** Sections are separated by ~120px vertical padding. Spacing inside cards follows an 8px base (8 / 16 / 24 / 40). Headline-to-content distance is consistently ~40–56px.

## Elevation & Depth

Depth comes mostly from **color contrast and layering, not shadow**.

- **Level 0 (canvas):** Cream surface.
- **Level 1 (cards):** Flat white cards on cream with no shadow. At most a 1px warm hairline in places where cards sit on white or lime-wash backgrounds.
- **Level 2 (floating fragments):** The "Next visit" card and hero stat chip overlap the photograph and use a soft, wide, green-tinted shadow (`0 16px 40px rgba(20,39,28,0.10)`). This is the only clearly visible shadow in the system.
- **Tonal elevation on dark bands:** On the inverse-surface green, step cards are raised by a slightly lighter green fill (#24443A) and an 8%-opacity cream border instead of a shadow.
- **Decorative depth:** The lime circle bleeding off the hero image corner, the large darker circle in the booking shell, and the tone-on-tone footer wordmark add layered, graphic depth without blur or glass effects.

## Shapes

The shape language is **generously rounded and friendly**, with fully pill-shaped interactive elements.

- **Pills (full):** Every button, segmented toggle, announcement badge, newsletter input and avatar. Circular icon buttons (play, arrow, carousel controls, FAQ toggles) are perfect circles.
- **Large containers (xl, 28px):** The hero image frame and the booking shell.
- **Cards (lg, 20px):** Service, pricing and step cards. Images inside service cards are inset ~10px and carry their own ~14px radius, which gives a nested "card within a card" look.
- **Small fragments (md, 14px):** Floating info card, stat chips, testimonial cards and FAQ rows.
- **Inputs and icon wells (sm, 8px):** Form inputs and the tinted square tiles behind trust-badge and step icons.
- **Organic accents:** The hero's lime quarter-circle blob and a four-point sparkle glyph (✦) are the only non-rectangular decorative shapes.

## Components

### Buttons
- **Primary ("Book a clean"):** Forest-green pill with white semibold label and a 24px lime circle holding a dark arrow, right-aligned inside the button.
- **Accent ("Get an instant quote", "Choose Signature", "Subscribe"):** Lime pill with dark-green label. This is the main conversion button and should appear no more than once per viewport.
- **Outline ("Choose Essential", "Choose Premium"):** Transparent pill with a 1.5px forest-green border, used for non-featured tiers.
- **Submit ("Schedule my clean →"):** Full-width inverse-surface pill inside the form panel, with an inline arrow.
- **Icon circle:** 44px outlined circle (play, ↗ arrow, carousel ← →). The active or next carousel control is filled dark green.

### Navigation
- **Top bar:** 36px dark-green strip with an announcement on the left and contact on the right, in 12px cream text.
- **Main nav:** Logo (a dark-green rounded square with a house glyph, plus the "Brightnest" wordmark in 20px semibold), centered text links, then "Log in" and a primary button on the right.

### Badges & Chips
- **Announcement badge:** White pill containing a lime "NEW" pill, followed by the label.
- **Most popular:** Small lime pill in the top-right corner of the featured pricing card.
- **Social proof cluster:** Overlapping 36px circular avatars (with a dark "2k+" counter), gold stars and a "4.9 rating" caption.

### Cards
- **Service card:** White, inset rounded photo, italic serif index numeral bottom-left, circular ↗ button right, 22px title and muted description. The **featured/active** variant inverts to forest green with lime numeral and lime-filled arrow.
- **Stat chips:** Dark (lime numerals, for example "[97%]" and "98%") or white (dark numerals, for example "[12k+]"), with a 12px caption below.
- **Step card:** On the dark band. A lime icon well top-left, a very large outlined or low-opacity numeral ("01") top-right, then title and description.
- **Pricing card:** Tier name, one-line audience caption, large price with "/ visit" suffix, a checklist with mint check icons, and a full-width pill CTA. The featured tier inverts to forest green with lime price, lime checks and lime CTA.
- **Testimonial card:** Gold stars, quote in 15px semibold, avatar, name and role. Shown in a white and a dark variant side by side.

### Forms
- **Booking shell:** Green container. On the left: heading with serif "*today*", a reassurance line, and contact rows with small tinted icon tiles. On the right: a white form panel.
- **Inputs:** 44px tall, 8px radius, faint cream fill, hairline border, 11px labels above. Includes text, email, a select with chevron, and a date picker with a calendar icon in a two-column grid.
- **Newsletter:** Translucent dark pill input with a lime "Subscribe" pill set inside its right end.

### Toggles
- **Segmented control:** White pill track with 4px padding. The active segment is a forest-green pill with white text. Used for service audience ("For homes / For business") and billing frequency ("One-time / Weekly / Bi-weekly / Monthly").

### FAQ Accordion
- White 14px-radius rows with semibold questions. A **lime-wash circle "+"** marks closed items. A **dark circle "−"** marks the open item, which reveals muted body text below the question.

### Footer
- Inverse-surface background. Newsletter headline and input on the left. Three link columns on the right, each with a lime uppercase heading and muted cream links. A legal line sits above a giant cropped "Brightnest" wordmark in a tone-on-tone green.
