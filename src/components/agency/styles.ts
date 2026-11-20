// The agency back office's buttons and small controls (T27-T29), in the redesign's back-office look
// since D2 (markdown/design.md, Buttons and Forms; the agency layout opts in to `.theme-forest`): pills
// with 44 px targets, a forest primary, an outlined secondary and an outlined danger for removing, and
// `sm` fields. Hover changes the colour; a press darkens and presses in to 98% (never a lift), in
// 150 ms. The owner console uses them too, so the partner screens' own motion (easing the press, and
// colour only under reduced motion) lives in ./motion.css, not here. Focus rings come from the global
// :focus-visible rule. aria-disabled keeps a busy button focusable.

const pill =
  "inline-flex min-h-touch shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-out-quart active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 aria-disabled:cursor-progress aria-disabled:active:scale-100";

export const primaryButton = `${pill} bg-primary text-on-primary hover:bg-primary-container active:bg-band aria-disabled:bg-primary-container`;

export const secondaryButton = `${pill} border border-border-control bg-card text-ink hover:bg-sunken active:bg-lime-wash`;

export const dangerButton = `${pill} border border-danger bg-card text-danger hover:bg-danger-surface active:bg-danger-surface`;

// A quiet text button for a change made from a list row (audit item 5: the owner's "Tangguhkan" and
// "Aktifkan lagi" on /owner/agencies). No edge and no fill until hovered, so a row's action does not
// compete with the page's own; the word and its icon stay, and the target stays 44 px tall.
const quietPill =
  "inline-flex min-h-touch shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap text-ink-muted transition-[background-color,color,transform] duration-150 ease-out-quart active:scale-[0.98]";

export const quietButton = `${quietPill} hover:bg-sunken hover:text-ink active:bg-lime-wash`;

/** The quiet button for a change that takes something away: red only on hover and press. */
export const quietDangerButton = `${quietPill} hover:bg-danger-surface hover:text-danger active:bg-danger-surface active:text-danger`;

/** A compact field inside a list row (capacity, the cleaner select): 44 px tall, 16 px text on phones. */
export const rowControl =
  "h-touch rounded-sm border border-border-control bg-card px-3.5 text-base text-ink transition-colors duration-150 ease-out-quart hover:border-primary aria-invalid:border-danger aria-invalid:bg-danger-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-sunken lg:text-sm";

/** A text link inside a table or card: forest, underlined on hover, a 44 px target. */
export const textLink =
  "inline-flex min-h-touch items-center gap-1.5 rounded-sm font-semibold text-primary underline-offset-4 transition-colors duration-150 ease-out-quart hover:underline active:text-band";

/** The white card every agency section sits in (design.md, data-table and panels): `lg`, no edge. */
export const panel = "rounded-lg bg-card";
