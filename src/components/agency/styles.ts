// The agency back office's buttons and small controls (T27-T29), in the T3b app look the back office
// still uses (markdown/design.md, "Migration notes"): pills, 44 px targets, an evergreen primary, a
// bordered secondary and a bordered danger for removing. Focus rings come from the global :focus-visible
// rule; reduced motion turns the transitions off globally. aria-disabled keeps a busy button focusable.

const pill =
  "inline-flex min-h-touch shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-out-quart active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 aria-disabled:cursor-progress aria-disabled:active:scale-100";

export const primaryButton = `${pill} bg-brand-600 text-on-brand hover:bg-brand-700 active:bg-brand-800 aria-disabled:bg-brand-700`;

export const secondaryButton = `${pill} border border-border-control bg-surface text-ink hover:bg-surface-sunken active:bg-brand-50`;

export const dangerButton = `${pill} border border-danger bg-surface text-danger hover:bg-danger-surface active:bg-danger-surface`;

/** A compact field inside a list row (capacity, the cleaner select): 44 px tall, 16 px text. */
export const rowControl =
  "h-touch rounded-full border border-border-control bg-surface px-4 text-base text-ink transition-colors duration-150 ease-out-quart hover:border-brand-600 aria-invalid:border-danger aria-invalid:bg-danger-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken";
