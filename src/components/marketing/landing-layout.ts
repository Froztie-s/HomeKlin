// The landing page's grid (markdown/design.md, Layout & Spacing), shared by every section so the
// edges line up: a 1280 px column with 16 px (notch-safe) side margins on phones, 32 px from 768 px
// and 80 px from 1280 px; sections breathe 64 px on phones, 96 px from 768 px and 120 px from 1280 px.
export const landingContainer = "mx-auto w-full max-w-landing px-safe md:px-gutter-wide xl:px-gutter-landing";

export const landingSection = "py-16 md:py-24 xl:py-30";

// The sticky header row is 64 px, so in-page anchors land just below it.
export const anchorOffset = "scroll-mt-20";
