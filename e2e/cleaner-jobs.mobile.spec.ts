import { expect, test, type Page } from "@playwright/test";
import { adminClient, type TestUser } from "../tests/integration/test-project";
import {
  createJobWorld,
  isJakartaToday,
  jakartaClock,
  jobPhone,
  jobService,
  seededAgencyId,
  sessionOf,
  type JobTimes,
  type JobWorld,
} from "./job-test-data";
import type { StorageState } from "./setup/auth-state";

// T17 and T18 on a phone, on the D4 pages. The cleaner's /cleaner/jobs lists only their own assigned
// jobs (today first, then upcoming, then just finished) as cards with the window in WIB, the service,
// the address and the customer; each card opens the job's page /cleaner/jobs/HK-xxxx, which adds the
// customer's phone link, the customer's note and the stream consent. Check-in on that page asks the
// browser for the location, works only in the job's window and records the time and place; check-out,
// after a confirm step, completes the job (the server attaches a recording, or says calmly that it
// could not). Another cleaner's job is not found, not even by its number.
// The spec makes its own cleaners at a seeded agency and writes its own paid jobs (e2e/job-test-data.ts),
// so the list holds exactly these jobs whatever other specs do. The tests build on each other (location
// refused, then check-in, then check-out), so they run in order.

test.describe.configure({ mode: "serial", timeout: 90_000 });

const address = {
  open: "Jl. Uji Check-in No. 17, Cakung, Jakarta Timur",
  early: "Jl. Uji Nanti No. 18, Cakung, Jakarta Timur",
  other: "Jl. Rahasia Petugas Lain No. 19, Cakung, Jakarta Timur",
};
const note = "Kunci ada di satpam.";
const place = { latitude: -6.2251, longitude: 106.9002, accuracy: 18 };

let world: JobWorld;
let cleaner: TestUser;
let session: StorageState;
const jobs: Record<keyof typeof address, { id: string; code: string } & JobTimes> = {} as never;

test.use({ storageState: async ({}, provide) => provide(session) });

test.beforeAll(async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  world = await createJobWorld("t17m");
  const agencyId = await seededAgencyId();
  cleaner = await world.cleaner(agencyId, "Uji Petugas Ponsel");
  const otherCleaner = await world.cleaner(agencyId, "Uji Petugas Lain");
  // Open now: check-in opens 15 minutes before the window. The early one opens in about 1 h 45 min.
  jobs.open = await world.job({ agencyId, cleaner, startsIn: 5, address: address.open, note });
  jobs.early = await world.job({ agencyId, cleaner, startsIn: 120, address: address.early });
  jobs.other = await world.job({ agencyId, cleaner: otherCleaner, startsIn: 10, address: address.other });
  session = await sessionOf(browser, baseURL, cleaner);
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  await world?.cleanup();
});

const sectionOf = (startsAt: string, language: "id" | "en" = "id") =>
  isJakartaToday(startsAt) ? (language === "id" ? /^Hari ini, / : /^Today, /) : language === "id" ? "Akan datang" : "Upcoming";
const windowOf = (job: JobTimes) => `${jakartaClock(job.startsAt)}-${jakartaClock(job.endsAt)} WIB`;
const jobPath = (job: { code: string }, language: "id" | "en" = "id") => `${language === "en" ? "/en" : ""}/cleaner/jobs/${job.code}`;

async function settle(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByText(/^(Memuat…|Loading…)$/)).toHaveCount(0);
}

// 2026-11-20 (UX audit): the home leads straight to the job to do next.
test("the home shows the next job, which opens its page", async ({ page }) => {
  await settle(page, "/cleaner");
  const next = page.getByRole("region", { name: "Pekerjaan berikutnya" });
  await expect(next).toContainText(windowOf(jobs.open));
  await expect(next).toContainText(address.open);
  await expect(next.getByRole("link")).toHaveAttribute("href", jobPath(jobs.open));
  await expect(next).toContainText("Buka untuk check-in");
});

