import { randomUUID } from "node:crypto";
import type { Browser } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUsers, type TestUser } from "../tests/integration/test-project";
import { signInWithPassword } from "./order-test-data";
import type { StorageState } from "./setup/auth-state";

// Test data for the job specs and screenshots (T17, T18), in the shared Supabase test project. Jobs are
// paid orders written straight into the table with the secret key, so a job can start a few minutes
// from now (book_slot only books the seeded grid). Each job gets its own full window row in Jakarta
// Timur at a time no seeded window has (a few minutes from now, to the second), so no customer page
// lists it as free and no other spec's window is touched. Everything is deleted again afterwards:
// recordings and their files under jobs/, orders, windows, agencies made here, and the users.

export const jobArea = "jakarta-timur";
export const jobService = { id: "regular", name: "Pembersihan Rutin", nameEn: "Regular Cleaning" };
export const jobPhone = "+6281234567890";
const recordingsBucket = "recordings";

const minute = 60_000;

export type JobTimes = { startsAt: string; endsAt: string };

export type JobWorld = {
  /** A paid job at these times, at this agency, optionally assigned, checked in or finished. */
  job: (options: JobOptions) => Promise<{ id: string } & JobTimes>;
  /** A cleaner of that agency (a signed-in test user with the cleaner role). */
  cleaner: (agencyId: string, fullName: string) => Promise<TestUser>;
  /** A partner agency of its own, with a signed-in agency user, serving Jakarta Timur. */
  agency: (name: string) => Promise<{ id: string; user: TestUser }>;
  /** An admin of the run's own (a signed-in test user with the admin role). */
  admin: (fullName: string) => Promise<TestUser>;
  customer: TestUser;
  cleanup: () => Promise<void>;
};

export type JobOptions = {
  agencyId: string;
  cleaner: TestUser | null;
  /** Minutes from now to the start of the arrival window. */
  startsIn: number;
  /** The window's length in minutes (default 2 hours). */
  minutes?: number;
  address: string;
  checkedInMinutesAgo?: number;
  completedMinutesAgo?: number;
};

async function must<T>(what: string, request: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(`Could not set up ${what}: ${error.message}`);
  return data as T;
}

/** The seeded agency that serves Jakarta Timur (scripts/seed-data.mjs). */
export async function seededAgencyId(key = "kilau-teratai"): Promise<string> {
  const row = await must(
    `the agency ${key}`,
    adminClient().from("agencies").select("id").eq("key", key).single<{ id: string }>(),
  );
  return row.id;
}

