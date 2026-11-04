import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attachRecording, clipFolder, RecordingError, recordingsBucket } from "@/lib/recordings/attach";
import { seedCompletedJobs, uploadClips } from "../../scripts/seed.mjs";
import { adminClient, createTestUser, deleteTestUsers, testProject, visitorClient, type TestUser } from "./test-project";

// Recordings (T13, supabase/migrations/20261101090000_recordings.sql, src/lib/recordings/attach.ts)
// against the real test project. A recording is a private file plus a row that says whose job it
// belongs to and when it expires. Nobody reaches either directly: no visitor, no customer, not even the
// booking's customer; the only way to the file is a signed link made with the secret key (T14). The
// clip here is a few stand-in bytes: storage does not look inside the file.

const prefix = `t13-${randomUUID().slice(0, 8)}`;
const area = `${prefix}-area`;
const serviceId = `${prefix}-svc`;
const price = 88000;
const clipName = `${prefix}.mp4`;
const clipBytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
const day = 86_400_000;
let customer: TestUser | undefined;
let stranger: TestUser | undefined;
let agencyId = "";
let nextWindow = Date.UTC(2031, 2, 3, 1);
const filesMade: string[] = [];

function user(u: TestUser | undefined): TestUser {
  if (!u) throw new Error("The test user was not created (see beforeAll).");
  return u;
}

/** A new order of the customer in its own window; paid unless told otherwise. */
async function order(paid = true): Promise<string> {
  const admin = adminClient();
  const startsAt = new Date(nextWindow).toISOString();
  nextWindow += day;
  const { error: slotError } = await admin.from("availability_slots").insert({
    agency_id: agencyId, area_id: area, capacity: 1,
    starts_at: startsAt, ends_at: new Date(Date.parse(startsAt) + 7_200_000).toISOString(),
  });
  if (slotError) throw new Error(`Could not add the test window: ${slotError.message}`);
  const { data, error } = await user(customer).client.rpc("book_slot", {
    p_service: serviceId, p_area: area, p_starts_at: startsAt,
    p_address: "Jl. Uji Rekaman No. 7, Jakarta", p_phone: "+6281234567890", p_consent: true,
  });
  if (error) throw new Error(`Could not book the test window: ${error.message}`);
  const orderId: string = data?.[0]?.order_id;
  if (paid) {
    const result = await admin.rpc("apply_payment_result", { p_order: orderId, p_status: "paid", p_amount: price });
    if (result.error) throw new Error(`Could not pay the test order: ${result.error.message}`);
  }
  return orderId;
}

async function attach(orderId: string, retentionDays?: number) {
  const recording = await attachRecording(adminClient(), orderId, retentionDays === undefined ? {} : { retentionDays });
  filesMade.push(recording.filePath);
  return recording;
}

beforeAll(async () => {
  const admin = adminClient();
  await admin.from("service_areas").insert({ id: area, name_id: "Uji Rekaman", name_en: "Test Recording" });
  const { data: agency } = await admin.from("agencies").insert({ key: `${prefix}-a`, name: "Uji Agensi" }).select("id").single();
  agencyId = agency?.id;
  await admin.from("agency_areas").insert({ agency_id: agencyId, area_id: area });
  await admin.from("services").insert({
    id: serviceId, category: "rooms", name_id: "Uji Rekaman", name_en: "Test Recording",
    description_id: "Layanan uji.", description_en: "A test service.", price_idr: price, duration_minutes: 60,
  });
  const upload = await admin.storage
    .from(recordingsBucket)
    .upload(`${clipFolder}/${clipName}`, clipBytes, { contentType: "video/mp4" });
  if (upload.error) throw new Error(`Could not upload the test clip: ${upload.error.message}`);
  customer = await createTestUser("t13-customer");
  stranger = await createTestUser("t13-stranger");
}, 90_000);

afterAll(async () => {
  const admin = adminClient();
  await admin.storage.from(recordingsBucket).remove([`${clipFolder}/${clipName}`, ...filesMade]);
  await deleteTestUsers([customer, stranger]);
  await admin.from("availability_slots").delete().eq("area_id", area);
  await admin.from("agencies").delete().like("key", `${prefix}-%`);
  await admin.from("services").delete().eq("id", serviceId);
  await admin.from("service_areas").delete().eq("id", area);
}, 60_000);

