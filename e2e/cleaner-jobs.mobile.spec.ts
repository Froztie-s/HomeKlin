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

// T17 and T18 on a phone: the cleaner's /cleaner lists only their own assigned jobs (today first, then
// upcoming, then just finished), each with the service, the arrival window in WIB, the address and the
// customer with a phone link. Check-in asks the browser for the location, works only in the job's
// window and records the time and place; check-out, after a confirm step, completes the job (the
// server attaches a recording, or says calmly that it could not).
// The spec makes its own cleaners at a seeded agency and writes its own paid jobs (e2e/job-test-data.ts),
// so the list holds exactly these jobs whatever other specs do. The tests build on each other (location
// refused, then check-in, then check-out), so they run in order.

test.describe.configure({ mode: "serial", timeout: 90_000 });

const address = {
  open: "Jl. Uji Check-in No. 17, Cakung, Jakarta Timur",
  early: "Jl. Uji Nanti No. 18, Cakung, Jakarta Timur",
  other: "Jl. Rahasia Petugas Lain No. 19, Cakung, Jakarta Timur",
};
const place = { latitude: -6.2251, longitude: 106.9002, accuracy: 18 };

let world: JobWorld;
let cleaner: TestUser;
let session: StorageState;
const jobs: Record<keyof typeof address, { id: string } & JobTimes> = {} as never;

test.use({ storageState: async ({}, provide) => provide(session) });

test.beforeAll(async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  world = await createJobWorld("t17m");
  const agencyId = await seededAgencyId();
  cleaner = await world.cleaner(agencyId, "Uji Petugas Ponsel");
  const otherCleaner = await world.cleaner(agencyId, "Uji Petugas Lain");
  // Open now: check-in opens 15 minutes before the window. The early one opens in about 1 h 45 min.
  jobs.open = await world.job({ agencyId, cleaner, startsIn: 5, address: address.open });
  jobs.early = await world.job({ agencyId, cleaner, startsIn: 120, address: address.early });
  jobs.other = await world.job({ agencyId, cleaner: otherCleaner, startsIn: 10, address: address.other });
  session = await sessionOf(browser, baseURL, cleaner);
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  await world?.cleanup();
});

const cardOf = (page: Page, text: string) => page.getByRole("article").filter({ hasText: text });
const sectionOf = (startsAt: string, language: "id" | "en" = "id") =>
  isJakartaToday(startsAt) ? (language === "id" ? "Hari ini" : "Today") : language === "id" ? "Akan datang" : "Upcoming";
const windowOf = (job: JobTimes) => `${jakartaClock(job.startsAt)}-${jakartaClock(job.endsAt)} WIB`;

async function openJobs(page: Page, path = "/cleaner") {
  await page.goto(path);
  await expect(page.getByText(/^(Memuat…|Loading…)$/)).toHaveCount(0);
}

test("lists only the cleaner's own jobs, today first, with the window, address and customer", async ({ page }) => {
  await openJobs(page);
  await expect(page.getByRole("heading", { level: 1, name: "Pekerjaan hari ini" })).toBeVisible();

  const open = page.getByRole("region", { name: sectionOf(jobs.open.startsAt) }).getByRole("article").filter({ hasText: address.open });
  await expect(open).toBeVisible();
  await expect(open.getByRole("heading", { name: jobService.name })).toBeVisible();
  await expect(open).toContainText(windowOf(jobs.open));
  await expect(open).toContainText("Uji Pelanggan Pekerjaan");
  await expect(open.getByRole("link", { name: /Telepon/ })).toHaveAttribute("href", `tel:${jobPhone}`);
  await expect(open).toContainText("Siap check-in");

  const early = page.getByRole("region", { name: sectionOf(jobs.early.startsAt) }).getByRole("article").filter({ hasText: address.early });
  await expect(early).toBeVisible();
  // Two jobs only: another cleaner's job is not on the page, not even in the HTML.
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByText(address.other)).toHaveCount(0);
  expect(await page.content()).not.toContain(jobs.other.id);
});

test("a job that opens later says when check-in opens and cannot be checked in yet", async ({ page }) => {
  await openJobs(page);
  const early = cardOf(page, address.early);
  const opensAt = jakartaClock(Date.parse(jobs.early.startsAt) - 15 * 60_000);
  await expect(early).toContainText(`Check-in dibuka pukul ${opensAt} WIB`);
  await expect(early.getByRole("button", { name: "Check-in" })).toHaveCount(0);
  await expect(cardOf(page, address.open).getByRole("button", { name: "Check-in" })).toBeEnabled();
});

