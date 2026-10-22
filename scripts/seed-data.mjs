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
