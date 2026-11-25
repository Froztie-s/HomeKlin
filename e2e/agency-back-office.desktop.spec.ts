import { expect, test, type Locator, type Page } from "@playwright/test";
import { attachRecording, recordingsBucket } from "../src/lib/recordings/attach";
import { adminClient, testProject, visitorClient } from "../tests/integration/test-project";
import { createJobWorld, jobArea, jobService, sessionOf, type JobWorld } from "./job-test-data";
import { standInClip } from "./recording-test-data";
import type { StorageState } from "./setup/auth-state";

// T27, T28 and T29 on a desk: the partner agency's back office.
// - Jadwal: it adds an arrival window in one of its areas, which a signed-out visitor then finds among
//   the area's combined free windows; it changes the window's capacity and removes it again. Every
//   refusal is shown as a message; a booked window has no remove button.
// - Petugas: it adds a cleaner with a photo; the cleaner signs in with an emailed code (here a password
//   is set afterwards with the secret key, only so the test can sign in).
// - Pesanan: it assigns that cleaner to a paid job; the cleaner then sees the job, and the customer
//   sees the cleaner's name and photo as Petugas HomeKlin, with no agency anywhere.
// - Since D2 (the partner mocks): its summary (Ringkasan) with the range in the address, incoming jobs
//   with counts, a status filter and a search, each job's own page (another agency's answers "not
//   found"), finished jobs with their recordings, and HomeKlin's services.
// - Since the Phase 15 wiring: each job's order number, the agency's fee ("perkiraan" until check-out)
//   and the customer's note; the services the agency offers, chosen with "Ubah pilihan" (B12); and a
//   cleaner's phone and area (B11).
// - Rekaman: it watches its own cleaner's live stream (the status is polled) and replays its own
//   recordings; a deleted one says so. Another agency's job, stream and recording are refused.
// The spec makes two agencies of its own serving Jakarta Timur, their cleaners and paid jobs a few
// minutes from now (e2e/job-test-data.ts), and adds its window 30 days ahead at 20.35 WIB, beyond the
// seeded 21 days and at a minute no seeded window has, so no other spec ever lists it. Everything is
// removed at the end: the jobs with their recordings and files under jobs/, the windows, the agencies
// and their cleaners, the users, and the photo in cleaner-photos. The library clip stays (shared).

test.describe.configure({ mode: "serial", timeout: 120_000 });

const agencyName = "Uji Agensi Jadwal";
const otherAgencyName = "Uji Agensi Lain";
const agencyWording = /agensi|agency|mitra|partner/i;
const photoBucket = "cleaner-photos";
const signedLink = (folder: string) => `${new URL(testProject.url).origin}/storage/v1/object/sign/recordings/${folder}/`;
// A real 1x1 PNG, so the browser can show it on the agency's and the customer's pages.
const photo = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

const address = {
  open: "Jl. Uji Penugasan No. 1, Cakung, Jakarta Timur",
  live: "Jl. Uji Siaran No. 2, Cakung, Jakarta Timur",
  finished: "Jl. Uji Rekaman No. 3, Cakung, Jakarta Timur",
  expired: "Jl. Uji Kedaluwarsa No. 4, Cakung, Jakarta Timur",
  none: "Jl. Uji Tanpa Rekaman No. 5, Cakung, Jakarta Timur",
  other: "Jl. Uji Agensi Lain No. 6, Cakung, Jakarta Timur",
};

let world: JobWorld;
let agency: Awaited<ReturnType<JobWorld["agency"]>>;
let other: Awaited<ReturnType<JobWorld["agency"]>>;
const sessions: { agency?: StorageState; customer?: StorageState } = {};
const jobs: Record<keyof typeof address, string> = {} as never;
const codes: Partial<Record<keyof typeof address, string>> = {};
const note = "Uji catatan: kunci ada di pos satpam.";
const recordings: { own?: string; expired?: string; other?: string } = {};
const newCleaner = { name: "Uji Petugas Baru", email: `homeklin-t27-cleaner-${Date.now()}@example.com`, id: "" };

// The window the spec adds: 30 days ahead in Jakarta, 20.35 to 22.05 WIB.
const windowDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(
  new Date(Date.now() + 30 * 86_400_000),
);
const windowStart = new Date(`${windowDate}T20:35:00+07:00`).toISOString();