test("lists only the cleaner's own jobs, today first, with the window, address and customer", async ({ page }) => {
  await settle(page, "/cleaner/jobs");
  await expect(page.getByRole("heading", { level: 1, name: "Pekerjaan" })).toBeVisible();

  const open = page.getByRole("region", { name: sectionOf(jobs.open.startsAt) }).getByRole("article").filter({ hasText: address.open });
  await expect(open).toBeVisible();
  await expect(open.getByRole("heading", { name: jobService.name })).toBeVisible();
  await expect(open).toContainText(windowOf(jobs.open));
  await expect(open).toContainText("Pelanggan: Uji Pelanggan Pekerjaan");
  await expect(open).toContainText("Siap check-in");
  await expect(open).toContainText("Berikutnya");
  await expect(open.getByRole("link")).toHaveAttribute("href", jobPath(jobs.open));

  const early = page.getByRole("region", { name: sectionOf(jobs.early.startsAt) }).getByRole("article").filter({ hasText: address.early });
  await expect(early).toBeVisible();
  // Two jobs only: another cleaner's job is not on the page, not even in the HTML.
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByText(address.other)).toHaveCount(0);
  expect(await page.content()).not.toContain(jobs.other.id);

  // The card opens the job's page.
  await open.getByRole("link").click();
  await expect(page).toHaveURL(jobPath(jobs.open));
  await expect(page.getByRole("heading", { level: 1, name: jobService.name })).toBeVisible();
});