describe("attachRecording", { timeout: 30_000 }, () => {
  it("gives a paid job its own copy of a clip, expiring after 7 days, for the routed agency", async () => {
    const orderId = await order();
    const before = Date.now();
    const recording = await attach(orderId);
    const after = Date.now();

    expect(recording.filePath).toBe(`jobs/${orderId}.mp4`);
    expect(Date.parse(recording.expiresAt)).toBeGreaterThanOrEqual(before + 7 * day - 5_000);
    expect(Date.parse(recording.expiresAt)).toBeLessThanOrEqual(after + 7 * day + 5_000);

    const { data: row } = await adminClient().from("recordings").select("*").eq("id", recording.id).single();
    expect(row).toMatchObject({ order_id: orderId, agency_id: agencyId, file_path: recording.filePath });

    const { data: file } = await adminClient().storage.from(recordingsBucket).download(recording.filePath);
    expect(new Uint8Array((await file?.arrayBuffer()) ?? new ArrayBuffer(0))).toEqual(clipBytes);
  });

  it("gives the same recording when it runs again, so a repeated check-out is harmless", async () => {
    const orderId = await order();
    const first = await attach(orderId);
    const second = await attach(orderId);
    expect(second).toEqual(first);
    const { count } = await adminClient().from("recordings").select("id", { count: "exact" }).eq("order_id", orderId);
    expect(count).toBe(1);
  });

  it("can use a shorter retention, for testing the 7-day deletion", async () => {
    const before = Date.now();
    const recording = await attach(await order(), 1);
    expect(Math.abs(Date.parse(recording.expiresAt) - (before + day))).toBeLessThan(10_000);
  });

  it("refuses an order that was not paid, and leaves no file behind", async () => {
    const orderId = await order(false);
    await expect(attachRecording(adminClient(), orderId)).rejects.toMatchObject({ reason: "order_not_paid" });
    const { data } = await adminClient().storage.from(recordingsBucket).list("jobs", { search: orderId });
    expect(data).toEqual([]);
  });

  it("refuses an order that does not exist", async () => {
    const attempt = attachRecording(adminClient(), randomUUID());
    await expect(attempt).rejects.toBeInstanceOf(RecordingError);
    await expect(attempt).rejects.toMatchObject({ reason: "order_not_found" });
  });

  it("refuses a retention that is not positive", async () => {
    await expect(attachRecording(adminClient(), await order(), { retentionDays: 0 })).rejects.toMatchObject({
      reason: "retention_invalid",
    });
  });
});

describe("recordings stay private", { timeout: 30_000 }, () => {
  it("makes the bucket private, for video only", async () => {
    const { data } = await adminClient().storage.getBucket(recordingsBucket);
    expect(data?.public).toBe(false);
    expect(data?.allowed_mime_types).toEqual(["video/mp4", "video/webm"]);
  });

  it("lets nobody read the table directly, not even the booking's customer", async () => {
    await attach(await order());
    for (const client of [visitorClient(), user(customer).client, user(stranger).client]) {
      const { data, error } = await client.from("recordings").select("*");
      expect(error?.code).toBe("42501");
      expect(data).toBeNull();
    }
  });

  it("lets nobody but the server attach a recording", async () => {
    const orderId = await order();
    const args = { p_order: orderId, p_path: `jobs/${orderId}.mp4`, p_retention: "7 days" };
    for (const client of [visitorClient(), user(customer).client]) {
      const { error } = await client.rpc("attach_recording", args);
      expect(error?.code).toBe("42501");
    }
  });

  it("serves the file to nobody without a signed link", async () => {
    const { filePath } = await attach(await order());
    for (const client of [visitorClient(), user(customer).client, user(stranger).client]) {
      const files = client.storage.from(recordingsBucket);
      expect((await files.download(filePath)).data).toBeNull();
      expect((await files.createSignedUrl(filePath, 60)).data).toBeNull();
      expect((await files.list("jobs")).data ?? []).toEqual([]);
      expect((await files.upload(`jobs/${prefix}-intruder.mp4`, clipBytes, { contentType: "video/mp4" })).error).not.toBeNull();
    }
    const publicAddress = `${testProject.url}/storage/v1/object/public/${recordingsBucket}/${filePath}`;
    expect((await fetch(publicAddress)).ok).toBe(false);
  });

  it("serves the file through a signed link made with the secret key", async () => {
    const { filePath } = await attach(await order());
    const { data } = await adminClient().storage.from(recordingsBucket).createSignedUrl(filePath, 60);
    const response = await fetch(data?.signedUrl ?? "");
    expect(response.ok).toBe(true);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(clipBytes);
  });

  it("refuses a file that is not a video", async () => {
    const path = `${clipFolder}/${prefix}.txt`;
    const { error } = await adminClient().storage.from(recordingsBucket).upload(path, "not a video", { contentType: "text/plain" });
    expect(error).not.toBeNull();
  });
});

