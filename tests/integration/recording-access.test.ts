import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { attachRecording, clipFolder, recordingsBucket } from "@/lib/recordings/attach";
import { recordingLink } from "@/lib/recordings/link";
import { adminClient, createTestUser, deleteTestUsers, visitorClient, type TestUser } from "./test-project";

// Who may replay a recording (T14, supabase/migrations/20261103090000_recording_access.sql and
// src/lib/recordings/link.ts), against the real test project: the booking's customer, the agency the job
// was routed to, and admin. Nobody else: another customer, another agency, a cleaner, a visitor. Each of
// them is tried on a recording that is still available and on one that has expired. Anyone without the
// right gets "not found", so they cannot even tell that the recording exists.

const prefix = `t14-${randomUUID().slice(0, 8)}`;
const area = `${prefix}-area`;
const serviceId = `${prefix}-svc`;
const price = 77000;
const clipName = `${prefix}.mp4`;
const clipBytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
const day = 86_400_000;

const roles = ["owner", "otherCustomer", "agency", "otherAgency", "admin", "cleaner"] as const;
type Viewer = (typeof roles)[number];
const users: Partial<Record<Viewer, TestUser>> = {};
const recordings = { available: "", expired: "", endingSoon: "" };
let agencyId = "";
let nextWindow = Date.UTC(2031, 3, 1, 1);
const filesMade: string[] = [];

function user(viewer: Viewer): TestUser {
  const found = users[viewer];
  if (!found) throw new Error(`The ${viewer} test user was not created (see beforeAll).`);
  return found;
}

/** A paid order of the owner in its own window, at the agency the test routes to. */
async function paidOrder(): Promise<string> {
  const admin = adminClient();
  const startsAt = new Date(nextWindow).toISOString();
  nextWindow += day;
  await admin.from("availability_slots").insert({
    agency_id: agencyId, area_id: area, capacity: 1,
    starts_at: startsAt, ends_at: new Date(Date.parse(startsAt) + 7_200_000).toISOString(),
  });
  const { data, error } = await user("owner").client.rpc("book_slot", {
    p_service: serviceId, p_area: area, p_starts_at: startsAt,
    p_address: "Jl. Uji Akses No. 14, Jakarta", p_phone: "+6281234567890", p_consent: true,
  });
  if (error) throw new Error(`Could not book the test window: ${error.message}`);
  const orderId: string = data?.[0]?.order_id;
  const paid = await admin.rpc("apply_payment_result", { p_order: orderId, p_status: "paid", p_amount: price });
  if (paid.error) throw new Error(`Could not pay the test order: ${paid.error.message}`);
  return orderId;
}