test("the job page shows the address, the customer with a phone link, the note and the consent", async ({ page }) => {
  await settle(page, jobPath(jobs.open));
  const details = page.getByRole("region", { name: "Rincian pekerjaan" });
  await expect(details).toContainText(address.open);
  await expect(details).toContainText("Uji Pelanggan Pekerjaan");
  await expect(details.getByRole("link", { name: /Telepon/ })).toHaveAttribute("href", `tel:${jobPhone}`);
  // Audit item 4: the address opens in Google Maps, in a new tab, with the whole address as the query.
  const maps = details.getByRole("link", { name: "Buka di Maps (membuka tab baru)" });
  await expect(maps).toHaveAttribute("href", `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.open)}`);
  await expect(maps).toHaveAttribute("target", "_blank");
  await expect(maps).toHaveAttribute("rel", "noopener noreferrer");
  expect((await maps.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(details.getByText("Catatan pelanggan")).toBeVisible();
  await expect(details.getByText(note)).toBeVisible();
  await expect(details).toContainText("Pelanggan sudah setuju pekerjaan ini disiarkan.");
  await expect(details).toContainText(jobs.open.code);
  await expect(page.getByRole("main").getByRole("link", { name: "Pekerjaan", exact: true })).toHaveAttribute("href", "/cleaner/jobs");
  // The next step is one quiet line, not a disabled button (2026-11-20, UX audit item 11).
  await expect(page.getByRole("button", { name: /^Check-out/ })).toHaveCount(0);
  await expect(page.getByText("Check-out tersedia setelah check-in.")).toBeVisible();
});

test("a job that opens later says when check-in opens and cannot be checked in yet", async ({ page }) => {
  await settle(page, jobPath(jobs.early));
  const opensAt = jakartaClock(Date.parse(jobs.early.startsAt) - 15 * 60_000);
  await expect(page.getByRole("main")).toContainText(`Check-in dibuka pukul ${opensAt} WIB`);
  await expect(page.getByRole("button", { name: "Check-in", exact: true })).toHaveCount(0);
  // No note was written for this job, so there is no empty note line.
  await expect(page.getByText("Catatan pelanggan")).toHaveCount(0);
});

test("another cleaner's job is not found by its number, and nothing of it reaches the page", async ({ page }) => {
  await settle(page, jobPath(jobs.other));
  await expect(page.getByRole("heading", { level: 1, name: "Pekerjaan tidak ditemukan" })).toBeVisible();
  const html = await page.content();
  expect(html).not.toContain(address.other);
  expect(html).not.toContain(jobs.other.id);
  // A malformed number is not found either.
  await settle(page, "/cleaner/jobs/bukan-nomor");
  await expect(page.getByRole("heading", { level: 1, name: "Pekerjaan tidak ditemukan" })).toBeVisible();
});

test("a refused location explains how to allow it and keeps the button", async ({ page, context }) => {
  await context.clearPermissions();
  await settle(page, jobPath(jobs.open));
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Check-in", exact: true }).click();
  await expect(main.getByRole("alert")).toContainText("Akses lokasi ditolak", { timeout: 20_000 });
  await expect(main.getByRole("button", { name: "Check-in", exact: true })).toBeEnabled();
  const { data } = await adminClient().from("orders").select("checked_in_at").eq("id", jobs.open.id).single();
  expect(data?.checked_in_at).toBeNull();
});

test("check-in records the time and the location", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(place);
  await settle(page, jobPath(jobs.open));
  const main = page.getByRole("main");
  const before = Date.now();
  await main.getByRole("button", { name: "Check-in", exact: true }).click();
  await expect(main).toContainText(/Check-in pukul \d{2}\.\d{2} WIB/, { timeout: 15_000 });
  await expect(main).toContainText("Sedang dikerjakan");
  await expect(main.getByRole("button", { name: "Check-in", exact: true })).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Check-out", exact: true })).toBeVisible();
  await expect(main.getByText("Check-out tersedia setelah check-in.")).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Mulai siaran" })).toBeVisible();

  const { data } = await adminClient()
    .from("orders")
    .select("checked_in_at, check_in_lat, check_in_lng, check_in_accuracy_m, completed_at")
    .eq("id", jobs.open.id)
    .single();
  expect(data?.check_in_lat).toBeCloseTo(place.latitude, 4);
  expect(data?.check_in_lng).toBeCloseTo(place.longitude, 4);
  expect(data?.check_in_accuracy_m).toBeGreaterThanOrEqual(0);
  expect(Math.abs(Date.parse(data?.checked_in_at) - before)).toBeLessThan(60_000);
  expect(data?.completed_at).toBeNull();
  await expect(main).toContainText(`Check-in pukul ${jakartaClock(data?.checked_in_at)} WIB`);
});

test("check-out asks first, then completes the job", async ({ page }) => {
  await settle(page, jobPath(jobs.open));
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Check-out", exact: true }).click();
  await expect(main.getByText("Selesaikan pekerjaan ini?")).toBeVisible();
  await main.getByRole("button", { name: "Batal" }).click();
  await expect(main.getByText("Selesaikan pekerjaan ini?")).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Check-out", exact: true })).toBeFocused();

  await main.getByRole("button", { name: "Check-out", exact: true }).click();
  await main.getByRole("button", { name: "Ya, check-out" }).click();

  // The page redraws as finished. The server attaches a clip when the library has one, or says calmly
  // that it could not; both complete the job.
  await expect(main).toContainText(/Selesai pukul \d{2}\.\d{2} WIB/, { timeout: 20_000 });
  await expect(main).toContainText(/Pekerjaan tercatat selesai\. (Terima kasih\.|Rekamannya belum bisa dilampirkan)/);
  await expect(main.getByRole("button", { name: /Check-out|Mulai siaran/ })).toHaveCount(0);
  const { data } = await adminClient().from("orders").select("completed_at").eq("id", jobs.open.id).single();
  expect(data?.completed_at).not.toBeNull();

  // On the list the job moved to "Baru selesai"; after a reload its page shows the time, without the note.
  await settle(page, "/cleaner/jobs");
  const finished = page.getByRole("region", { name: "Baru selesai" }).getByRole("article").filter({ hasText: address.open });
  await expect(finished).toContainText("Selesai");
  await settle(page, jobPath(jobs.open));
  await expect(page.getByRole("main")).toContainText(`Selesai pukul ${jakartaClock(data?.completed_at)} WIB`);
  await expect(page.getByText(/Pekerjaan tercatat selesai/)).toHaveCount(0);
});

test("reads in English", async ({ page }) => {
  await settle(page, "/en/cleaner/jobs");
  await expect(page.getByRole("heading", { level: 1, name: "Jobs" })).toBeVisible();
  const early = page.getByRole("region", { name: sectionOf(jobs.early.startsAt, "en") }).getByRole("article").filter({ hasText: address.early });
  await expect(early.getByRole("heading", { name: jobService.nameEn })).toBeVisible();
  await expect(early).toContainText("Customer: Uji Pelanggan Pekerjaan");
  const finished = page.getByRole("region", { name: "Just finished" }).getByRole("article").filter({ hasText: address.open });
  await expect(finished).toContainText("Finished");
  await expect(page.getByText(address.other)).toHaveCount(0);

  await settle(page, jobPath(jobs.early, "en"));
  const opensAt = jakartaClock(Date.parse(jobs.early.startsAt) - 15 * 60_000);
  await expect(page.getByRole("main")).toContainText(`Check-in opens at ${opensAt} WIB`);
  await expect(page.getByRole("region", { name: "Job details" }).getByRole("link", { name: /Call/ })).toHaveAttribute("href", `tel:${jobPhone}`);
  await expect(page.getByRole("region", { name: "Job details" }).getByRole("link", { name: "Open in Maps (opens in a new tab)" })).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("main")).toContainText("The customer agreed to have this job streamed.");
});
