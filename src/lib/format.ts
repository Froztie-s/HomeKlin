import type { Locale } from "next-intl";

// Number formatting for prices and ratings. It follows the page's language, but both languages use
// Indonesian number conventions: the English pages use the en-ID locale, which gives "Rp 85.000" and
// "4,9" like id-ID (en-US would print "IDR 85,000"). Prices are in rupiah for everyone.
const numberLocales: Record<Locale, string> = { id: "id-ID", en: "en-ID" };

const rupiah = new Map<Locale, Intl.NumberFormat>();
const rating = new Map<Locale, Intl.NumberFormat>();

function cached(cache: Map<Locale, Intl.NumberFormat>, locale: Locale, options: Intl.NumberFormatOptions) {
  let format = cache.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(numberLocales[locale], options);
    cache.set(locale, format);
  }
  return format;
}

/** Whole rupiah, e.g. 150000 -> "Rp 150.000" (with a no-break space), in both languages. */
export function formatRupiah(amount: number, locale: Locale): string {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`Cannot format ${amount} as rupiah`);
  }
  return cached(rupiah, locale, { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

/** A star rating with one decimal, e.g. 4.9 -> "4,9", in both languages. */
export function formatRating(value: number, locale: Locale): string {
  return cached(rating, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}
