import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listMyOrders } from "@/lib/booking/orders";
import { adminClient, visitorClient } from "./test-project";
import { createWorld, hours, minutes, type World } from "./world";

// The job a paid order becomes (T17, T18 and the job side of T28; supabase/migrations/
// 20261104090000_jobs.sql), against the real test project: the cleaner sees only their own jobs, checks
// in only in the job's window and at a location, checks out to complete it; the agency sees only the
// jobs routed to it and assigns only its own cleaners; admin sees every job; the customer sees the
// cleaner by name, never the agency.

let world: World;
const now = () => Date.now();

beforeAll(async () => {
  world = await createWorld("t17");
}, 180_000);

afterAll(async () => {
  await world.cleanup();
}, 120_000);

const at = (offset: number) => new Date(now() + offset);
const checkIn = (client = world.users.cleanerA.client, orderId: string, lat = -6.24, lng = 106.8) =>
  client.rpc("check_in", { p_order: orderId, p_lat: lat, p_lng: lng, p_accuracy: 12 });

describe("the cleaner's jobs", { timeout: 30_000 }, () => {
  it("lists only the cleaner's own assigned, paid jobs, with the customer's name and no agency", async () => {
    const mine = await world.job({ startsAt: at(hours(2)) });
    const other = await world.job({ startsAt: at(hours(2)), cleaner: world.users.cleanerA2 });
    const unpaid = await world.job({ startsAt: at(hours(3)), status: "pending_payment" });
    const old = await world.job({ startsAt: at(-hours(40)), completed: true });

    const { data, error } = await world.users.cleanerA.client.rpc("my_jobs");
    expect(error).toBeNull();
    const ids = (data ?? []).map((row: { order_id: string }) => row.order_id);
    expect(ids).toContain(mine);
    expect(ids).not.toContain(other);
    expect(ids).not.toContain(unpaid);
    expect(ids).not.toContain(old);
    const row = (data ?? []).find((entry: { order_id: string }) => entry.order_id === mine);
    expect(row).toMatchObject({ customer_name: "Uji Pelanggan", contact_phone: "+6281234567890" });
    expect(Object.keys(row)).not.toContain("agency_id");
  });

  it("is for cleaners only", async () => {
    for (const client of [world.users.customer.client, world.users.agencyA.client, world.users.admin.client]) {
      expect((await client.rpc("my_jobs")).error?.code).toBe("42501");
    }
    expect((await visitorClient().rpc("my_jobs")).error?.code).toBe("42501");
  });
});

describe("check-in", { timeout: 30_000 }, () => {
  it("opens 15 minutes before the window and records the time and place", async () => {
    const job = await world.job({ startsAt: at(minutes(10)) });
    const { error } = await checkIn(undefined, job, -6.2444, 106.8);
    expect(error).toBeNull();
    const { data } = await adminClient().from("orders").select("checked_in_at, check_in_lat, check_in_lng, check_in_accuracy_m").eq("id", job).single();
    expect(data).toMatchObject({ check_in_lat: -6.2444, check_in_lng: 106.8, check_in_accuracy_m: 12 });
    expect(Math.abs(Date.parse(data?.checked_in_at) - now())).toBeLessThan(60_000);
  });

  it("refuses before the window opens and after it closes", async () => {
    const early = await world.job({ startsAt: at(minutes(20)) });
    const late = await world.job({ startsAt: at(-hours(3)), hours: 2 });
    expect((await checkIn(undefined, early)).error?.message).toBe("too_early");
    expect((await checkIn(undefined, late)).error?.message).toBe("too_late");
  });

  it("refuses twice, without a location, and on another cleaner's job", async () => {
    const job = await world.job({ startsAt: at(0) });
    expect((await checkIn(undefined, job, 91, 0)).error?.message).toBe("location_invalid");
    expect((await checkIn(world.users.cleanerA2.client, job)).error?.message).toBe("job_not_found");
    expect((await checkIn(world.users.cleanerB.client, job)).error?.message).toBe("job_not_found");
    expect((await checkIn(undefined, job)).error).toBeNull();
    expect((await checkIn(undefined, job)).error?.message).toBe("already_checked_in");
  });

  it("is refused to every other role", async () => {
    const job = await world.job({ startsAt: at(0) });
    for (const client of [world.users.customer.client, world.users.agencyA.client, world.users.admin.client, visitorClient()]) {
      expect((await checkIn(client, job)).error?.code).toBe("42501");
    }
  });
});

describe("check-out", { timeout: 30_000 }, () => {
  it("completes a checked-in job, once", async () => {
    const job = await world.job({ startsAt: at(-hours(1)), checkedIn: true });
    const first = await world.users.cleanerA.client.rpc("check_out", { p_order: job });
    expect(first.error).toBeNull();
    const second = await world.users.cleanerA.client.rpc("check_out", { p_order: job });
    expect(second.data).toBe(first.data);
    const { data } = await adminClient().from("orders").select("completed_at").eq("id", job).single();
    expect(Date.parse(data?.completed_at)).toBe(Date.parse(first.data));
  });

  it("refuses a job that was not checked in, and another cleaner's job", async () => {
    const job = await world.job({ startsAt: at(0) });
    expect((await world.users.cleanerA.client.rpc("check_out", { p_order: job })).error?.message).toBe("not_checked_in");
    const started = await world.job({ startsAt: at(0), checkedIn: true });
    expect((await world.users.cleanerB.client.rpc("check_out", { p_order: started })).error?.message).toBe("job_not_found");
  });
});

