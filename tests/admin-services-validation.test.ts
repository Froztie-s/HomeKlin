import { describe, expect, it } from "vitest";
import {
  parseServiceForm,
  parseServiceId,
  parseServiceSwitch,
  serviceFormValues,
  serviceToFormValues,
} from "@/lib/validation/service";

// The admin's service form (T7b, src/lib/validation/service.ts): every field is checked on the server
// with the limits of the database (supabase/migrations/20261024100000_catalog.sql), and each problem
// comes back as a message key per field, so the page shows it in its own language. Nothing that fails
// here may reach the database.

const valid = {
  id: "cuci-kasur",
  category: "fabrics",
  nameId: "Cuci Kasur",
  nameEn: "Mattress Wash",
  descriptionId: "Penyedotan dan pembersihan noda pada kasur.",
  descriptionEn: "Vacuuming and stain removal for mattresses.",
  priceIdr: "90000",
  durationMinutes: "90",
  sortOrder: "7",
  isActive: "on",
  locale: "en",
};

function form(fields: Record<string, string | undefined>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined) data.set(name, value);
  }
  return data;
}

describe("parseServiceForm", () => {
  it("returns the typed service, its language and whether it is active", () => {
    const result = parseServiceForm(form(valid));
    expect(result).toEqual({
      ok: true,
      locale: "en",
      data: {
        id: "cuci-kasur",
        category: "fabrics",
        nameId: "Cuci Kasur",
        nameEn: "Mattress Wash",
        descriptionId: "Penyedotan dan pembersihan noda pada kasur.",
        descriptionEn: "Vacuuming and stain removal for mattresses.",
        priceIdr: 90000,
        durationMinutes: 90,
        sortOrder: 7,
        isActive: true,
      },
    });
  });

  it("treats a missing checkbox as switched off (a new service can start hidden)", () => {
    const result = parseServiceForm(form({ ...valid, isActive: undefined }));
    expect(result.ok && result.data.isActive).toBe(false);
  });

  it("trims the texts, collapses runs of spaces and writes the id in lower case", () => {
    const result = parseServiceForm(
      form({ ...valid, id: "  Cuci-Kasur ", nameId: "  Cuci   Kasur ", descriptionEn: "Vacuuming\n and  stain removal." }),
    );
    expect(result.ok && result.data).toMatchObject({
      id: "cuci-kasur",
      nameId: "Cuci Kasur",
      descriptionEn: "Vacuuming and stain removal.",
    });
  });

  it("reads a price written with Indonesian thousands dots, spaces or a leading Rp", () => {
    for (const written of ["85.000", "85 000", "Rp 85.000", "rp85000", "Rp 85.000", "1.250.000"]) {
      const result = parseServiceForm(form({ ...valid, priceIdr: written }));
      expect(result.ok, written).toBe(true);
    }
    const result = parseServiceForm(form({ ...valid, priceIdr: "Rp 1.250.000" }));
    expect(result.ok && result.data.priceIdr).toBe(1250000);
  });

  it("never guesses at a price it cannot read for certain", () => {
    // "85,5" or "85,000" could mean 85.5 or 85000; a decimal or a misplaced dot is refused, not rounded.
    for (const written of ["85,5", "85,000", "85.5", "8.50.00", "1e5", "-5000", "abc", "85000.00"]) {
      const result = parseServiceForm(form({ ...valid, priceIdr: written }));
      expect(result, written).toMatchObject({ ok: false, fieldErrors: { priceIdr: "priceInvalid" } });
    }
  });

  it("refuses a price of zero and one above Rp 100.000.000", () => {
    expect(parseServiceForm(form({ ...valid, priceIdr: "0" }))).toMatchObject({
      ok: false,
      fieldErrors: { priceIdr: "priceTooLow" },
    });
    expect(parseServiceForm(form({ ...valid, priceIdr: "100.000.001" }))).toMatchObject({
      ok: false,
      fieldErrors: { priceIdr: "priceTooHigh" },
    });
    expect(parseServiceForm(form({ ...valid, priceIdr: "100.000.000" })).ok).toBe(true);
  });

  it("keeps the duration between 30 and 720 minutes, in whole minutes", () => {
    for (const [written, error] of [
      ["29", "durationRange"],
      ["721", "durationRange"],
      ["90.5", "durationInvalid"],
      ["dua jam", "durationInvalid"],
      ["", "durationRequired"],
    ] as const) {
      expect(parseServiceForm(form({ ...valid, durationMinutes: written })), written).toMatchObject({
        ok: false,
        fieldErrors: { durationMinutes: error },
      });
    }
    expect(parseServiceForm(form({ ...valid, durationMinutes: "30" })).ok).toBe(true);
    expect(parseServiceForm(form({ ...valid, durationMinutes: "720" })).ok).toBe(true);
  });

  it("keeps the display order a whole number from 0 to 9999", () => {
    for (const written of ["-1", "10000", "1.5", "", "satu"]) {
      expect(parseServiceForm(form({ ...valid, sortOrder: written })), written).toMatchObject({
        ok: false,
        fieldErrors: { sortOrder: "sortOrderInvalid" },
      });
    }
    expect(parseServiceForm(form({ ...valid, sortOrder: "0" })).ok).toBe(true);
  });

  it("refuses an id the database would refuse", () => {
    for (const [written, error] of [
      ["", "idRequired"],
      ["cuci kasur", "idInvalid"],
      ["cuci--kasur", "idInvalid"],
      ["-kasur", "idInvalid"],
      ["kasur_baru", "idInvalid"],
      ["a".repeat(41), "idTooLong"],
      ["Kasur Baru", "idInvalid"],
    ] as const) {
      expect(parseServiceForm(form({ ...valid, id: written })), written).toMatchObject({
        ok: false,
        fieldErrors: { id: error },
      });
    }
    expect(parseServiceForm(form({ ...valid, id: "a".repeat(40) })).ok).toBe(true);
  });

  it("keeps names to 1 to 80 characters and descriptions to 1 to 300, in both languages", () => {
    const result = parseServiceForm(
      form({ ...valid, nameId: "   ", nameEn: "n".repeat(81), descriptionId: "", descriptionEn: "d".repeat(301) }),
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        nameId: "nameRequired",
        nameEn: "nameTooLong",
        descriptionId: "descriptionRequired",
        descriptionEn: "descriptionTooLong",
      },
    });
    const longest = parseServiceForm(form({ ...valid, nameEn: "n".repeat(80), descriptionEn: "d".repeat(300) }));
    expect(longest.ok).toBe(true);
  });

  it("accepts only the three service types", () => {
    for (const written of ["", "spa", "WHOLE-HOME"]) {
      expect(parseServiceForm(form({ ...valid, category: written })), written).toMatchObject({
        ok: false,
        fieldErrors: { category: "categoryRequired" },
      });
    }
  });

  it("reports a missing field as required, not as a type error, and every problem at once", () => {
    const result = parseServiceForm(form({ locale: "id" }));
    expect(result).toEqual({
      ok: false,
      locale: "id",
      fieldErrors: {
        id: "idRequired",
        category: "categoryRequired",
        nameId: "nameRequired",
        nameEn: "nameRequired",
        descriptionId: "descriptionRequired",
        descriptionEn: "descriptionRequired",
        priceIdr: "priceRequired",
        durationMinutes: "durationRequired",
        sortOrder: "sortOrderInvalid",
      },
    });
  });

  it("falls back to Indonesian for an unknown language and never fails on it", () => {
    expect(parseServiceForm(form({ ...valid, locale: "fr" }))).toMatchObject({ ok: true, locale: "id" });
    expect(parseServiceForm(form({ ...valid, locale: undefined }))).toMatchObject({ ok: true, locale: "id" });
  });

  it("ignores fields it does not know, so a crafted post cannot set other columns", () => {
    const result = parseServiceForm(form({ ...valid, is_admin: "true", price_idr: "1" } as Record<string, string>));
    expect(result.ok && Object.keys(result.data).sort()).toEqual(
      [
        "category",
        "descriptionEn",
        "descriptionId",
        "durationMinutes",
        "id",
        "isActive",
        "nameEn",
        "nameId",
        "priceIdr",
        "sortOrder",
      ].sort(),
    );
  });
});