/** A recording whose 7 days are over, as T16 would find it before deleting the file. */
async function expiredRecording(): Promise<string> {
  const orderId = await paidOrder();
  const filePath = `jobs/${orderId}.mp4`;
  const now = Date.now();
  const { data, error } = await adminClient()
    .from("recordings")
    .insert({
      order_id: orderId, agency_id: agencyId, file_path: filePath,
      created_at: new Date(now - 8 * day).toISOString(), expires_at: new Date(now - day).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not add the expired recording: ${error.message}`);
  await adminClient().storage.from(recordingsBucket).copy(`${clipFolder}/${clipName}`, filePath);
  filesMade.push(filePath);
  return data.id;
}

beforeAll(async () => {
  const admin = adminClient();
  for (const viewer of roles) {
    users[viewer] = await createTestUser(`t14-${viewer}`);
    const role = { owner: "customer", otherCustomer: "customer", agency: "agency", otherAgency: "agency", admin: "admin", cleaner: "cleaner" }[viewer];
    if (role !== "customer") await admin.from("profiles").update({ role }).eq("id", user(viewer).id);
  }
  await admin.from("service_areas").insert({ id: area, name_id: "Uji Akses", name_en: "Test Access" });
  const { data: agency } = await admin
    .from("agencies")
    .insert({ key: `${prefix}-a`, name: "Uji Agensi", user_id: user("agency").id })
    .select("id")
    .single();
  agencyId = agency?.id;
  await admin.from("agencies").insert({ key: `${prefix}-b`, name: "Uji Agensi Lain", user_id: user("otherAgency").id });
  await admin.from("agency_areas").insert({ agency_id: agencyId, area_id: area });
  await admin.from("services").insert({
    id: serviceId, category: "rooms", name_id: "Uji Akses", name_en: "Test Access",
    description_id: "Layanan uji.", description_en: "A test service.", price_idr: price, duration_minutes: 60,
  });
  await admin.storage.from(recordingsBucket).upload(`${clipFolder}/${clipName}`, clipBytes, { contentType: "video/mp4" });

  const available = await attachRecording(admin, await paidOrder());
  // Expires in 2 minutes: its link may not outlive it.
  const endingSoon = await attachRecording(admin, await paidOrder(), { retentionDays: 2 / (24 * 60) });
  filesMade.push(available.filePath, endingSoon.filePath);
  recordings.available = available.id;
  recordings.endingSoon = endingSoon.id;
  recordings.expired = await expiredRecording();
}, 120_000);

afterAll(async () => {
  const admin = adminClient();
  await admin.storage.from(recordingsBucket).remove([`${clipFolder}/${clipName}`, ...filesMade]);
  await deleteTestUsers(roles.map((viewer) => users[viewer]));
  await admin.from("availability_slots").delete().eq("area_id", area);
  await admin.from("agencies").delete().like("key", `${prefix}-%`);
  await admin.from("services").delete().eq("id", serviceId);
  await admin.from("service_areas").delete().eq("id", area);
}, 60_000);

const allowed: Viewer[] = ["owner", "agency", "admin"];
const refused: Viewer[] = ["otherCustomer", "otherAgency", "cleaner"];

/** Seconds a signed link stays valid, read from its token (a JWT: header.payload.signature). */
function linkLifetime(url: string): number {
  const token = new URL(url).searchParams.get("token") ?? "";
  const claims = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as { iat: number; exp: number };
  return claims.exp - claims.iat;
}

describe("recordingLink: who may replay", () => {
  it.each(allowed)("gives %s a short-lived link that plays the recording", async (viewer) => {
    const link = await recordingLink(user(viewer).client, adminClient(), recordings.available);

    expect(linkLifetime(link.url)).toBeLessThanOrEqual(600);
    expect(Date.parse(link.availableUntil)).toBeGreaterThan(Date.now() + 6 * day);
    const response = await fetch(link.url);
    expect(response.ok).toBe(true);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(clipBytes);
  });

  it.each(refused)("refuses %s as if there were no recording", async (viewer) => {
    await expect(recordingLink(user(viewer).client, adminClient(), recordings.available)).rejects.toMatchObject({
      reason: "recording_not_found",
    });
  });

  it.each(allowed)("tells %s that an expired recording is no longer available", async (viewer) => {
    await expect(recordingLink(user(viewer).client, adminClient(), recordings.expired)).rejects.toMatchObject({
      reason: "recording_expired",
    });
  });

  it.each(refused)("refuses %s an expired recording without saying it existed", async (viewer) => {
    await expect(recordingLink(user(viewer).client, adminClient(), recordings.expired)).rejects.toMatchObject({
      reason: "recording_not_found",
    });
  });

  it("refuses a visitor who is not signed in", async () => {
    const { error } = await visitorClient().rpc("recording_for_viewer", { p_recording: recordings.available });
    expect(error?.code).toBe("42501");
  });

  it("answers an unknown recording as not found", async () => {
    await expect(recordingLink(user("admin").client, adminClient(), randomUUID())).rejects.toMatchObject({
      reason: "recording_not_found",
    });
  });

  it("never gives a link that outlives the recording", async () => {
    const link = await recordingLink(user("owner").client, adminClient(), recordings.endingSoon);
    expect(linkLifetime(link.url)).toBeLessThanOrEqual(120);
  });

  it("follows the agency the job was routed to, not just any agency", async () => {
    const { data } = await adminClient().from("recordings").select("agency_id").eq("id", recordings.available).single();
    expect(data?.agency_id).toBe(agencyId);
  });
});
