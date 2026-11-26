import { Bricolage_Grotesque, Figtree } from "next/font/google";

// The apps' two families (T3b; see the Token mapping in markdown/design.md), loaded once for the root
// layout. The redesign's fonts are in src/app/fonts-forest.ts, loaded only by the pages that opt in
// to `.theme-forest` (the landing page and the admin console). Both are variable fonts, so no weights
// are listed.
// Bricolage Grotesque also loads its optical-size axis: large headings get the display cut.
// Since the redesign (D5) every route group uses the forest fonts; only the 404 page still uses these
// two, so they are not preloaded (`preload: false`): preloading them put 140 KB at High priority ahead
// of the landing page's LCP image on every page (T36, docs/qa/webperf-2026-11-26.md, finding 1).
// Source: node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md
// ("Using a font definitions file")
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  preload: false,
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
  preload: false,
});

/** The CSS variables for both families, for the <html> element. */
export const appFontVariables = `${bricolage.variable} ${figtree.variable}`;
