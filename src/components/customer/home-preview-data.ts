// SAMPLE DATA for the T3b preview of the landing page and the customer app (the only source for both).
// Everything here is fictional: the prices, durations and free slots, the running job, and the cleaner
// "Wulan Anggraeni" (a stock photo with an invented name; credits in markdown/image-sources.md).
// Replaced by real data in T7 (services and the HomeKlin price list), T8 (free slots per area),
// T12 (the customer's orders) and T28 (the cleaner assigned to a job).
// One brand to the customer (markdown/PRODUCT.md principle 6): nothing here names who supplies the cleaners.

export type ServiceArea = { id: string; label: string };

/**
 * A photo in public/images, with its intrinsic size so next/image can reserve the space.
 * `focus` is the CSS object-position to keep in frame when a wide crop cuts the photo (default centre).
 */
export type PreviewPhoto = { src: string; width: number; height: number; alt: string; focus?: string };

export type PreviewService = {
  id: string;
  name: string;
  description: string;
  duration: string;
  /** Whole rupiah; shown with formatRupiah after "mulai dari". */
  startingPrice: number;
  /** The next free slot in the chosen area (Jakarta Selatan in the preview). */
  nextSlot: string;
  photo: PreviewPhoto;
};

export type PreviewCleaner = { name: string; photo: PreviewPhoto };

export type PreviewJob = {
  service: string;
  scheduled: string;
  checkedInAt: string;
  finishesAround: string;
  cleaner: PreviewCleaner;
};

export const serviceAreas: readonly ServiceArea[] = [
  { id: "jakarta-selatan", label: "Jakarta Selatan" },
  { id: "jakarta-pusat", label: "Jakarta Pusat" },
  { id: "jakarta-barat", label: "Jakarta Barat" },
  { id: "jakarta-timur", label: "Jakarta Timur" },
  { id: "jakarta-utara", label: "Jakarta Utara" },
];

export const defaultArea: ServiceArea = serviceAreas[0];

export const previewServices: readonly PreviewService[] = [
  {
    id: "regular",
    name: "Pembersihan Rutin",
    description: "Lantai, debu, dapur, dan kamar mandi untuk perawatan rutin.",
    duration: "± 2 jam",
    startingPrice: 85000,
    nextSlot: "Besok, 08.00",
    photo: {
      src: "/images/service-regular.jpg",
      width: 1200,
      height: 675,
      alt: "Petugas kebersihan mengepel lantai ruang tamu yang terang",
    },
  },
  {
    id: "deep",
    name: "Deep Cleaning",
    description: "Pembersihan menyeluruh sampai sudut, perabot, dan peralatan dapur.",
    duration: "± 4 jam",
    startingPrice: 250000,
    nextSlot: "Sab, 09.00",
    photo: {
      src: "/images/service-deep.jpg",
      width: 1200,
      height: 800,
      alt: "Petugas kebersihan mengelap mesin kopi di meja dapur",
    },
  },
  {
    id: "sofa-carpet",
    name: "Sofa & Karpet",
    description: "Penyedotan dan pembersihan kain sofa dan karpet.",
    duration: "± 2 jam",
    startingPrice: 150000,
    nextSlot: "Hari ini, 15.00",
    photo: {
      src: "/images/service-sofa.jpg",
      width: 1200,
      height: 800,
      alt: "Petugas kebersihan bersarung tangan menyedot debu dudukan sofa",
    },
  },
  {
    id: "kitchen-bathroom",
    name: "Dapur & Kamar Mandi",
    description: "Kerak, lemak, dan noda air di dapur serta kamar mandi.",
    duration: "± 3 jam",
    startingPrice: 120000,
    nextSlot: "Besok, 10.00",
    photo: {
      src: "/images/service-kitchen-bath.jpg",
      width: 1200,
      height: 800,
      alt: "Petugas kebersihan memakai sarung tangan karet di dekat wastafel dapur",
      focus: "50% 25%",
    },
  },
];

export const previewCleaner: PreviewCleaner = {
  name: "Wulan Anggraeni",
  photo: { src: "/images/cleaner-avatar.jpg", width: 400, height: 400, alt: "Foto Wulan Anggraeni" },
};

export const previewJob: PreviewJob = {
  service: "Pembersihan Rutin",
  scheduled: "Hari ini, 09.00",
  checkedInAt: "09.04",
  finishesAround: "11.00",
  cleaner: previewCleaner,
};