test("a refused location explains how to allow it and keeps the button", async ({ page, context }) => {
  await context.clearPermissions();
  await openJobs(page);
  const open = cardOf(page, address.open);
  await open.getByRole("button", { name: "Check-in" }).click();
  await expect(open.getByRole("alert")).toContainText("Akses lokasi ditolak", { timeout: 20_000 });
  await expect(open.getByRole("button", { name: "Check-in" })).toBeEnabled();
  const { data } = await adminClient().from("orders").select("checked_in_at").eq("id", jobs.open.id).single();
  expect(data?.checked_in_at).toBeNull();
});

test("check-in records the time and the location", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(place);
  await openJobs(page);
  const open = cardOf(page, address.open);
  const before = Date.now();
  await open.getByRole("button", { name: "Check-in" }).click();
  await expect(open).toContainText(/Check-in pukul \d{2}\.\d{2} WIB/, { timeout: 15_000 });
  await expect(open).toContainText("Sedang dikerjakan");
  await expect(open.getByRole("button", { name: "Check-in" })).toHaveCount(0);
  await expect(open.getByRole("button", { name: "Check-out" })).toBeVisible();

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
  await expect(open).toContainText(`Check-in pukul ${jakartaClock(data?.checked_in_at)} WIB`);
});

test("check-out asks first, then completes the job", async ({ page }) => {
  await openJobs(page);
  const open = cardOf(page, address.open);
  await open.getByRole("button", { name: "Check-out" }).click();
  await expect(open.getByText("Selesaikan pekerjaan ini?")).toBeVisible();
  await open.getByRole("button", { name: "Batal" }).click();
  await expect(open.getByText("Selesaikan pekerjaan ini?")).toHaveCount(0);
  await expect(open.getByRole("button", { name: "Check-out" })).toBeFocused();

  await open.getByRole("button", { name: "Check-out" }).click();
  await open.getByRole("button", { name: "Ya, check-out" }).click();

  // The finished job moves to "Baru selesai". The server attaches a clip when the library has one, or
  // says calmly that it could not; both complete the job.
  const finished = page.getByRole("region", { name: "Baru selesai" }).getByRole("article").filter({ hasText: address.open });
  await expect(finished).toContainText(/Selesai pukul \d{2}\.\d{2} WIB/, { timeout: 20_000 });
  await expect(finished).toContainText(/Pekerjaan tercatat selesai\. (Terima kasih\.|Rekamannya belum bisa dilampirkan)/);
  await expect(finished.getByRole("button")).toHaveCount(0);
  const { data } = await adminClient().from("orders").select("completed_at").eq("id", jobs.open.id).single();
  expect(data?.completed_at).not.toBeNull();

  // After a reload the job is still finished, without the one-time note.
  await openJobs(page);
  const reloaded = page.getByRole("region", { name: "Baru selesai" }).getByRole("article").filter({ hasText: address.open });
  await expect(reloaded).toContainText(`Selesai pukul ${jakartaClock(data?.completed_at)} WIB`);
});

test("reads in English", async ({ page }) => {
  await openJobs(page, "/en/cleaner");
  await expect(page.getByRole("heading", { level: 1, name: "Today’s jobs" })).toBeVisible();
  const early = page.getByRole("region", { name: sectionOf(jobs.early.startsAt, "en") }).getByRole("article").filter({ hasText: address.early });
  await expect(early.getByRole("heading", { name: jobService.nameEn })).toBeVisible();
  const opensAt = jakartaClock(Date.parse(jobs.early.startsAt) - 15 * 60_000);
  await expect(early).toContainText(`Check-in opens at ${opensAt} WIB`);
  await expect(early.getByRole("link", { name: /Call/ })).toHaveAttribute("href", `tel:${jobPhone}`);
  const finished = page.getByRole("region", { name: "Just finished" }).getByRole("article").filter({ hasText: address.open });
  await expect(finished).toContainText(/Finished at \d{2}\.\d{2} WIB/);
  await expect(page.getByText(address.other)).toHaveCount(0);
});
