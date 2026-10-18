// PREVIEW DATA, for the T3 design review only.
// The static customer home shows these fictional agencies and this fictional job so the look can
// be reviewed before the catalog exists. T7-T8 replace this file with real catalog data and the
// customer's real order status. Every name here is invented; none is a real company or person.

export type ServiceArea = { id: string; label: string };

export type PreviewAgency = {
  id: string;
  name: string;
  initials: string;
  rating: number;
  reviewCount: number;
  district: string;
  verified: boolean;
  services: readonly string[];
  nextSlot: string;
  startingPrice: number;
};

export type PreviewJob = {
  status: string;
  service: string;
  agency: string;
  scheduled: string;
  arrivedAt: string;
};

export const serviceAreas: readonly ServiceArea[] = [
  { id: "jakarta-selatan", label: "Jakarta Selatan" },
  { id: "jakarta-pusat", label: "Jakarta Pusat" },
  { id: "jakarta-barat", label: "Jakarta Barat" },
  { id: "jakarta-timur", label: "Jakarta Timur" },
  { id: "jakarta-utara", label: "Jakarta Utara" },
];

export const previewArea = serviceAreas[0];

export const previewAgencies: readonly PreviewAgency[] = [
  {
    id: "melati-kilau",
    name: "Melati Kilau",
    initials: "MK",
    rating: 4.9,
    reviewCount: 212,
    district: "Kebayoran Baru",
    verified: true,
    services: ["Pembersihan Rutin", "Deep Cleaning"],
    nextSlot: "Besok, 08.00",
    startingPrice: 85000,
  },
  {
    id: "sinar-rapi",
    name: "Sinar Rapi",
    initials: "SR",
    rating: 4.8,
    reviewCount: 168,
    district: "Cilandak",
    verified: true,
    services: ["Pembersihan Rutin", "Sofa & Karpet"],
    nextSlot: "Hari ini, 15.00",
    startingPrice: 95000,
  },
  {
    id: "teduh-bersih",
    name: "Teduh Bersih",
    initials: "TB",
    rating: 4.7,
    reviewCount: 94,
    district: "Tebet",
    verified: true,
    services: ["Deep Cleaning", "Dapur & Kamar Mandi"],
    nextSlot: "Besok, 10.00",
    startingPrice: 120000,
  },
  {
    id: "griya-bening",
    name: "Griya Bening",
    initials: "GB",
    rating: 4.6,
    reviewCount: 57,
    district: "Pasar Minggu",
    verified: true,
    services: ["Pembersihan Rutin", "Dapur & Kamar Mandi", "Sofa & Karpet"],
    nextSlot: "Sab, 09.00",
    startingPrice: 90000,
  },
];

export const previewJob: PreviewJob = {
  status: "Petugas sudah check-in",
  service: "Pembersihan Rutin",
  agency: "Melati Kilau",
  scheduled: "Hari ini, 09.00",
  arrivedAt: "09.04",
};
