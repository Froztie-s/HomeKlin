import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clipFolder, recordingsBucket } from "@/lib/recordings/attach";
import { listLiveStreams, watchStream } from "@/lib/stream/streams";
import { adminClient, visitorClient } from "./test-project";
import { createWorld, hours, type World } from "./world";

// The live view of a job (T22, T23, T25, T29; supabase/migrations/20261104140000_streams.sql and
// src/lib/stream/), against the real test project. The authorization matrix: the job's customer only
// while it is in progress and with consent; the job's agency; admin; nobody else (another customer,
// another agency, another cleaner, a visitor). Nobody but admin and an agency can list streams.

let world: World;
const clipName = "test-clip.mp4";

beforeAll(async () => {
  world = await createWorld("t22");
  await adminClient()
    .storage.from(recordingsBucket)
    .upload(`${clipFolder}/${clipName}`, new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), { contentType: "video/mp4", upsert: true });
}, 180_000);

afterAll(async () => {
  await world.cleanup();
}, 120_000);

const now = () => new Date(Date.now() - hours(0.5));

async function liveJob(options: { agency?: "A" | "B" } = {}) {
  const cleaner = options.agency === "B" ? world.users.cleanerB : world.users.cleanerA;
  const orderId = await world.job({ startsAt: now(), checkedIn: true, cleaner, ...options });
  const { error } = await cleaner.client.rpc("start_stream", { p_order: orderId });
  if (error) throw new Error(`Could not start the test stream: ${error.message}`);
  return orderId;
}

const watch = (viewer: keyof World["users"], orderId: string) => watchStream(world.users[viewer].client, adminClient(), orderId);

describe("starting a stream", { timeout: 30_000 }, () => {
  it("is for the job's cleaner, after check-in", async () => {
    const notStarted = await world.job({ startsAt: now() });
    expect((await world.users.cleanerA.client.rpc("start_stream", { p_order: notStarted })).error?.message).toBe("not_checked_in");
    const done = await world.job({ startsAt: now(), completed: true });
    expect((await world.users.cleanerA.client.rpc("start_stream", { p_order: done })).error?.message).toBe("job_completed");
    const someoneElses = await world.job({ startsAt: now(), checkedIn: true });
    expect((await world.users.cleanerA2.client.rpc("start_stream", { p_order: someoneElses })).error?.message).toBe("job_not_found");
    for (const client of [world.users.customer.client, world.users.agencyA.client, world.users.admin.client]) {
      expect((await client.rpc("start_stream", { p_order: someoneElses })).error?.code).toBe("42501");
    }
  });

  it("reports weak signal and disconnection, and check-out ends it", async () => {
    const orderId = await liveJob();
    const cleaner = world.users.cleanerA.client;
    for (const status of ["weak", "disconnected", "active"]) {
      expect((await cleaner.rpc("set_stream_status", { p_order: orderId, p_status: status })).error).toBeNull();
      expect((await watch("customer", orderId)).status).toBe(status);
    }
    expect((await cleaner.rpc("check_out", { p_order: orderId })).error).toBeNull();
    await expect(watch("admin", orderId)).rejects.toMatchObject({ reason: "stream_not_found" });
    expect((await cleaner.rpc("set_stream_status", { p_order: orderId, p_status: "active" })).error?.message).toBe("stream_not_found");
  });
});

describe("who may watch", { timeout: 30_000 }, () => {
  it.each(["customer", "agencyA", "admin"] as const)("lets %s watch, with a signed link to the clip", async (viewer) => {
    const orderId = await liveJob();
    const stream = await watch(viewer, orderId);
    expect(stream).toMatchObject({ orderId, status: "active", cleanerName: "Uji Petugas A" });
    expect(stream.view.kind).toBe("video");
    if (stream.view.kind === "video") expect((await fetch(stream.view.url)).ok).toBe(true);
  });

  it.each(["otherCustomer", "agencyB", "cleanerA2", "cleanerB"] as const)("refuses %s as if there were no stream", async (viewer) => {
    const orderId = await liveJob();
    await expect(watch(viewer, orderId)).rejects.toMatchObject({ reason: "stream_not_found" });
  });

  it("refuses the customer once the job is completed, and a visitor always", async () => {
    const orderId = await liveJob();
    await adminClient().from("orders").update({ completed_at: new Date().toISOString() }).eq("id", orderId);
    await expect(watch("customer", orderId)).rejects.toMatchObject({ reason: "stream_not_found" });
    expect((await visitorClient().rpc("stream_for_viewer", { p_order: orderId })).error?.code).toBe("42501");
  });

  it("has no job without the customer's consent to stream (the orders table refuses one)", async () => {
    const orderId = await liveJob();
    const { error } = await adminClient().from("orders").update({ stream_consent: false }).eq("id", orderId);
    expect(error?.message).toMatch(/stream_consent/);
  });

  it("answers a guessed job id like any other refusal", async () => {
    await expect(watch("customer", randomUUID())).rejects.toMatchObject({ reason: "stream_not_found" });
  });
});

describe("listing live streams", { timeout: 30_000 }, () => {
  it("shows admin every live stream and an agency only its own", async () => {
    const ours = await liveJob();
    const theirs = await liveJob({ agency: "B" });
    const forAdmin = (await listLiveStreams(world.users.admin.client)).map((stream) => stream.orderId);
    expect(forAdmin).toEqual(expect.arrayContaining([ours, theirs]));
    const forAgency = (await listLiveStreams(world.users.agencyA.client)).map((stream) => stream.orderId);
    expect(forAgency).toContain(ours);
    expect(forAgency).not.toContain(theirs);
  });

  it("is refused to customers and cleaners", async () => {
    for (const client of [world.users.customer.client, world.users.cleanerA.client]) {
      expect((await client.rpc("live_streams")).error?.code).toBe("42501");
    }
  });
});

describe("who may publish (T31)", { timeout: 30_000 }, () => {
  it("is only the job's cleaner while the job is in progress", async () => {
    const orderId = await world.job({ startsAt: now(), checkedIn: true });
    const ask = (viewer: keyof World["users"]) => world.users[viewer].client.rpc("can_publish_stream", { p_order: orderId });
    expect((await ask("cleanerA")).data).toBe(true);
    for (const viewer of ["cleanerA2", "cleanerB", "customer", "agencyA", "admin"] as const) expect((await ask(viewer)).data).toBe(false);
    await adminClient().from("orders").update({ completed_at: new Date().toISOString() }).eq("id", orderId);
    expect((await ask("cleanerA")).data).toBe(false);
  });
});