describe("parseServiceId", () => {
  it("returns a valid id in lower case, and null for anything the database could not hold", () => {
    expect(parseServiceId("regular")).toBe("regular");
    expect(parseServiceId(" Deep ")).toBe("deep");
    expect(parseServiceId("../etc")).toBeNull();
    expect(parseServiceId("a".repeat(41))).toBeNull();
    expect(parseServiceId(undefined)).toBeNull();
    expect(parseServiceId(["regular"])).toBeNull();
  });
});

describe("parseServiceSwitch", () => {
  it("reads which service to switch and whether it should be on", () => {
    expect(parseServiceSwitch(form({ id: "regular", isActive: "true" }))).toEqual({
      ok: true,
      data: { id: "regular", isActive: true },
    });
    expect(parseServiceSwitch(form({ id: "regular", isActive: "false" }))).toEqual({
      ok: true,
      data: { id: "regular", isActive: false },
    });
  });

  it("refuses a missing or unclear target state instead of guessing", () => {
    expect(parseServiceSwitch(form({ id: "regular" }))).toEqual({ ok: false });
    expect(parseServiceSwitch(form({ id: "regular", isActive: "yes" }))).toEqual({ ok: false });
    expect(parseServiceSwitch(form({ id: "../x", isActive: "true" }))).toEqual({ ok: false });
  });
});

describe("serviceFormValues", () => {
  it("keeps what the admin typed, as typed, to refill the form after an error", () => {
    expect(serviceFormValues(form({ ...valid, priceIdr: "85,5", isActive: undefined }))).toEqual({
      id: "cuci-kasur",
      category: "fabrics",
      nameId: "Cuci Kasur",
      nameEn: "Mattress Wash",
      descriptionId: "Penyedotan dan pembersihan noda pada kasur.",
      descriptionEn: "Vacuuming and stain removal for mattresses.",
      priceIdr: "85,5",
      durationMinutes: "90",
      sortOrder: "7",
      isActive: false,
    });
  });

  it("cuts an oversized field, so a crafted post cannot make the answer huge", () => {
    expect(serviceFormValues(form({ ...valid, nameId: "x".repeat(5000) })).nameId).toHaveLength(400);
  });
});

describe("serviceToFormValues", () => {
  it("turns a stored service into the form's starting values", () => {
    expect(
      serviceToFormValues({
        id: "regular",
        category: "whole-home",
        name: { id: "Pembersihan Rutin", en: "Regular Cleaning" },
        description: { id: "Lantai dan debu.", en: "Floors and dust." },
        priceIdr: 85000,
        durationMinutes: 120,
        isActive: true,
        sortOrder: 0,
      }),
    ).toEqual({
      id: "regular",
      category: "whole-home",
      nameId: "Pembersihan Rutin",
      nameEn: "Regular Cleaning",
      descriptionId: "Lantai dan debu.",
      descriptionEn: "Floors and dust.",
      priceIdr: "85000",
      durationMinutes: "120",
      sortOrder: "0",
      isActive: true,
    });
  });
});