test.beforeAll(async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const admin = adminClient();
  world = await createJobWorld("t27");
  agency = await world.agency(agencyName);
  other = await world.agency(otherAgencyName);
  const ownCleaner = await world.cleaner(agency.id, "Uji Petugas Siaran");
  const otherCleaner = await world.cleaner(other.id, "Uji Petugas Lain");

  jobs.open = (await world.job({ agencyId: agency.id, cleaner: null, startsIn: 180, address: address.open })).id;
  jobs.live = (await world.job({ agencyId: agency.id, cleaner: ownCleaner, startsIn: -30, address: address.live, checkedInMinutesAgo: 20 })).id;
  jobs.finished = (await world.job({ agencyId: agency.id, cleaner: ownCleaner, startsIn: -200, address: address.finished, completedMinutesAgo: 30 })).id;
  jobs.expired = (await world.job({ agencyId: agency.id, cleaner: ownCleaner, startsIn: -300, address: address.expired, completedMinutesAgo: 120 })).id;
  jobs.none = (await world.job({ agencyId: agency.id, cleaner: ownCleaner, startsIn: -400, address: address.none, completedMinutesAgo: 200 })).id;
  jobs.other = (await world.job({ agencyId: other.id, cleaner: otherCleaner, startsIn: -20, address: address.other, checkedInMinutesAgo: 10 })).id;

  // The live streams of the job in progress at each agency, as the cleaner's page starts them.
  const streams = await admin.from("stream_sessions").insert([
    { order_id: jobs.live, cleaner_id: ownCleaner.id, agency_id: agency.id, source: "demo", status: "active" },
    { order_id: jobs.other, cleaner_id: otherCleaner.id, agency_id: other.id, source: "demo", status: "active" },
  ]);
  if (streams.error) throw new Error(`Could not start the streams: ${streams.error.message}`);

  // Recordings: attached as check-out does, from the stand-in clip; one whose 7 days are over.
  const clip = await admin.storage.from(recordingsBucket).upload(standInClip.path, standInClip.bytes, { contentType: "video/mp4", upsert: true });
  if (clip.error) throw new Error(`Could not upload the stand-in clip: ${clip.error.message}`);
  recordings.own = (await attachRecording(admin, jobs.finished)).id;
  const otherFinished = await world.job({ agencyId: other.id, cleaner: otherCleaner, startsIn: -260, address: address.other, completedMinutesAgo: 40 });
  recordings.other = (await attachRecording(admin, otherFinished.id)).id;
  const day = 86_400_000;
  const expired = await admin
    .from("recordings")
    .insert({
      order_id: jobs.expired,
      agency_id: agency.id,
      file_path: `jobs/${jobs.expired}.mp4`,
      created_at: new Date(Date.now() - 8 * day).toISOString(),
      expires_at: new Date(Date.now() - day).toISOString(),
    })
    .select("id")
    .single<{ id: string }>();
  if (expired.error) throw new Error(`Could not add the expired recording: ${expired.error.message}`);
  recordings.expired = expired.data.id;

  // The order numbers, and a customer's note on the job under way, as booking writes it (B7).
  const { data: codeRows, error: codeError } = await admin.from("orders").select("id, code").in("id", Object.values(jobs));
  if (codeError) throw new Error(`Could not read the order numbers: ${codeError.message}`);
  for (const [key, id] of Object.entries(jobs) as [keyof typeof address, string][]) {
    codes[key] = (codeRows as { id: string; code: string }[]).find((row) => row.id === id)?.code;
  }
  const noted = await admin.from("orders").update({ customer_note: note }).eq("id", jobs.live);
  if (noted.error) throw new Error(`Could not add the note: ${noted.error.message}`);

  sessions.agency = await sessionOf(browser, baseURL, agency.user);
  sessions.customer = await sessionOf(browser, baseURL, world.customer);
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  const admin = adminClient();
  // The photo first (found from the cleaner's own row: photos have random names, with no agency in
  // the path, T34 L2), then the jobs, windows, agencies (their cleaners go with them) and users, then
  // the cleaner this spec added through the page.
  if (agency) {
    const { data: rows } = await admin.from("cleaners").select("photo_url").eq("agency_id", agency.id);
    const marker = `/storage/v1/object/public/${photoBucket}/`;
    const paths = (rows ?? [])
      .map((row) => row.photo_url as string | null)
      .filter((url): url is string => !!url && url.includes(marker))
      .map((url) => url.slice(url.indexOf(marker) + marker.length));
    if (paths.length > 0) await admin.storage.from(photoBucket).remove(paths);
  }
  await world?.cleanup();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const user of data?.users ?? []) {
    if (user.email === newCleaner.email) await admin.auth.admin.deleteUser(user.id);
  }
});

/**
 * Whether an element (or its ::after) runs a CSS animation now, and whether any of its keyframes moves
 * it (transform, translate or scale), from its computed animation-name and the page's own keyframes.
 */
function motionOf(locator: Locator, pseudo?: "::after"): Promise<{ animated: boolean; moves: boolean }> {
  return locator.evaluate((element, pseudoElement) => {
    const names = getComputedStyle(element, pseudoElement ?? null)
      .animationName.split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "none");
    const rules = [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]);
    const moves = names.some((name) =>
      rules.some((rule) => rule instanceof CSSKeyframesRule && rule.name === name && /transform|translate|scale/.test(rule.cssText)),
    );
    return { animated: names.length > 0, moves };
  }, pseudo);
}

const slotRow = (page: Page, id: string) =>page.locator(`li[data-slot="${id}"]`);
const jobRow = (table: Locator, text: string) => table.getByRole("row").filter({ hasText: text });

