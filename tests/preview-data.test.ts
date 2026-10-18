import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultArea,
  previewCleaner,
  previewJob,
  previewServices,
  serviceAreas,
} from "@/components/customer/home-preview-data";

// The sample data shown on the landing page and in the customer app until the catalog exists.
// One brand to the customer (PRODUCT.md principle 6): nothing in it may name a partner agency.
describe("preview data", () => {
  it("offers the four HomeKlin services, in the agreed order", () => {
    expect(previewServices.map((service) => service.name)).toEqual([
      "Pembersihan Rutin",
      "Deep Cleaning",
      "Sofa & Karpet",
      "Dapur & Kamar Mandi",
    ]);
  });

  it("gives every service a real price, a duration, a next free slot and a photo", () => {
    for (const service of previewServices) {
      expect(Number.isInteger(service.startingPrice), service.name).toBe(true);
      expect(service.startingPrice, service.name).toBeGreaterThan(0);
      expect(service.duration, service.name).toMatch(/jam$/);
      expect(service.nextSlot, service.name).not.toBe("");
      expect(service.description, service.name).not.toBe("");
      expect(service.photo.src, service.name).toMatch(/^\/images\/.+\.jpg$/);
      expect(service.photo.alt, service.name).not.toBe("");
    }
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
    expect(defaultArea).toEqual({ id: "jakarta-selatan", label: "Jakarta Selatan" });
    expect(serviceAreas).toContainEqual(defaultArea);
  });

  it("shows the assigned cleaner by name and photo only, never with an agency", () => {
    expect(previewJob.cleaner).toBe(previewCleaner);
    expect(Object.keys(previewCleaner).sort()).toEqual(["name", "photo"]);
    expect(previewCleaner.photo.alt).toBe(`Foto ${previewCleaner.name}`);
    expect(Object.keys(previewJob)).not.toContain("agency");
  });

  it("contains no agency wording anywhere", () => {
    // Every value, alt texts included, is text the customer can read or hear.
    const text = JSON.stringify([serviceAreas, previewServices, previewCleaner, previewJob]);
    expect(text).toContain("Wulan Anggraeni");
    expect(text).not.toMatch(/agensi|agency|mitra/i);
  });
});
