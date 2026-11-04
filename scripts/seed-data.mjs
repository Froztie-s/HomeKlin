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
 * @type {readonly { localPart: string, role: "customer" | "cleaner" | "agency" | "admin" | "owner", fullName?: string, agency?: string }[]}
 */
export const demoAccounts = [
  { localPart: "pelanggan", role: "customer", fullName: "Nadia Puspitasari" },
  { localPart: "admin", role: "admin", fullName: "Galih Prasetyo" },
  // The owner of HomeKlin (T29b): business numbers, partner agencies and admin accounts.
  { localPart: "pemilik", role: "owner", fullName: "Rahmat Hidayat" },
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
 * HomeKlin's services and its one price list (prices in whole rupiah), as first seeded. The landing
 * page features the first four that have a photo (src/components/customer/service-photos.ts).
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

/**
 * Finished jobs of the demo customer, so replay can be shown without doing a whole job first (T13).
 * Fixed ids: each seed run replaces these orders, and only these, so real test orders are never touched.
 */
export const demoJobs = [
  { id: "d3a0c1e2-0001-4000-8000-000000000001", serviceId: "regular", areaId: "jakarta-selatan", agency: "kilau-teratai", cleaner: "petugas.yuliana", daysAgo: 1 },
  { id: "d3a0c1e2-0002-4000-8000-000000000002", serviceId: "deep", areaId: "jakarta-pusat", agency: "cemara-rapi", cleaner: "petugas.ratna", daysAgo: 3 },
];

/**
 * A paid job of the demo customer that starts 10 minutes after the seed runs, assigned to a demo
 * cleaner who has not checked in yet (T17, T18): seed shortly before a demo to show check-in, the live
 * view and check-out. Check-in opens 15 minutes before the window.
 */
export const todayJob = {
  id: "d3a0c1e2-0003-4000-8000-000000000003",
  serviceId: "regular",
  areaId: "jakarta-selatan",
  agency: "kilau-teratai",
  cleaner: "petugas.yuliana",
  startsInMinutes: 10,
  hours: 3,
};

/** The photo each demo cleaner shows the customer, a file in public/images. */
export const cleanerPhotos = { "petugas.yuliana": "/images/cleaner-portrait.jpg", "petugas.ratna": "/images/cleaner-avatar.jpg" };

export const demoJobAddress = "Jl. Melati Contoh No. 12, Jakarta";
export const demoJobPhone = "+6281200000000";

/**
 * HomeKlin's FAQ (T19), in both languages. Fixed ids: the seed brings these entries up to date and
 * leaves entries admin added alone. It speaks as HomeKlin only, never naming a partner agency.
 */
export const faqEntries = [
  {
    id: "f0a0c1e2-0001-4000-8000-000000000001",
    questionId: "Bagaimana cara memesan layanan kebersihan?",
    questionEn: "How do I book a cleaning service?",
    answerId: "Pilih layanan, area, dan jadwal kedatangan, lalu isi alamat dan nomor telepon. Kami mengirim kode 6 angka ke email Anda; setelah kode dimasukkan, pesanan dibuat dan Anda bisa langsung membayar.",
    answerEn: "Choose a service, your area and an arrival time, then enter your address and phone number. We email you a 6-digit code; once you enter it, the order is placed and you can pay straight away.",
    keywords: "pesan booking order jadwal schedule kode code",
  },
  {
    id: "f0a0c1e2-0002-4000-8000-000000000002",
    questionId: "Metode pembayaran apa saja yang tersedia?",
    questionEn: "Which payment methods can I use?",
    answerId: "Pembayaran melalui Midtrans: virtual account bank, kartu kredit, dan dompet digital. Pesanan dikonfirmasi setelah Midtrans memberi tahu kami bahwa pembayaran berhasil.",
    answerEn: "Payment goes through Midtrans: bank virtual accounts, credit cards and e-wallets. Your order is confirmed once Midtrans tells us the payment succeeded.",
    keywords: "bayar payment midtrans transfer kartu card refund",
  },
  {
    id: "f0a0c1e2-0003-4000-8000-000000000003",
    questionId: "Siapa yang bisa menonton siaran langsung pembersihan?",
    questionEn: "Who can watch the live video of the cleaning?",
    answerId: "Hanya Anda dan tim pemantau HomeKlin, dan hanya selama pekerjaan Anda berlangsung. Petugas menyiarkan dari ponselnya setelah check-in di alamat Anda.",
    answerEn: "Only you and the HomeKlin monitoring team, and only while your job is in progress. The cleaner streams from their phone after checking in at your address.",
    keywords: "live siaran langsung video kamera camera privasi privacy",
  },
  {
    id: "f0a0c1e2-0004-4000-8000-000000000004",
    questionId: "Berapa lama rekaman disimpan?",
    questionEn: "How long is the recording kept?",
    answerId: "Rekaman pekerjaan Anda bisa diputar ulang selama 7 hari, lalu dihapus otomatis demi privasi Anda.",
    answerEn: "You can replay the recording of your job for 7 days; after that it is deleted automatically for your privacy.",
    keywords: "rekaman recording replay putar ulang hapus delete 7 hari days",
  },
  {
    id: "f0a0c1e2-0005-4000-8000-000000000005",
    questionId: "Bagaimana jika petugas terlambat atau tidak datang?",
    questionEn: "What if the cleaner is late or does not arrive?",
    answerId: "Petugas datang dalam rentang jadwal kedatangan yang Anda pilih. Jika belum datang di akhir rentang itu, hubungi admin dan tandai mendesak; kami segera membantu.",
    answerEn: "The cleaner arrives within the arrival window you chose. If nobody has come by the end of it, contact admin and mark it urgent; we will help right away.",
    keywords: "terlambat late tidak datang no show petugas cleaner",
  },
  {
    id: "f0a0c1e2-0006-4000-8000-000000000006",
    questionId: "Bisakah saya mengubah atau membatalkan pesanan?",
    questionEn: "Can I change or cancel my order?",
    answerId: "Pesanan yang belum dibayar batal sendiri setelah 60 menit. Untuk mengubah jadwal pesanan yang sudah dibayar, hubungi admin dan sebutkan pesanan Anda.",
    answerEn: "An unpaid order is cancelled automatically after 60 minutes. To change the time of a paid order, contact admin and mention your order.",
    keywords: "batal cancel ubah change jadwal reschedule",
  },
  {
    id: "f0a0c1e2-0007-4000-8000-000000000007",
    questionId: "Di area mana HomeKlin melayani?",
    questionEn: "Which areas does HomeKlin serve?",
    answerId: "Saat ini Jakarta Selatan, Jakarta Pusat, Jakarta Barat, dan Jakarta Timur. Jakarta Utara segera menyusul.",
    answerEn: "Currently South, Central, West and East Jakarta. North Jakarta is coming soon.",
    keywords: "area wilayah jakarta lokasi location",
  },
  {
    id: "f0a0c1e2-0008-4000-8000-000000000008",
    questionId: "Bagaimana petugas HomeKlin dipilih?",
    questionEn: "How are HomeKlin cleaners chosen?",
    answerId: "Setiap Petugas HomeKlin terlatih dan terverifikasi. Anda melihat nama dan fotonya di pesanan sebelum ia datang, dan ia harus check-in di alamat Anda sebelum mulai.",
    answerEn: "Every HomeKlin cleaner is trained and verified. You see their name and photo on your order before they arrive, and they must check in at your address before starting.",
    keywords: "petugas cleaner aman safe verifikasi verified",
  },
];