describe("the agency's jobs and cleaners", { timeout: 30_000 }, () => {
  it("lists only the paid jobs routed to the agency, and only its own cleaners", async () => {
    const ours = await world.job({ startsAt: at(hours(5)), cleaner: null });
    const theirs = await world.job({ startsAt: at(hours(5)), agency: "B", cleaner: world.users.cleanerB });
    const jobs = await world.users.agencyA.client.rpc("agency_jobs");
    expect(jobs.error).toBeNull();
    const ids = (jobs.data ?? []).map((row: { order_id: string }) => row.order_id);
    expect(ids).toContain(ours);
    expect(ids).not.toContain(theirs);

    const cleaners = await world.users.agencyA.client.rpc("agency_cleaners");
    expect((cleaners.data ?? []).map((row: { full_name: string }) => row.full_name).sort()).toEqual(["Uji Petugas A", "Uji Petugas A2"]);
  });

  it("assigns its own cleaner to its own job, which the cleaner and the customer then see", async () => {
    const job = await world.job({ startsAt: at(hours(6)), cleaner: null });
    const { error } = await world.users.agencyA.client.rpc("assign_cleaner", { p_order: job, p_cleaner: world.users.cleanerA2.id });
    expect(error).toBeNull();

    const cleanerJobs = await world.users.cleanerA2.client.rpc("my_jobs");
    expect((cleanerJobs.data ?? []).map((row: { order_id: string }) => row.order_id)).toContain(job);
    const order = (await listMyOrders(world.users.customer.client)).find((entry) => entry.id === job);
    expect(order?.cleanerName).toBe("Uji Petugas A2");
  });

  it("refuses another agency's cleaner, another agency's job, and a job already started", async () => {
    const job = await world.job({ startsAt: at(hours(7)), cleaner: null });
    const theirs = await world.job({ startsAt: at(hours(7)), agency: "B", cleaner: null });
    const started = await world.job({ startsAt: at(0), checkedIn: true });
    const agency = world.users.agencyA.client;
    expect((await agency.rpc("assign_cleaner", { p_order: job, p_cleaner: world.users.cleanerB.id })).error?.message).toBe("cleaner_not_found");
    expect((await agency.rpc("assign_cleaner", { p_order: theirs, p_cleaner: world.users.cleanerA.id })).error?.message).toBe("job_not_found");
    expect((await agency.rpc("assign_cleaner", { p_order: started, p_cleaner: world.users.cleanerA2.id })).error?.message).toBe("job_started");
    expect((await agency.rpc("assign_cleaner", { p_order: randomUUID(), p_cleaner: world.users.cleanerA.id })).error?.message).toBe("job_not_found");
  });

  it("is for agencies only", async () => {
    for (const client of [world.users.customer.client, world.users.cleanerA.client, world.users.admin.client]) {
      expect((await client.rpc("agency_jobs")).error?.code).toBe("42501");
      expect((await client.rpc("assign_cleaner", { p_order: randomUUID(), p_cleaner: world.users.cleanerA.id })).error?.code).toBe("42501");
    }
  });
});

describe("admin and the customer", { timeout: 30_000 }, () => {
  it("shows admin every paid job with its agency and cleaner, and no one else", async () => {
    const job = await world.job({ startsAt: at(hours(8)), agency: "B", cleaner: world.users.cleanerB, checkedIn: true });
    const { data, error } = await world.users.admin.client.rpc("admin_jobs");
    expect(error).toBeNull();
    expect((data ?? []).find((row: { order_id: string }) => row.order_id === job)).toMatchObject({
      agency_name: "Uji Agensi B",
      cleaner_name: "Uji Petugas B",
    });
    for (const client of [world.users.customer.client, world.users.cleanerA.client, world.users.agencyA.client]) {
      expect((await client.rpc("admin_jobs")).error?.code).toBe("42501");
    }
  });

  it("gives the customer the cleaner, the check-in and the completion, without the agency", async () => {
    const job = await world.job({ startsAt: at(-hours(3)), completed: true });
    const order = (await listMyOrders(world.users.customer.client)).find((entry) => entry.id === job);
    expect(order).toMatchObject({ cleanerName: "Uji Petugas A", recordingId: null });
    expect(order?.checkedInAt).not.toBeNull();
    expect(order?.completedAt).not.toBeNull();
    const { data } = await world.users.customer.client.rpc("my_orders");
    for (const row of data ?? []) expect(Object.keys(row)).not.toContain("agency_id");
    expect((await listMyOrders(world.users.otherCustomer.client)).some((entry) => entry.id === job)).toBe(false);
  });
});
