import { existsSync } from "node:fs";
import { join } from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { previewCleaner, previewJob } from "@/components/customer/home-preview-data";
import en from "@/messages/en.json";
import id from "@/messages/id.json";

// The sample running job shown on /home and on the landing page's hero card until T12 and T28. The
// services, prices and areas around it are real since T8 (tests/catalog-ui-*.test.ts).
// The data keeps names, times and photo files; the words people read live in the PreviewData
// namespace of the message files, so they exist in Indonesian and English.
// One brand to the customer (markdown/PRODUCT.md principle 6): nothing in it may name a partner agency.
const previewId = createTranslator({ locale: "id", messages: id, namespace: "PreviewData" });
const previewEn = createTranslator({ locale: "en", messages: en, namespace: "PreviewData" });

describe("preview data", () => {
  it("names the sample job's service in both languages", () => {
    expect(previewId("jobService")).toBe("Pembersihan Rutin");
    expect(previewEn("jobService")).toBe("Regular Cleaning");
  });

  it("points the cleaner's photo at a file that exists in public/", () => {
    const { photo } = previewCleaner;
    expect(existsSync(join(process.cwd(), "public", photo.src)), photo.src).toBe(true);
    expect(photo.width).toBeGreaterThan(0);
    expect(photo.height).toBeGreaterThan(0);
  });

  it("shows the assigned cleaner by name and photo only, never with an agency", () => {
    expect(previewJob.cleaner).toBe(previewCleaner);
    expect(Object.keys(previewCleaner).sort()).toEqual(["name", "photo"]);
    expect(Object.keys(previewJob)).not.toContain("agency");
    expect(previewId("cleanerPhotoAlt", { name: previewCleaner.name })).toBe("Foto Wulan Anggraeni");
    expect(previewEn("cleanerPhotoAlt", { name: previewCleaner.name })).toBe("Photo of Wulan Anggraeni");
  });

  it("contains no agency wording anywhere, in the data or in either language", () => {
    // Every value, alt texts included, is text the customer can read or hear.
    const data = JSON.stringify([previewCleaner, previewJob]);
    expect(data).toContain("Wulan Anggraeni");
    for (const text of [data, JSON.stringify([id.PreviewData, en.PreviewData])]) {
      expect(text).not.toMatch(/agensi|agency|mitra|partner/i);
    }
  });
});
