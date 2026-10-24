// The demo data of `npm run db:seed` (scripts/seed.mjs). Everything here is fictional
// (markdown/CONSTRAINTS.md): the people and agencies are invented, and every e-mail is on example.com,
// a domain reserved for examples that never receives mail. The repo is public, so these addresses are
// public too; scripts/seed.mjs refuses any account with one of them that it did not create itself.
//
// T7 adds the agency tables and links each agency user and cleaner to its agency through `agency`.

/** The two partner agencies. `key` stays fixed, so later tasks can find each agency in the database. */
export const agencies = [
  { key: "kilau-teratai", name: "Kilau Teratai" },
  { key: "cemara-rapi", name: "Cemara Rapi" },
];

/**
 * One entry per demo user: the part of the e-mail before "@example.com", the role
 * (public.app_role) and the display name. An agency user is named after its agency.
 *
 * @type {readonly { localPart: string, role: "customer" | "cleaner" | "agency" | "admin", fullName?: string, agency?: string }[]}
 */
export const demoAccounts = [
  { localPart: "pelanggan", role: "customer", fullName: "Nadia Puspitasari" },
  { localPart: "admin", role: "admin", fullName: "Galih Prasetyo" },
  { localPart: "agensi.kilau", role: "agency", agency: "kilau-teratai" },
  { localPart: "agensi.cemara", role: "agency", agency: "cemara-rapi" },
  { localPart: "petugas.yuliana", role: "cleaner", fullName: "Yuliana Sembiring", agency: "kilau-teratai" },
  { localPart: "petugas.teguh", role: "cleaner", fullName: "Teguh Wicaksono", agency: "kilau-teratai" },
  { localPart: "petugas.ratna", role: "cleaner", fullName: "Ratna Handayani", agency: "cemara-rapi" },
  { localPart: "petugas.dimas", role: "cleaner", fullName: "Dimas Saputro", agency: "cemara-rapi" },
];

// The catalog (T7). Areas and services are HomeKlin's own data: the seed adds the ones that are missing
// and never overwrites a service that exists, so prices admin changed (T7b) survive a new seed run.

/** The service areas: five Jakarta districts. */
export const seedAreas = [
  { id: "jakarta-selatan", nameId: "Jakarta Selatan", nameEn: "South Jakarta" },
  { id: "jakarta-pusat", nameId: "Jakarta Pusat", nameEn: "Central Jakarta" },
  { id: "jakarta-barat", nameId: "Jakarta Barat", nameEn: "West Jakarta" },
  { id: "jakarta-timur", nameId: "Jakarta Timur", nameEn: "East Jakarta" },
  { id: "jakarta-utara", nameId: "Jakarta Utara", nameEn: "North Jakarta" },
];

/**
 * Which areas each partner agency serves. They overlap in Jakarta Selatan and Jakarta Pusat, so a
 * booking there can go to either agency (T9). Nobody serves Jakarta Utara yet: the customer pages show
 * their "no free slot in your area" state there (T8).
 *
 * @type {Record<string, string[]>}
 */
export const agencyAreas = {
  "kilau-teratai": ["jakarta-selatan", "jakarta-pusat", "jakarta-timur"],
  "cemara-rapi": ["jakarta-selatan", "jakarta-pusat", "jakarta-barat"],
};

/**
 * HomeKlin's services and its one price list (prices in whole rupiah). The first four are the ones the
 * landing page and the customer preview already show (src/components/customer/home-preview-data.ts).
 *
 * @type {readonly { id: string, category: "whole-home" | "rooms" | "fabrics", nameId: string, nameEn: string, descriptionId: string, descriptionEn: string, priceIdr: number, durationMinutes: number }[]}
 */
export const seedServices = [
  {
    id: "regular",
    category: "whole-home",
    nameId: "Pembersihan Rutin",
    nameEn: "Regular Cleaning",
    descriptionId: "Lantai, debu, dapur, dan kamar mandi untuk perawatan rutin.",
    descriptionEn: "Floors, dust, kitchen and bathroom, for regular upkeep.",
    priceIdr: 85000,
    durationMinutes: 120,
  },
  {
    id: "deep",
    category: "whole-home",
    nameId: "Deep Cleaning",
    nameEn: "Deep Cleaning",
    descriptionId: "Pembersihan menyeluruh sampai sudut, perabot, dan peralatan dapur.",
    descriptionEn: "A thorough clean, down to the corners, furniture and kitchen appliances.",
    priceIdr: 250000,
    durationMinutes: 240,
  },
  {
    id: "move-in-out",
    category: "whole-home",
    nameId: "Bersih Pindahan",
    nameEn: "Move-in and Move-out Cleaning",
    descriptionId: "Pembersihan menyeluruh rumah kosong sebelum Anda pindah masuk atau setelah pindah keluar.",
    descriptionEn: "A full clean of an empty home before you move in or after you move out.",
    priceIdr: 350000,
    durationMinutes: 300,
  },
  {
    id: "kitchen-bathroom",
    category: "rooms",
    nameId: "Dapur & Kamar Mandi",
    nameEn: "Kitchen & Bathroom",
    descriptionId: "Kerak, lemak, dan noda air di dapur serta kamar mandi.",
    descriptionEn: "Limescale, grease and water stains in the kitchen and bathroom.",
    priceIdr: 120000,
    durationMinutes: 180,
  },
  {
    id: "windows",
    category: "rooms",
    nameId: "Kaca & Jendela",
    nameEn: "Windows & Glass",
    descriptionId: "Kaca jendela, pintu kaca, dan kusen, di dalam dan di luar yang terjangkau.",
    descriptionEn: "Window glass, glass doors and frames, inside and the outside within reach.",
    priceIdr: 100000,
    durationMinutes: 120,
  },
  {
    id: "sofa-carpet",
    category: "fabrics",
    nameId: "Sofa & Karpet",
    nameEn: "Sofa & Carpet",
    descriptionId: "Penyedotan dan pembersihan kain sofa dan karpet.",
    descriptionEn: "Vacuuming and cleaning of sofa fabric and carpets.",
    priceIdr: 150000,
    durationMinutes: 120,
  },
  {
    id: "mattress",
    category: "fabrics",
    nameId: "Kasur",
    nameEn: "Mattress",
    descriptionId: "Penyedotan tungau debu dan pembersihan noda pada kasur.",
    descriptionEn: "Dust-mite vacuuming and stain removal for mattresses.",
    priceIdr: 90000,
    durationMinutes: 90,
  },
];

/**
 * The agencies' arrival windows: a cleaner arrives within a window and starts the job then. Four windows
 * a day (Jakarta time, UTC+7), Monday to Saturday, for the coming three weeks, with as many places per
 * window as the agency has cleaners. Run the seed again before a demo to add the days that are missing.
 */
export const slotPattern = {
  days: 21,
  /** [start, end] in whole hours, Jakarta time. */
  windows: [
    [8, 10],
    [10, 12],
    [13, 15],
    [15, 17],
  ],
  /** Sunday (Date.getUTCDay() of the Jakarta date). */
  closedWeekday: 0,
  capacity: 2,
};
