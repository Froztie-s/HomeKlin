// SAMPLE DATA for the preview of the landing page and the customer app (the only source for both).
// Everything here is fictional: the prices, durations and free slots, the running job, and the cleaner
// "Wulan Anggraeni" (a stock photo with an invented name; credits in markdown/image-sources.md).
// Replaced by real data in T8 (the services, prices and free slots per area that T7 put in the
// database, read through src/lib/catalog/catalog.ts),
// T12 (the customer's orders) and T28 (the cleaner assigned to a job).
// The data keeps ids, numbers and photo files only. Every word people read or hear (names,
// descriptions, durations, slot labels, alt texts) is in the PreviewData and Service namespaces of
// src/messages/*.json, keyed by these ids, so it exists in Indonesian and English.
// One brand to the customer (markdown/PRODUCT.md principle 6): nothing here names who supplies the cleaners.

export const serviceAreas = [
  "jakarta-selatan",
  "jakarta-pusat",
  "jakarta-barat",
  "jakarta-timur",
  "jakarta-utara",
] as const;

/** A service area id; its name is PreviewData.areas.<id>. */
export type ServiceAreaId = (typeof serviceAreas)[number];

export const defaultArea: ServiceAreaId = "jakarta-selatan";

/**
 * A photo in public/images, with its intrinsic size so next/image can reserve the space.
 * `focus` is the CSS object-position to keep in frame when a wide crop cuts the photo (default centre).
 * The alt text is a message (PreviewData.services.<id>.photoAlt, PreviewData.cleanerPhotoAlt).
 */
export type PreviewPhoto = { src: string; width: number; height: number; focus?: string };

export type PreviewServiceId = "regular" | "deep" | "sofa-carpet" | "kitchen-bathroom";

export type PreviewService = {
  /** Also the key of its name, description, next free slot and photo alt in PreviewData.services. */
  id: PreviewServiceId;
  /** About how long the job takes, in whole hours (Service.duration: "± 2 jam", "About 2 hours"). */
  hours: number;
  /** Whole rupiah; shown with formatRupiah after "mulai dari" / "from". */
  startingPrice: number;
  photo: PreviewPhoto;
};

export type PreviewCleaner = { name: string; photo: PreviewPhoto };

export type PreviewJob = {
  serviceId: PreviewServiceId;
  /** Times as shown in both languages (24-hour clock with a dot, the Indonesian convention). */
  checkedInAt: string;
  finishesAround: string;
  cleaner: PreviewCleaner;
};

export const previewServices: readonly PreviewService[] = [
  {
    id: "regular",
    hours: 2,
    startingPrice: 85000,
    photo: { src: "/images/service-regular.jpg", width: 1200, height: 675 },
  },
  {
    id: "deep",
    hours: 4,
    startingPrice: 250000,
    photo: { src: "/images/service-deep.jpg", width: 1200, height: 800 },
  },
  {
    id: "sofa-carpet",
    hours: 2,
    startingPrice: 150000,
    photo: { src: "/images/service-sofa.jpg", width: 1200, height: 800 },
  },
  {
    id: "kitchen-bathroom",
    hours: 3,
    startingPrice: 120000,
    photo: { src: "/images/service-kitchen-bath.jpg", width: 1200, height: 800, focus: "50% 25%" },
  },
];

export const previewCleaner: PreviewCleaner = {
  name: "Wulan Anggraeni",
  photo: { src: "/images/cleaner-avatar.jpg", width: 400, height: 400 },
};

export const previewJob: PreviewJob = {
  serviceId: "regular",
  checkedInAt: "09.04",
  finishesAround: "11.00",
  cleaner: previewCleaner,
};