async function freeStarts(): Promise<string[]> {
  const from = new Date(Date.parse(windowStart) - 3_600_000).toISOString();
  const to = new Date(Date.parse(windowStart) + 3_600_000).toISOString();
  const { data, error } = await visitorClient().rpc("free_slots", { p_area: jobArea, p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { starts_at: string }[]).map((row) => new Date(row.starts_at).toISOString());
}

async function addedSlotId(): Promise<string | null> {
  const { data } = await adminClient().from("availability_slots").select("id").eq("agency_id", agency.id).eq("starts_at", windowStart).maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

test.describe("the agency", () => {
  test.use({ storageState: async ({}, provide) => provide(sessions.agency) });

  test("adds a window in one of its areas, which a visitor then sees free", async ({ page }) => {
    await page.goto("/agency/schedule");
    await expect(page.getByRole("heading", { level: 1, name: "Jadwal" })).toBeVisible();
    // The way back to Petugas, where "Atur jadwal" opened it (2026-11-20, UX audit item 13).
    await expect(page.getByRole("main").getByRole("link", { name: "Petugas", exact: true })).toHaveAttribute("href", "/agency/cleaners");
    const form = page.getByRole("form", { name: "Tambah jendela" });
    await expect(form.getByLabel("Area")).toHaveValue(jobArea); // its only area is chosen already
    await form.getByLabel("Tanggal").fill(windowDate);
    await form.getByLabel("Mulai").fill("20:35");
    await form.getByLabel("Selesai").fill("22:05");
    await form.getByLabel("Kapasitas").fill("2");
    await form.getByRole("button", { name: "Tambah jendela" }).click();
    await expect(form.getByRole("status")).toContainText("Jendela ditambahkan", { timeout: 20_000 });

    const id = await addedSlotId();
    expect(id).not.toBeNull();
    // The page moved to the window's week, where it is listed with its places.
    await expect(slotRow(page, id ?? "")).toContainText("20.35-22.05 WIB");
    await expect(slotRow(page, id ?? "")).toContainText("0 dari 2 terisi");
    expect(await freeStarts()).toContain(windowStart);

    // The same start again is refused, with the reason in words.
    await form.getByRole("button", { name: "Tambah jendela" }).click();
    await expect(form.getByRole("alert")).toContainText("Sudah ada jendela di area ini yang mulai pada waktu itu.", { timeout: 20_000 });
    // So is a window that ends before it starts.
    await form.getByLabel("Selesai").fill("19:00");
    await form.getByRole("button", { name: "Tambah jendela" }).click();
    await expect(form.getByRole("alert")).toContainText("jendela harus di masa depan, selesai setelah mulai");
  });

  test("changes the window's capacity, and a capacity out of range is refused", async ({ page }) => {
    const id = (await addedSlotId()) ?? "";
    await page.goto(`/agency/schedule?week=4`);
    const row = slotRow(page, id);
    await expect(row).toBeVisible();
    // "Simpan" shows only once the number is changed (2026-11-20, UX audit item 16).
    await expect(row.getByRole("button", { name: "Simpan" })).toHaveCount(0);
    await row.getByRole("spinbutton").fill("3");
    await row.getByRole("button", { name: "Simpan" }).click();
    await expect(row.getByRole("status")).toHaveText("Kapasitas disimpan.", { timeout: 20_000 });
    await expect(row.getByRole("button", { name: "Simpan" })).toHaveCount(0);
    await expect(row).toContainText("0 dari 3 terisi");
    const { data } = await adminClient().from("availability_slots").select("capacity").eq("id", id).single<{ capacity: number }>();
    expect(data?.capacity).toBe(3);

    await row.getByRole("spinbutton").fill("25");
    await row.getByRole("button", { name: "Simpan" }).click();
    await expect(row.getByRole("alert")).toHaveText("Kapasitas harus angka 1 sampai 20.", { timeout: 20_000 });
  });

  test("removes the window after confirming, and it is no longer free", async ({ page }) => {
    const id = (await addedSlotId()) ?? "";
    await page.goto(`/agency/schedule?week=4`);
    const row = slotRow(page, id);
    await row.getByRole("button", { name: /^Hapus jendela/ }).click();
    await row.getByRole("button", { name: "Batal" }).click();
    await expect(row.getByRole("button", { name: /^Hapus jendela/ })).toBeFocused();
    await row.getByRole("button", { name: /^Hapus jendela/ }).click();
    await row.getByRole("button", { name: "Ya, hapus" }).click();
    await expect(row).toHaveCount(0, { timeout: 20_000 });
    expect(await addedSlotId()).toBeNull();
    expect(await freeStarts()).not.toContain(windowStart);
  });

  test("cannot remove a window with a booking", async ({ page }) => {
    const { data } = await adminClient().from("orders").select("slot_id").eq("id", jobs.open).single<{ slot_id: string }>();
    await page.goto("/agency/schedule");
    const row = slotRow(page, data?.slot_id ?? "");
    await expect(row).toContainText("1 dari 1 terisi");
    await expect(row).toContainText("Tidak bisa dihapus, sudah ada pesanan");
    await expect(row.getByRole("button", { name: /^Hapus/ })).toHaveCount(0);
  });

  test("adds a cleaner with a photo, who appears in its list", async ({ page }) => {
    await page.goto("/agency/cleaners");
    await expect(page.getByRole("heading", { level: 1, name: "Petugas dan ketersediaan" })).toBeVisible();
    const list = page.getByRole("table", { name: "Petugas Anda" });
    await expect(list.locator("tbody tr")).toHaveCount(1); // only its own cleaner, not the other agency's
    await expect(list).toContainText("Uji Petugas Siaran");
    // The week's windows sit under the list, with the way to change them.
    await expect(page.getByRole("region", { name: "Jadwal ketersediaan" }).getByRole("link", { name: "Atur jadwal" })).toHaveAttribute("href", "/agency/schedule");

    // The header's button opens the form in a dialog (2026-11-20, UX audit item 17).
    await expect(page.getByRole("dialog", { name: "Tambah petugas" })).toBeHidden();
    await page.getByRole("link", { name: "Tambah petugas" }).click();
    await expect(page.getByRole("dialog", { name: "Tambah petugas" })).toBeVisible();
    const form = page.getByRole("form", { name: "Tambah petugas" });
    await expect(form).toContainText("kode 6 angka yang kami kirim ke email ini");
    await form.getByLabel("Nama lengkap").fill(newCleaner.name);
    await form.getByLabel("Email").fill(newCleaner.email);
    await form.getByLabel("Foto (opsional)").setInputFiles({ name: "petugas.png", mimeType: "image/png", buffer: photo });
    await expect(form.getByRole("img", { name: "Pratinjau foto petugas" })).toBeVisible();
    await form.getByRole("button", { name: "Tambah petugas" }).click();
    await expect(form.getByRole("status")).toContainText(`${newCleaner.name} ditambahkan.`, { timeout: 30_000 });
    await expect(list.locator("tbody tr")).toHaveCount(2);
    await expect(list.getByRole("img", { name: `Foto ${newCleaner.name}` })).toBeVisible();

    const { data } = await adminClient().from("cleaners").select("user_id, photo_url").eq("agency_id", agency.id).eq("full_name", newCleaner.name).single<{ user_id: string; photo_url: string }>();
    newCleaner.id = data?.user_id ?? "";
    // A random file name in the bucket, with no agency id in the address (T34, L2).
    expect(data?.photo_url).toMatch(new RegExp(`/storage/v1/object/public/${photoBucket}/[0-9a-f-]{36}\.png$`));
    expect(data?.photo_url).not.toContain(agency.id);

    // The same email again is refused, in words.
    await form.getByLabel("Nama lengkap").fill("Uji Petugas Kembar");
    await form.getByLabel("Email").fill(newCleaner.email);
    await form.getByRole("button", { name: "Tambah petugas" }).click();
    await expect(form.getByRole("alert")).toHaveText("Email ini sudah dipakai akun lain.", { timeout: 30_000 });
  });

  test("assigns its new cleaner to a paid job; a started job cannot be reassigned", async ({ page }) => {
    await page.goto("/agency/orders");
    await expect(page.getByRole("heading", { level: 1, name: "Pekerjaan masuk" })).toBeVisible();
    const table = page.getByRole("table", { name: "Pekerjaan masuk agensi Anda" });
    await expect(jobRow(table, address.other)).toHaveCount(0); // never another agency's job
    const row = jobRow(table, address.open);
    await expect(row).toContainText("Perlu petugas");
    // Its order number and the agency's expected fee (70% of Rp 150.000) until check-out.
    await expect(row).toContainText(codes.open ?? "missing");
    await expect(row).toContainText(/Rp\s105\.000\s*perkiraan/);
    await row.getByRole("combobox", { name: "Petugas untuk pesanan ini" }).selectOption({ label: newCleaner.name });
    await row.getByRole("button", { name: "Tugaskan" }).click();
    await expect(row.getByRole("status")).toHaveText(`Ditugaskan ke ${newCleaner.name}.`, { timeout: 20_000 });
    await expect(row).toContainText("Ditugaskan");
    const { data } = await adminClient().from("orders").select("cleaner_id").eq("id", jobs.open).single<{ cleaner_id: string }>();
    expect(data?.cleaner_id).toBe(newCleaner.id);

    await expect(jobRow(table, address.live).getByRole("combobox")).toHaveCount(0);
    // A finished job is no longer incoming: it is under "Pesanan selesai", with nothing to change.
    await expect(jobRow(table, address.finished)).toHaveCount(0);
    await page.goto("/agency/past");
    const past = page.getByRole("table", { name: "Pesanan selesai agensi Anda" });
    await expect(jobRow(past, address.finished)).toHaveCount(1);
    await expect(jobRow(past, address.finished).getByRole("button")).toHaveCount(0);
    await expect(jobRow(past, address.other)).toHaveCount(0);
  });

  test("filters and searches its incoming jobs through the address", async ({ page }) => {
    await page.goto("/agency/orders");
    const counts = page.getByRole("list", { name: "Jumlah pekerjaan" });
    await expect(counts).toContainText("Sedang berlangsung");
    // A count filters the list as its tab does (2026-11-20, UX audit item 14); "Selesai minggu ini" has no list here.
    await counts.getByRole("link", { name: /Perlu petugas/ }).click();
    await expect(page).toHaveURL("/agency/orders?status=unassigned");
    await expect(counts.getByRole("link", { name: /Perlu petugas/ })).toHaveAttribute("aria-current", "true");
    await expect(counts.getByRole("link")).toHaveCount(3);
    await page.goto("/agency/orders");
    const filters = page.getByRole("navigation", { name: "Filter status" });
    await filters.getByRole("link", { name: "Berlangsung" }).click();
    await expect(page).toHaveURL("/agency/orders?status=inProgress");
    await expect(filters.getByRole("link", { name: "Berlangsung" })).toHaveAttribute("aria-current", "true");
    const table = page.getByRole("table", { name: "Pekerjaan masuk agensi Anda" });
    await expect(jobRow(table, address.live)).toHaveCount(1);
    await expect(jobRow(table, address.open)).toHaveCount(0);

    await page.goto("/agency/orders");
    await page.getByRole("searchbox", { name: "Cari pekerjaan" }).fill("Uji Siaran");
    await page.getByRole("button", { name: "Cari", exact: true }).click();
    await expect(page).toHaveURL(/\/agency\/orders\?q=Uji\+Siaran$/);
    await expect(jobRow(table, address.live)).toHaveCount(1);
    await expect(jobRow(table, address.open)).toHaveCount(0);

    // The order number finds the job too.
    await page.getByRole("searchbox", { name: "Cari pekerjaan" }).fill(codes.open ?? "missing");
    await page.getByRole("button", { name: "Cari", exact: true }).click();
    await expect(jobRow(table, address.open)).toHaveCount(1);
    await expect(jobRow(table, address.live)).toHaveCount(0);
  });

  test("opens its own job, under way and finished, and is refused another agency's", async ({ page }) => {
    await page.goto(`/agency/orders/job?order=${jobs.live}`);
    await expect(page.getByRole("heading", { level: 1, name: "Pembersihan Rutin" })).toBeVisible();
    await expect(page.getByRole("main")).toContainText(address.live);
    await expect(page.getByRole("main")).toContainText("Berlangsung");
    await expect(page.getByText(new RegExp(`^Pesanan ${codes.live}, `))).toBeVisible();
    const facts = page.getByRole("region", { name: "Detail pesanan" });
    await expect(facts).toContainText(note);
    await expect(facts).toContainText(/Imbalan agensi\s*Rp\s105\.000 \(perkiraan/);
    await expect(page.getByRole("region", { name: "Siaran langsung" }).locator("video")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Kembali ke pekerjaan masuk" })).toHaveAttribute("href", "/agency/orders");

    await page.goto(`/agency/past/job?order=${jobs.finished}`);
    const recording = page.getByRole("region", { name: "Rekaman pekerjaan" });
    const src = (await recording.locator("video").getAttribute("src")) ?? "";
    expect(src.startsWith(`${signedLink("jobs")}${jobs.finished}.`)).toBe(true);
    await expect(page.getByRole("region", { name: "Status pekerjaan" })).toContainText("Check-in di alamat");
    await expect(page.getByRole("region", { name: "Detail pesanan" })).toContainText("Tidak ada catatan.");

    await page.goto(`/agency/orders/job?order=${jobs.other}`);
    await expect(page.getByRole("heading", { name: "Pesanan tidak ditemukan" })).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(address.other);
    await expect(page.locator("main video")).toHaveCount(0);
  });

  test("lists its finished jobs with where each recording stands", async ({ page }) => {
    await page.goto("/agency/past");
    await expect(page.getByRole("heading", { level: 1, name: "Pesanan selesai" })).toBeVisible();
    const table = page.getByRole("table", { name: "Pesanan selesai agensi Anda" });
    await expect(jobRow(table, address.finished)).toContainText("Tersedia sampai");
    await expect(jobRow(table, address.finished)).toContainText(codes.finished ?? "missing");
    // No fee row in this test data (check-out writes it), so the fee is still the expected one.
    await expect(jobRow(table, address.finished)).toContainText(/Rp\s105\.000\s*perkiraan/);
    await expect(jobRow(table, address.expired)).toContainText("Dihapus setelah 7 hari");
    await expect(jobRow(table, address.none)).toContainText("Tidak ada rekaman");
    await expect(jobRow(table, address.open)).toHaveCount(0);
    await page.getByRole("navigation", { name: "Filter rekaman" }).getByRole("link", { name: "Rekaman dihapus" }).click();
    await expect(page).toHaveURL("/agency/past?recording=deleted");
    await expect(jobRow(table, address.expired)).toHaveCount(1);
    await expect(jobRow(table, address.finished)).toHaveCount(0);
  });

  test("chooses the services it offers, and can offer every service again", async ({ page }) => {
    await page.goto("/agency/services");
    const table = page.getByRole("table", { name: "Layanan HomeKlin dan harganya" });
    const row = table.getByRole("row").filter({ hasText: jobService.name });
    await expect(row).toContainText("Ditawarkan");
    await expect(page.getByRole("main").getByRole("checkbox")).toHaveCount(0);

    // Batal leaves everything as it was.
    await page.getByRole("button", { name: "Ubah pilihan" }).click();
    await expect(page.getByText("Mode ubah aktif")).toBeVisible();
    const offerAll = page.getByRole("checkbox", { name: "Tawarkan semua layanan, juga layanan baru dari HomeKlin" });
    await expect(offerAll).toBeChecked();
    await offerAll.uncheck();
    await row.getByRole("checkbox", { name: `Tawarkan ${jobService.name}` }).uncheck();
    await page.getByRole("button", { name: "Batal" }).click();
    await expect(row).toContainText("Ditawarkan");
    await expect(page.getByRole("button", { name: "Ubah pilihan" })).toBeFocused();

    // Not offering one service is saved for this agency only.
    await page.getByRole("button", { name: "Ubah pilihan" }).click();
    await offerAll.uncheck();
    await row.getByRole("checkbox", { name: `Tawarkan ${jobService.name}` }).uncheck();
    await page.getByRole("button", { name: "Simpan pilihan" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pilihan layanan disimpan." })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Ubah pilihan" })).toBeVisible();
    await expect(row).toContainText("Tidak ditawarkan");
    const admin = adminClient();
    const restricted = await admin.from("agencies").select("services_restricted").eq("id", agency.id).single<{ services_restricted: boolean }>();
    expect(restricted.data?.services_restricted).toBe(true);
    const offered = await admin.from("agency_services").select("service_id").eq("agency_id", agency.id);
    expect((offered.data ?? []).map((item) => item.service_id)).not.toContain(jobService.id);
    const otherChoice = await admin.from("agencies").select("services_restricted").eq("id", other.id).single<{ services_restricted: boolean }>();
    expect(otherChoice.data?.services_restricted).toBe(false);

    // Every service again, also the ones admin adds later.
    await page.getByRole("button", { name: "Ubah pilihan" }).click();
    await offerAll.check();
    await page.getByRole("button", { name: "Simpan pilihan" }).click();
    // The edit mode closes only once the server saved the choice.
    await expect(page.getByRole("button", { name: "Ubah pilihan" })).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText("Ditawarkan");
    await expect(row).not.toContainText("Tidak ditawarkan");
    const again = await admin.from("agencies").select("services_restricted").eq("id", agency.id).single<{ services_restricted: boolean }>();
    expect(again.data?.services_restricted).toBe(false);
  });

  test("sets a cleaner's phone and area, one of its own areas", async ({ page }) => {
    await page.goto("/agency/cleaners");
    const list = page.getByRole("table", { name: "Petugas Anda" });
    const row = list.locator("tr[data-cleaner]").filter({ hasText: "Uji Petugas Siaran" });
    await expect(row).toContainText("Nomor HP belum diisi");
    await row.getByRole("button", { name: "Ubah nomor HP dan area Uji Petugas Siaran" }).click();
    const form = page.getByRole("form", { name: "Nomor HP dan area Uji Petugas Siaran" });
    await expect(form.getByLabel("Nomor HP")).toBeFocused();
    // Only the agency's own area is offered, besides "not chosen".
    await expect(form.getByLabel("Area").locator("option")).toHaveCount(2);

    await form.getByLabel("Nomor HP").fill("12345");
    await form.getByRole("button", { name: "Simpan" }).click();
    await expect(form.getByRole("alert")).toHaveText("Periksa nomor HP, misalnya 0812 3456 7890.", { timeout: 20_000 });

    await form.getByLabel("Nomor HP").fill("0812 1111 2222");
    await form.getByLabel("Area").selectOption({ index: 1 });
    await form.getByRole("button", { name: "Simpan" }).click();
    await expect(form).toHaveCount(0, { timeout: 20_000 });
    await expect(row).toContainText("+6281211112222");
    await expect(row).toContainText("Jakarta Timur");
    await expect(row.getByRole("status")).toHaveText("Data Uji Petugas Siaran disimpan.");
    const { data } = await adminClient()
      .from("cleaners")
      .select("phone, area_id")
      .eq("agency_id", agency.id)
      .eq("full_name", "Uji Petugas Siaran")
      .single<{ phone: string; area_id: string }>();
    expect(data).toEqual({ phone: "+6281211112222", area_id: jobArea });
  });

  // src/components/agency/motion.module.css: the live dot breathes, an answer slides in and an edit row
  // opens and closes; under reduced motion the dot is still and the answer only fades, and the row
  // still opens and closes.
  test("moves calmly, and holds still under reduced motion", async ({ page }) => {
    await page.goto(`/agency/orders/job?order=${jobs.live}`);
    const dot = page.getByRole("main").locator("header").getByText("Berlangsung", { exact: true }).locator('span[aria-hidden="true"]');
    await expect(dot).toHaveCount(1);
    expect(await motionOf(dot)).toEqual({ animated: true, moves: false });
    expect(await motionOf(dot, "::after")).toEqual({ animated: true, moves: true });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await motionOf(dot)).toEqual({ animated: false, moves: false });
    expect(await motionOf(dot, "::after")).toEqual({ animated: false, moves: false });

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/agency/cleaners");
    const row = page.getByRole("table", { name: "Petugas Anda" }).locator("tr[data-cleaner]").filter({ hasText: "Uji Petugas Siaran" });
    const edit = row.getByRole("button", { name: "Ubah nomor HP dan area Uji Petugas Siaran" });
    const form = page.getByRole("form", { name: "Nomor HP dan area Uji Petugas Siaran" });
    const panel = form.locator("xpath=../..");
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      await page.emulateMedia({ reducedMotion });
      await edit.click();
      await expect(form.getByLabel("Nomor HP")).toBeFocused();
      const transition = await panel.evaluate((element) => getComputedStyle(element).transitionProperty);
      expect(transition).toBe(reducedMotion === "reduce" ? "opacity" : "grid-template-rows, opacity");
      await form.getByLabel("Nomor HP").fill("12345");
      await form.getByRole("button", { name: "Simpan" }).click();
      const answer = form.getByRole("alert").locator("p");
      await expect(answer).toHaveText("Periksa nomor HP, misalnya 0812 3456 7890.", { timeout: 20_000 });
      expect(await motionOf(answer)).toEqual({ animated: true, moves: reducedMotion !== "reduce" });
      await form.getByRole("button", { name: "Batal" }).click();
      await expect(form).toHaveCount(0);
      await expect(edit).toBeFocused();
    }
    await expect(row).toContainText("+6281211112222");
  });

  test("cannot assign another agency's job, nor another agency's cleaner", async () => {
    const otherCleaner = await adminClient().from("cleaners").select("user_id").eq("agency_id", other.id).single<{ user_id: string }>();
    const foreignJob = await agency.user.client.rpc("assign_cleaner", { p_order: jobs.other, p_cleaner: newCleaner.id });
    expect(foreignJob.error?.message).toBe("job_not_found");
    const foreignCleaner = await agency.user.client.rpc("assign_cleaner", { p_order: jobs.open, p_cleaner: otherCleaner.data?.user_id });
    expect(foreignCleaner.error?.message).toBe("cleaner_not_found");
  });

  test("opens on its summary, whose range is part of the address, and names the agency in the sidebar", async ({ page }) => {
    await page.goto("/agency");
    await expect(page.getByRole("heading", { level: 1, name: "Ringkasan" })).toBeVisible();
    await expect(page.locator("aside")).toContainText(agencyName);
    const range = page.getByRole("navigation", { name: "Rentang waktu" });
    await expect(range.getByRole("link", { name: "30 hari" })).toHaveAttribute("aria-current", "true");
    await range.getByRole("link", { name: "7 hari" }).click();
    await expect(page).toHaveURL("/agency?days=7");
    await expect(range.getByRole("link", { name: "7 hari" })).toHaveAttribute("aria-current", "true");
    // The numbers come from the T40 summary functions. The test project's agency role cannot read
    // order_fees yet (docs/redesign-gaps.md, Partner agency); the page then says so instead of showing 0.
    await expect(page.getByRole("list", { name: "Angka utama, 7 hari terakhir" }).or(page.getByRole("main").getByRole("alert"))).toBeVisible();    // The fee chart follows the chosen period (2026-11-20): 7 bars for 7 days, 13 weekly bars for 90.
    const chart = page.getByRole("region", { name: /^Imbalan (harian|mingguan)$/ });
    if (await chart.count()) {
      await expect(chart.locator("[data-day]")).toHaveCount(7);
      await page.goto("/agency?days=90");
      await expect(page.getByRole("region", { name: "Imbalan mingguan" }).locator("[data-day]")).toHaveCount(13);
    }
  });

  test("watches its own cleaner's live stream, whose status follows the cleaner's", async ({ page }) => {
    await page.goto("/agency/recordings");
    const tiles = page.getByRole("region", { name: "Sedang siaran" }).getByRole("article");
    await expect(tiles).toHaveCount(1); // not the other agency's
    const tile = tiles.first();
    await expect(tile).toContainText("Uji Petugas Siaran");
    await expect(tile).toContainText("Sedang berlangsung");
    const src = (await tile.locator("video").getAttribute("src")) ?? "";
    expect(src.startsWith(signedLink("library"))).toBe(true);

    await adminClient().from("stream_sessions").update({ status: "weak" }).eq("order_id", jobs.live);
    await expect(tile).toContainText("Sinyal lemah", { timeout: 25_000 });
  });

  test("replays its own recording; a deleted one and a job without one say so", async ({ page, request }) => {
    await page.goto("/agency/recordings");
    const table = page.getByRole("table", { name: "Rekaman pekerjaan petugas Anda" });
    await expect(jobRow(table, address.expired)).toContainText("Sudah dihapus setelah 7 hari");
    await expect(jobRow(table, address.none)).toContainText("Tidak ada rekaman");
    await expect(jobRow(table, address.expired).getByRole("link")).toHaveCount(0);

    await jobRow(table, address.finished).getByRole("link", { name: /^Putar rekaman/ }).click();
    await expect(page).toHaveURL(`/agency/recordings?recording=${recordings.own}`);
    const player = page.getByRole("region", { name: /^Rekaman (Pembersihan|yang dipilih)/ });
    const src = (await player.locator("video").getAttribute("src")) ?? "";
    expect(src.startsWith(`${signedLink("jobs")}${jobs.finished}.`)).toBe(true);
    expect((await request.get(src)).status()).toBe(200);
    await expect(player).toContainText(/Tersedia sampai \S+, \d{1,2} \S+, \d{2}\.\d{2} WIB/);

    await page.goto(`/agency/recordings?recording=${recordings.expired}`);
    await expect(page.getByText("Rekaman sudah dihapus")).toBeVisible();
    await expect(page.locator("main video")).toHaveCount(1); // only the live tile
  });

  test("is refused another agency's stream and recording", async ({ page }) => {
    const answer = async (path: string) => (await page.request.get(path)).status();
    expect(await answer(`/api/streams/${jobs.live}`)).toBe(200);
    expect(await answer(`/api/recordings/${recordings.own}/link`)).toBe(200);
    expect(await answer(`/api/streams/${jobs.other}`)).toBe(404);
    expect(await answer(`/api/streams/${jobs.other}?status=1`)).toBe(404);
    expect(await answer(`/api/recordings/${recordings.other}/link`)).toBe(404);

    await page.goto(`/agency/recordings?recording=${recordings.other}`);
    await expect(page.getByText("Rekaman tidak ditemukan")).toBeVisible();
    await expect(page.getByRole("region", { name: /^Rekaman (Pembersihan|yang dipilih)/ }).locator("video")).toHaveCount(0);
  });

  test("reads in English", async ({ page }) => {
    await page.goto("/en/agency/schedule");
    await expect(page.getByRole("heading", { level: 1, name: "Schedule" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Add a time slot" }).getByRole("button", { name: "Add slot" })).toBeVisible();

    await page.goto("/en/agency/cleaners");
    await expect(page.getByRole("form", { name: "Add a cleaner" })).toContainText("6-digit code");
    await expect(page.getByRole("button", { name: "Edit the phone and area of Uji Petugas Siaran" })).toBeVisible();

    await page.goto("/en/agency/services");
    await expect(page.getByRole("button", { name: "Change choice" })).toBeVisible();
    await expect(page.getByRole("table", { name: "HomeKlin services and their prices" })).toContainText("Offered");

    await page.goto("/en/agency/orders");
    const table = page.getByRole("table", { name: "Your agency’s incoming jobs" });
    await expect(jobRow(table, address.open)).toContainText(newCleaner.name);
    await jobRow(table, address.open).getByRole("button", { name: `Change cleaner ${newCleaner.name}` }).click();
    await expect(jobRow(table, address.open).getByRole("button", { name: "Assign" })).toBeVisible();

    await page.goto("/en/agency/recordings");
    await expect(page.getByRole("heading", { level: 2, name: "Live now" })).toBeVisible();
    await expect(jobRow(page.getByRole("table", { name: "Recordings of your cleaners’ jobs" }), address.expired)).toContainText("Deleted after 7 days");

    await page.goto("/en/agency");
    await expect(page.getByRole("heading", { level: 1, name: "Summary" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Time range" }).getByRole("link", { name: "90 days" })).toBeVisible();

    await page.goto(`/en/agency/past/job?order=${jobs.finished}`);
    await expect(page.getByRole("link", { name: "Back to completed orders" })).toBeVisible();
  });
});

test.describe("after the assignment", () => {
  test("the customer sees the cleaner's name and photo as Petugas HomeKlin, never the agency", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, storageState: sessions.customer });
    const page = await context.newPage();
    await page.goto(`/orders?order=${jobs.open}`);
    const job = page.getByRole("region", { name: "Petugas HomeKlin" });
    await expect(job.getByText(newCleaner.name, { exact: true })).toBeVisible();
    await expect(job.getByRole("img", { name: `Foto ${newCleaner.name}` })).toBeVisible();
    const text = (await page.locator("main").innerText()) ?? "";
    expect(text).not.toContain(agencyName);
    expect(text).not.toMatch(agencyWording);
    await context.close();
  });

  test("the cleaner sees the job on their list", async ({ browser, baseURL }) => {
    // Cleaners sign in with an emailed code; the test gives this one a password to sign in without email.
    const password = `T27-${Date.now()}-pw!`;
    const updated = await adminClient().auth.admin.updateUserById(newCleaner.id, { password });
    expect(updated.error).toBeNull();
    const state = await sessionOf(browser, baseURL, { id: newCleaner.id, email: newCleaner.email, password, client: visitorClient() });
    const context = await browser.newContext({ baseURL, storageState: state });
    const page = await context.newPage();
    await page.goto("/cleaner/jobs");
    await expect(page.getByRole("article").filter({ hasText: address.open })).toBeVisible();
    await context.close();
  });
});
