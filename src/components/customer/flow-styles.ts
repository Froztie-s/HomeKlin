// The customer pages' redesign look (D5, mocks Main, Customer-* and Phone-*), inside the `theme-forest`
// wrapper of src/app/[locale]/(customer)/layout.tsx: white cards with a 20 px radius on the cream
// page, fields filled with `field` and edged with the control colour, forest buttons and one lime
// action per screen (markdown/design.md, Buttons and Forms). Shared so the three steps and the order
// pages read as one flow.

/** A white panel on the cream page. */
export const flowCard = "rounded-lg bg-card p-5 md:p-6";

/** A card's title ("Ringkasan", "Alamat"). */
export const flowCardTitle = "font-display text-lg font-semibold text-ink";

/** The page title of a step ("Pilih layanan dan jam"): 30 px on phones, 36 px from tablets. */
export const flowPageTitle = "font-display text-headline-sm font-semibold text-ink md:text-4xl md:tracking-display";

/**
 * The note panel beside or under the summary: white with a hairline, ink text (14:1), the icon in a
 * lime-wash circle. Until the booking-flow fixes (2026-11-16) it was sunken grey on the cream page,
 * which read as a faint footnote.
 */
export const flowNote = "flex items-start gap-3 rounded-lg bg-card p-4 text-sm text-ink inset-ring-1 inset-ring-border md:p-5";

/** The icon circle of a note panel. */
export const flowNoteIcon = "flex size-9 shrink-0 items-center justify-center rounded-full bg-lime-wash text-on-lime-wash";

/** Text fields, the textarea and selects of the order form. */
export const flowInput =
  "w-full rounded-sm bg-field px-4 text-base text-ink caret-primary inset-ring-1 inset-ring-border-control transition-shadow duration-150 ease-out-quart hover:inset-ring-primary aria-invalid:bg-danger-surface aria-invalid:inset-ring-2 aria-invalid:inset-ring-danger disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-muted disabled:inset-ring-border";

/** The forest pill: the main action of a card ("Lanjut ke pembayaran", "Bayar sekarang"). */
export const flowPrimaryButton =
  "inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-on-primary transition-[background-color,transform] duration-150 ease-out-quart hover:bg-primary-container active:scale-[0.98] active:bg-band motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-muted disabled:active:scale-100";

/** The lime pill: the one main action of a page ("Pesan sekarang", "Tonton langsung"). */
export const flowAccentButton =
  "inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-lime px-6 text-base font-semibold text-on-lime transition-[filter,transform] duration-150 ease-out-quart hover:brightness-95 active:scale-[0.98] active:brightness-90 motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-muted disabled:brightness-100 disabled:active:scale-100";

/** The outlined pill on white or cream ("Kirim ulang email", "Hubungi bantuan"). */
export const flowOutlineButton =
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-full bg-card px-5 text-sm font-semibold text-ink inset-ring-[1.5px] inset-ring-outline transition-[background-color,transform] duration-150 ease-out-quart hover:bg-sunken active:scale-[0.98] active:bg-lime-wash motion-reduce:active:scale-100 disabled:cursor-progress disabled:bg-sunken disabled:text-ink-muted disabled:active:scale-100";

/** A text link inside the flow ("Ubah", "Kembali ke daftar pesanan"): underlined, a full 44 px target. */
export const flowTextLink =
  "inline-flex min-h-touch items-center gap-1.5 rounded-sm text-sm font-semibold text-primary underline decoration-1 underline-offset-4 transition-colors duration-150 ease-out-quart hover:decoration-2 active:text-band";

/**
 * A quiet text button under a card's one button ("Batalkan tautan email" under "Kirim ulang email"):
 * muted and underlined, small, still a full 44 px target, darker on hover and press.
 */
export const flowQuietButton =
  "inline-flex min-h-touch items-center gap-1.5 rounded-sm text-sm font-medium text-ink-muted underline decoration-1 underline-offset-4 transition-colors duration-150 ease-out-quart hover:text-ink hover:decoration-2 active:text-band disabled:cursor-progress disabled:no-underline";
