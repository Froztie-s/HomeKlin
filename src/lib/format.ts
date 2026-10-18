// Number formatting for prices and ratings, in Indonesian conventions.
// T4 passes the active locale in; until then everything is id-ID.

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const rating = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Whole rupiah, e.g. 150000 -> "Rp 150.000" (with a no-break space). */
export function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`Cannot format ${amount} as rupiah`);
  }
  return rupiah.format(amount);
}

/** A star rating with one decimal, e.g. 4.9 -> "4,9". */
export function formatRating(value: number): string {
  return rating.format(value);
}