export async function createJobWorld(label: string): Promise<JobWorld> {
  const admin = adminClient();
  const users: TestUser[] = [];
  const orders: string[] = [];
  const slots: string[] = [];
  const agencies: string[] = [];

  const customer = await createTestUser(`${label}-customer`);
  users.push(customer);
  await must("the customer's name", admin.from("profiles").update({ full_name: "Uji Pelanggan Pekerjaan" }).eq("id", customer.id));

  async function cleaner(agencyId: string, fullName: string): Promise<TestUser> {
    const user = await createTestUser(`${label}-cleaner`);
    users.push(user);
    await must("the cleaner role", admin.from("profiles").update({ role: "cleaner", full_name: fullName }).eq("id", user.id));
    await must("the cleaner", admin.from("cleaners").insert({ user_id: user.id, agency_id: agencyId, full_name: fullName }));
    return user;
  }

  async function staffAdmin(fullName: string): Promise<TestUser> {
    const user = await createTestUser(`${label}-admin`);
    users.push(user);
    await must("the admin role", admin.from("profiles").update({ role: "admin", full_name: fullName }).eq("id", user.id));
    return user;
  }

  async function agency(name: string) {
    const user = await createTestUser(`${label}-agency`);
    users.push(user);
    await must("the agency role", admin.from("profiles").update({ role: "agency", full_name: name }).eq("id", user.id));
    const row = await must(
      "the agency",
      admin
        .from("agencies")
        .insert({ key: `${label}-${randomUUID().slice(0, 8)}`, name, user_id: user.id })
        .select("id")
        .single<{ id: string }>(),
    );
    agencies.push(row.id);
    await must("the agency's area", admin.from("agency_areas").insert({ agency_id: row.id, area_id: jobArea }));
    return { id: row.id, user };
  }

  // Whole seconds apart, so two jobs of one agency never share a window start.
  let offset = 0;
  async function job(options: JobOptions) {
    offset += 1;
    const start = Math.floor((Date.now() + options.startsIn * minute) / 1000) * 1000 + offset * 1000 + 7000;
    const startsAt = new Date(start).toISOString();
    const endsAt = new Date(start + (options.minutes ?? 120) * minute).toISOString();
    const slot = await must(
      "a window",
      admin
        .from("availability_slots")
        .insert({ agency_id: options.agencyId, area_id: jobArea, starts_at: startsAt, ends_at: endsAt, capacity: 1, booked: 1 })
        .select("id")
        .single<{ id: string }>(),
    );
    slots.push(slot.id);
    const ago = (minutes: number | undefined) => (minutes === undefined ? null : new Date(Date.now() - minutes * minute).toISOString());
    // A finished job was checked in 90 minutes before it finished, unless said otherwise.
    const checkedInAt = ago(
      options.checkedInMinutesAgo ?? (options.completedMinutesAgo === undefined ? undefined : options.completedMinutesAgo + 90),
    );
    const order = await must(
      "a job",
      admin
        .from("orders")
        .insert({
          customer_id: customer.id,
          service_id: jobService.id,
          area_id: jobArea,
          agency_id: options.agencyId,
          slot_id: slot.id,
          starts_at: startsAt,
          ends_at: endsAt,
          address: options.address,
          contact_phone: jobPhone,
          price_idr: 150000,
          stream_consent: true,
          status: "paid",
          cleaner_id: options.cleaner?.id ?? null,
          checked_in_at: checkedInAt,
          check_in_lat: checkedInAt ? -6.225 : null,
          check_in_lng: checkedInAt ? 106.9 : null,
          completed_at: ago(options.completedMinutesAgo),
        })
        .select("id")
        .single<{ id: string }>(),
    );
    orders.push(order.id);
    return { id: order.id, startsAt, endsAt };
  }

  async function cleanup() {
    if (orders.length > 0) {
      // Check-out may have attached a recording: its file is a copy under jobs/, its row goes with the order.
      const recordings = await admin.from("recordings").select("file_path").in("order_id", orders);
      const files = ((recordings.data ?? []) as { file_path: string }[]).map((row) => row.file_path);
      if (files.length > 0) await admin.storage.from(recordingsBucket).remove(files);
      await admin.from("orders").delete().in("id", orders.splice(0));
    }
    if (slots.length > 0) await admin.from("availability_slots").delete().in("id", slots.splice(0));
    if (agencies.length > 0) await admin.from("agencies").delete().in("id", agencies.splice(0));
    await deleteTestUsers(users.splice(0));
  }

  return { job, cleaner, agency, admin: staffAdmin, customer, cleanup };
}

/** A browser session of a test user, signed in through the app's sign-in page. */
export async function sessionOf(browser: Browser, baseURL: string | undefined, user: TestUser): Promise<StorageState> {
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  await signInWithPassword(await context.newPage(), user);
  const state = await context.storageState();
  await context.close();
  return state;
}

const timeFormat = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dateKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });

/** "15.00": a moment's time in Jakarta, as the pages write it. */
export const jakartaClock = (iso: string | number) => timeFormat.format(new Date(iso));

/** Whether a moment falls on today's date in Jakarta. */
export const isJakartaToday = (iso: string) => dateKeyFormat.format(new Date(iso)) === dateKeyFormat.format(new Date());
