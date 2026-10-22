import { existsSync } from "node:fs";
import { join } from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import {
  defaultArea,
  previewCleaner,
  previewJob,
  previewServices,
  serviceAreas,
} from "@/components/customer/home-preview-data";
import en from "@/messages/en.json";
import id from "@/messages/id.json";

// The sample data shown on the landing page and in the customer app until the catalog exists.
// The data keeps ids, numbers and photo files; every word people read lives in the message files
// (PreviewData and Service namespaces), so it exists in Indonesian and English.
// One brand to the customer (markdown/PRODUCT.md principle 6): nothing in it may name a partner agency.
const previewId = createTranslator({ locale: "id", messages: id, namespace: "PreviewData" });
const previewEn = createTranslator({ locale: "en", messages: en, namespace: "PreviewData" });
const serviceId = createTranslator({ locale: "id", messages: id, namespace: "Service" });
const serviceEn = createTranslator({ locale: "en", messages: en, namespace: "Service" });

describe("preview data", () => {
  it("offers the four HomeKlin services, in the agreed order, in both languages", () => {
    expect(previewServices.map((service) => service.id)).toEqual([
      "regular",
      "deep",
      "sofa-carpet",
      "kitchen-bathroom",
    ]);
    expect(previewServices.map((service) => previewId(`services.${service.id}.name`))).toEqual([
      "Pembersihan Rutin",
      "Deep Cleaning",
      "Sofa & Karpet",
      "Dapur & Kamar Mandi",
    ]);
    expect(previewServices.map((service) => previewEn(`services.${service.id}.name`))).toEqual([
      "Regular Cleaning",
      "Deep Cleaning",
      "Sofa & Carpet",
      "Kitchen & Bathroom",
    ]);
  });

  it("gives every service a real price, a duration, a next free slot and a photo", () => {
    for (const service of previewServices) {
      expect(Number.isInteger(service.startingPrice), service.id).toBe(true);
      expect(service.startingPrice, service.id).toBeGreaterThan(0);
      expect(Number.isInteger(service.hours), service.id).toBe(true);
      expect(service.hours, service.id).toBeGreaterThan(0);
      expect(service.photo.src, service.id).toMatch(/^\/images\/.+\.jpg$/);
      for (const t of [previewId, previewEn]) {
        expect(t(`services.${service.id}.description`), service.id).not.toBe("");
        expect(t(`services.${service.id}.nextSlot`), service.id).not.toBe("");
        expect(t(`services.${service.id}.photoAlt`), service.id).not.toBe("");
      }
    }
  });

  it("states each duration as an approximate number of hours, with the right plural in English", () => {
    expect(serviceId("duration", { hours: 2 })).toBe("± 2 jam");
    expect(serviceEn("duration", { hours: 1 })).toBe("About 1 hour");
    expect(serviceEn("duration", { hours: 4 })).toBe("About 4 hours");
  });

  it("points every photo at a file that exists in public/", () => {
    for (const photo of [...previewServices.map((service) => service.photo), previewCleaner.photo]) {
      expect(existsSync(join(process.cwd(), "public", photo.src)), photo.src).toBe(true);
      expect(photo.width, photo.src).toBeGreaterThan(0);
      expect(photo.height, photo.src).toBeGreaterThan(0);
    }
  });

  it("gives every service a unique id", () => {
    const ids = previewServices.map((service) => service.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("starts in Jakarta Selatan, one of the five Jakarta service areas", () => {
    expect(serviceAreas).toHaveLength(5);
    expect(defaultArea).toBe("jakarta-selatan");
    expect(serviceAreas).toContain(defaultArea);
    expect(previewId(`areas.${defaultArea}`)).toBe("Jakarta Selatan");
    expect(previewEn(`areas.${defaultArea}`)).toBe("South Jakarta");
    for (const area of serviceAreas) {
      expect(previewId(`areas.${area}`), area).toMatch(/^Jakarta /);
      expect(previewEn(`areas.${area}`), area).toMatch(/ Jakarta$/);
    }
  });

  it("shows the assigned cleaner by name and photo only, never with an agency", () => {
    expect(previewJob.cleaner).toBe(previewCleaner);
    expect(Object.keys(previewCleaner).sort()).toEqual(["name", "photo"]);
    expect(Object.keys(previewJob)).not.toContain("agency");
    expect(previewServices.map((service) => service.id)).toContain(previewJob.serviceId);
    expect(previewId("cleanerPhotoAlt", { name: previewCleaner.name })).toBe("Foto Wulan Anggraeni");
    expect(previewEn("cleanerPhotoAlt", { name: previewCleaner.name })).toBe("Photo of Wulan Anggraeni");
  });

  it("contains no agency wording anywhere, in the data or in either language", () => {
    // Every value, alt texts included, is text the customer can read or hear.
    const data = JSON.stringify([serviceAreas, previewServices, previewCleaner, previewJob]);
    expect(data).toContain("Wulan Anggraeni");
    for (const text of [data, JSON.stringify([id.PreviewData, en.PreviewData, id.Service, en.Service])]) {
      expect(text).not.toMatch(/agensi|agency|mitra|partner/i);
    }
  });
});
