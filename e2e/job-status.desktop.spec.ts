import { expect, test, type Locator, type Page } from "@playwright/test";
import { adminClient } from "../tests/integration/test-project";
import { createJobWorld, jakartaClock, sessionOf, type JobWorld } from "./job-test-data";
import { signedInAs } from "./setup/auth-state";

// T18 on a desk: the agency (on /agency/orders) and admin (on /admin, "Pekerjaan hari ini") see where
// each job stands: no cleaner yet, a cleaner assigned, checked in at a time, finished at a time. Both
// are read-only: assigning a cleaner is T28. The agency sees only the jobs routed to it; admin sees the
// agency's name too. The spec makes its own agency (serving Jakarta Timur, with one cleaner) and writes
// its own paid jobs a few minutes from now (e2e/job-test-data.ts), so they are today's jobs in Jakarta.

test.describe.configure({ mode: "serial", timeout: 90_000 });

const agencyName = "Uji Agensi Status";
const address = {
  unassigned: "Jl. Uji Tanpa Petugas No. 1, Jakarta Timur",
  assigned: "Jl. Uji Ditugaskan No. 2, Jakarta Timur",
  started: "Jl. Uji Sedang Dikerjakan No. 3, Jakarta Timur",
  finished: "Jl. Uji Selesai No. 4, Jakarta Timur",
};

let world: JobWorld;
let agencySession: Awaited<ReturnType<typeof sessionOf>>;
const jobs: Record<string, string> = {};
const times: Record<string, string> = {};

test.beforeAll(async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  world = await createJobWorld("t18d");
  const agency = await world.agency(agencyName);
  const cleaner = await world.cleaner(agency.id, "Uji Petugas Meja");
  jobs.unassigned = (await world.job({ agencyId: agency.id, cleaner: null, startsIn: 3, address: address.unassigned })).id;
  jobs.assigned = (await world.job({ agencyId: agency.id, cleaner, startsIn: 4, address: address.assigned })).id;
  jobs.started = (await world.job({ agencyId: agency.id, cleaner, startsIn: 1, address: address.started, checkedInMinutesAgo: 2 })).id;
  jobs.finished = (await world.job({ agencyId: agency.id, cleaner, startsIn: 2, address: address.finished, completedMinutesAgo: 1 })).id;
  const { data } = await adminClient()
    .from("orders")
    .select("id, checked_in_at, completed_at")
    .in("id", [jobs.started, jobs.finished]);
  for (const row of (data ?? []) as { id: string; checked_in_at: string; completed_at: string | null }[]) {
    if (row.id === jobs.started) times.checkedIn = jakartaClock(row.checked_in_at);
    if (row.id === jobs.finished && row.completed_at) times.completed = jakartaClock(row.completed_at);
  }
  agencySession = await sessionOf(browser, baseURL, agency.user);
});

test.afterAll(async () => {
  test.setTimeout(120_000);
  await world?.cleanup();
});

const rowOf = (table: Locator, text: string) => table.getByRole("row").filter({ hasText: text });

async function expectReadOnly(page: Page, table: Locator) {
  await expect(table.getByRole("button")).toHaveCount(0);
  await expect(table.getByRole("combobox")).toHaveCount(0);
  await expect(page.locator("main form")).toHaveCount(0);
}

test.describe("the agency", () => {
  test.use({ storageState: async ({}, provide) => provide(agencySession) });

  test("sees each of its jobs with the cleaner and the check-in status, read-only", async ({ page }) => {
    await page.goto("/agency/orders");
    const table = page.getByRole("table", { name: "Pesanan agensi Anda" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("row")).toHaveCount(5); // the header and four jobs: only its own

    await expect(rowOf(table, address.unassigned)).toContainText("Belum ada petugas");
    await expect(rowOf(table, address.assigned)).toContainText("Uji Petugas Meja");
    await expect(rowOf(table, address.assigned)).toContainText("Ditugaskan");
    await expect(rowOf(table, address.started)).toContainText(`Check-in pukul ${times.checkedIn}`);
    await expect(rowOf(table, address.finished)).toContainText(`Selesai pukul ${times.completed}`);
    await expect(rowOf(table, address.finished)).toContainText("Pembersihan Rutin");
    await expectReadOnly(page, table);
  });

  test("reads in English", async ({ page }) => {
    await page.goto("/en/agency/orders");
    const table = page.getByRole("table", { name: "Your agency’s orders" });
    await expect(rowOf(table, address.unassigned)).toContainText("No cleaner yet");
    await expect(rowOf(table, address.started)).toContainText(`Checked in at ${times.checkedIn}`);
    await expect(rowOf(table, address.finished)).toContainText(`Finished at ${times.completed}`);
  });
});

test.describe("admin", () => {
  test.use(signedInAs.admin);

  test("sees today's jobs with the agency, the cleaner and the status, read-only", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 2, name: "Pekerjaan hari ini" })).toBeVisible();
    const table = page.getByRole("table", { name: "Pekerjaan hari ini" });
    for (const id of Object.values(jobs)) await expect(table.locator(`tr[data-job="${id}"]`)).toHaveCount(1);

    const row = (key: string) => table.locator(`tr[data-job="${jobs[key]}"]`);
    await expect(row("unassigned")).toContainText(agencyName);
    await expect(row("unassigned")).toContainText("Belum ada petugas");
    await expect(row("assigned")).toContainText("Uji Petugas Meja");
    await expect(row("started")).toContainText(`Check-in pukul ${times.checkedIn}`);
    await expect(row("finished")).toContainText(`Selesai pukul ${times.completed}`);
    await expectReadOnly(page, table);
  });
});