describe("the seed's completed jobs", { timeout: 60_000 }, () => {
  it("adds a clip once, and gives each demo job a replayable recording however often it runs", async () => {
    const admin = adminClient();
    const name = `${prefix}-seed.mp4`;
    const file = { name, bytes: clipBytes, contentType: "video/mp4" };
    expect(await uploadClips({ client: admin, files: [file] })).toEqual({ added: 1, kept: 0 });
    expect(await uploadClips({ client: admin, files: [file] })).toEqual({ added: 0, kept: 1 });

    const jobs = [
      { id: randomUUID(), serviceId, areaId: area, agencyId, daysAgo: 1 },
      { id: randomUUID(), serviceId, areaId: area, agencyId, daysAgo: 3 },
    ];
    const options = { client: admin, customerId: user(customer).id, jobs, now: new Date() };
    await seedCompletedJobs(options);
    const first = await admin.from("recordings").select("id").in("order_id", jobs.map((job) => job.id));
    await seedCompletedJobs(options);

    const { data: rows } = await admin
      .from("recordings")
      .select("id, order_id, file_path, expires_at, orders(status, completed_at, ends_at)")
      .in("order_id", jobs.map((job) => job.id));
    expect(rows).toHaveLength(2);
    expect(rows?.map((row) => row.id).sort()).not.toEqual(first.data?.map((row) => row.id).sort());
    for (const job of jobs) {
      const row = rows?.find((candidate) => candidate.order_id === job.id);
      filesMade.push(row?.file_path ?? "");
      const seeded = row?.orders as unknown as { status: string; completed_at: string; ends_at: string };
      expect(seeded.status).toBe("paid");
      expect(Date.parse(seeded.completed_at)).toBe(Date.parse(seeded.ends_at));
      // 7 days after the job ended, as SPEC says.
      expect(Date.parse(row?.expires_at ?? "")).toBeCloseTo(Date.parse(seeded.ends_at) + 7 * day, -5);
    }

    await admin.storage.from(recordingsBucket).remove([`${clipFolder}/${name}`]);
  }, 60_000);

  it("adds nothing when there are no clips yet", async () => {
    // The shared library is never emptied (other test files use it at the same time): the seed is given
    // a client whose library is empty and that fails on anything else.
    const admin = adminClient();
    const emptyLibrary = new Proxy(admin, {
      get(target, property) {
        if (property === "storage") return { from: () => ({ list: async () => ({ data: [], error: null }) }) };
        if (property === "from") return () => { throw new Error("the seed wrote a job without a clip"); };
        return Reflect.get(target, property);
      },
    });
    const job = { id: randomUUID(), serviceId, areaId: area, agencyId, daysAgo: 2 };
    const result = await seedCompletedJobs({ client: emptyLibrary, customerId: user(customer).id, jobs: [job], now: new Date() });
    expect(result).toEqual({ added: 0 });
    const { count } = await admin.from("orders").select("id", { count: "exact" }).eq("id", job.id);
    expect(count).toBe(0);
  });
});
