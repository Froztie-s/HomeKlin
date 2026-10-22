import { describe, expect, it } from "vitest";
import { formatRating, formatRupiah } from "@/lib/format";

// Intl puts a no-break space (U+00A0) between "Rp" and the amount.
const NBSP = " ";

describe("formatRupiah", () => {
  it("formats whole rupiah with dots as thousand separators", () => {
    expect(formatRupiah(150000, "id")).toBe(`Rp${NBSP}150.000`);
  });

  it("formats millions", () => {
    expect(formatRupiah(1250000, "id")).toBe(`Rp${NBSP}1.250.000`);
  });

  it("formats zero", () => {
    expect(formatRupiah(0, "id")).toBe(`Rp${NBSP}0`);
  });

  it("shows no decimals and rounds fractions to the nearest rupiah", () => {
    expect(formatRupiah(84999.6, "id")).toBe(`Rp${NBSP}85.000`);
  });

  it("keeps the rupiah as Indonesians write it on English pages, not as IDR 85,000", () => {
    expect(formatRupiah(85000, "en")).toBe(`Rp${NBSP}85.000`);
    expect(formatRupiah(1250000, "en")).toBe(`Rp${NBSP}1.250.000`);
  });

  it("refuses values that are not finite numbers instead of printing Rp NaN", () => {
    expect(() => formatRupiah(Number.NaN, "id")).toThrow(RangeError);
    expect(() => formatRupiah(Number.POSITIVE_INFINITY, "en")).toThrow(RangeError);
  });
});

describe("formatRating", () => {
  it("uses a decimal comma, as Indonesian readers expect", () => {
    expect(formatRating(4.9, "id")).toBe("4,9");
  });

  it("keeps the decimal comma on English pages, like the prices", () => {
    expect(formatRating(4.9, "en")).toBe("4,9");
  });

  it("always shows one decimal place", () => {
    expect(formatRating(5, "id")).toBe("5,0");
    expect(formatRating(5, "en")).toBe("5,0");
  });

  it("rounds to one decimal place", () => {
    expect(formatRating(4.86, "id")).toBe("4,9");
  });
});
