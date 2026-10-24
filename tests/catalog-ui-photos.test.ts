import { existsSync } from "node:fs";
import { join } from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { hasServicePhoto, servicePhoto, type ServicePhotoKey } from "@/components/customer/service-photos";
import type { Service } from "@/lib/catalog/catalog";
import en from "@/messages/en.json";
import id from "@/messages/id.json";

// The photos of HomeKlin's services (T8): the catalog holds none, so the customer pages look them up
// by service id, and every other service shows its type's icon.
const photoKeys = Object.keys(id.ServicePhotos) as ServicePhotoKey[];
const altId = createTranslator({ locale: "id", messages: id, namespace: "ServicePhotos" });
const altEn = createTranslator({ locale: "en", messages: en, namespace: "ServicePhotos" });

describe("service photos", () => {
  it("has a photo for the four services the landing page has always shown", () => {
    expect(photoKeys.sort()).toEqual(["deep", "kitchen-bathroom", "regular", "sofa-carpet"]);
  });

  it("points every photo at a file in public/ and gives it an alt text in both languages", () => {
    for (const key of photoKeys) {
      const match = servicePhoto(key);
      expect(match?.key, key).toBe(key);
      expect(existsSync(join(process.cwd(), "public", match!.photo.src)), key).toBe(true);
      expect(match!.photo.width, key).toBeGreaterThan(0);
      expect(match!.photo.height, key).toBeGreaterThan(0);
      expect(altId(key), key).not.toBe("");
      expect(altEn(key), key).not.toBe("");
    }
  });

  it("has no photo for a service admin adds later, nor for an inherited object key", () => {
    expect(servicePhoto("mattress")).toBeNull();
    expect(servicePhoto("toString")).toBeNull();
    const added = { id: "test-new-service" } as Service;
    expect(hasServicePhoto(added)).toBe(false);
  });

  it("describes what the photos show without naming who provides the cleaners", () => {
    expect(JSON.stringify([id.ServicePhotos, en.ServicePhotos])).not.toMatch(/agensi|agency|mitra|partner/i);
  });
});
