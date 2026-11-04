import { randomUUID } from "node:crypto";
import { attachRecording, clipFolder, recordingsBucket } from "../src/lib/recordings/attach";
import { adminClient, createTestUser, deleteTestUsers, type TestUser } from "../tests/integration/test-project";

// Test data for the replay specs and screenshots (T15), in the shared Supabase test project: finished
// jobs of one customer, each in its own past window, with a Petugas HomeKlin and a recording. The jobs
// belong to a throw-away agency of their own in Jakarta Pusat, whose windows all lie in the past, so no
// other spec ever books, lists or counts them. Orders are written straight into the table with the
// secret key (book_slot only books future windows); the recording is attached the way check-out does
// (attachRecording), from a tiny stand-in clip in the library. The stand-in bytes are not a real video.
// Everything made is removed again: the job files under jobs/, the users (their orders, recordings and
// cleaner rows go with them) and the agency (its area and windows go with it). The library clip stays:
// other tests share it.

export const area = "jakarta-pusat";
export const service = { id: "regular", name: "Pembersihan Rutin", nameEn: "Regular Cleaning" };
export const standInClip = { path: `${clipFolder}/test-clip.mp4`, bytes: new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]) };

const hour = 3_600_000;
const day = 24 * hour;

export type JobKind = "available" | "expired" | "none";

export type ReplayWorld = {
  agency: { id: string; name: string };
  customer: TestUser;
  other: TestUser;
  cleaners: { withPhoto: { name: string }; withoutPhoto: { name: string } };
  /** Order ids by kind: a recording that plays, one deleted after 7 days, and a job without one. */
  orders: Record<JobKind, string>;
  recordings: { available: string; expired: string };
  /** Where the available recording's file lives in the bucket. */
  availableFile: string;
  cleanup: () => Promise<void>;
};

async function must<T>(what: string, request: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(`Could not set up ${what}: ${error.message}`);
  return data as T;
}

/** A whole hour in Jakarta `daysAgo` days back, at that UTC hour (02:00Z is 09.00 WIB). */
function pastStart(daysAgo: number, utcHour: number): Date {
  const moment = new Date(Date.now() - daysAgo * day);
  return new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), moment.getUTCDate(), utcHour));
}

export async function createReplayWorld(label: string): Promise<ReplayWorld> {
  const admin = adminClient();
  const key = `${label}-${randomUUID().slice(0, 8)}`;
  const files: string[] = [];
  const made: TestUser[] = [];

  const customer = await createTestUser(`${label}-customer`, { full_name: "Uji Pelanggan" });
  made.push(customer);
  const other = await createTestUser(`${label}-other`, { full_name: "Uji Pelanggan Lain" });
  made.push(other);
  const cleanerUsers = [await createTestUser(`${label}-cleaner-a`), await createTestUser(`${label}-cleaner-b`)];
  made.push(...cleanerUsers);

  const agencyName = `Uji Agensi Rekaman ${key}`;
  const agency = await must(
    "the agency",
    admin.from("agencies").insert({ key, name: agencyName }).select("id").single<{ id: string }>(),
  );

  const cleanup = async () => {
    if (files.length > 0) await admin.storage.from(recordingsBucket).remove(files);
    // The customers first: their orders hold the agency and the windows.
    await deleteTestUsers(made);
    await admin.from("agencies").delete().eq("id", agency.id);
  };

  try {
    await must("the agency's area", admin.from("agency_areas").insert({ agency_id: agency.id, area_id: area }));
    const cleaners = { withPhoto: { name: "Rina Wulandari" }, withoutPhoto: { name: "Sari Utami" } };
    for (const user of cleanerUsers) {
      await must("the cleaner role", admin.from("profiles").update({ role: "cleaner" }).eq("id", user.id));
    }
    await must(
      "the cleaners",
      admin.from("cleaners").insert([
        { user_id: cleanerUsers[0].id, agency_id: agency.id, full_name: cleaners.withPhoto.name, photo_url: "/images/cleaner-avatar.jpg" },
        { user_id: cleanerUsers[1].id, agency_id: agency.id, full_name: cleaners.withoutPhoto.name, photo_url: null },
      ]),
    );
    const { price_idr: price } = await must(
      "the service price",
      admin.from("services").select("price_idr").eq("id", service.id).single<{ price_idr: number }>(),
    );

    async function finishedJob(startsAt: Date, cleaner: TestUser, address: string): Promise<string> {
      const endsAt = new Date(startsAt.getTime() + 2 * hour);
      const slot = await must(
        "a past window",
        admin
          .from("availability_slots")
          .insert({ agency_id: agency.id, area_id: area, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), capacity: 1, booked: 1 })
          .select("id")
          .single<{ id: string }>(),
      );
      const order = await must(
        "a finished job",
        admin
          .from("orders")
          .insert({
            customer_id: customer.id,
            service_id: service.id,
            area_id: area,
            agency_id: agency.id,
            slot_id: slot.id,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            address,
            contact_phone: "+6281234567891",
            price_idr: price,
            stream_consent: true,
            status: "paid",
            cleaner_id: cleaner.id,
            checked_in_at: new Date(startsAt.getTime() + 5 * 60_000).toISOString(),
            check_in_lat: -6.18,
            check_in_lng: 106.83,
            completed_at: new Date(endsAt.getTime() - 10 * 60_000).toISOString(),
          })
          .select("id")
          .single<{ id: string }>(),
      );
      return order.id;
    }

    // Booked in this order, so the list shows the available one first (newest first).
    const expiredOrder = await finishedJob(pastStart(9, 2), cleanerUsers[1], "Jl. Contoh Kedaluwarsa No. 8, Menteng, Jakarta Pusat");
    const noneOrder = await finishedJob(pastStart(2, 6), cleanerUsers[1], "Jl. Contoh Tanpa Rekaman No. 5, Menteng, Jakarta Pusat");
    const availableOrder = await finishedJob(pastStart(1, 2), cleanerUsers[0], "Jl. Contoh Rekaman No. 12, Menteng, Jakarta Pusat");

    await must(
      "the stand-in clip",
      admin.storage.from(recordingsBucket).upload(standInClip.path, standInClip.bytes, { contentType: "video/mp4", upsert: true }),
    );
    const available = await attachRecording(admin, availableOrder);
    files.push(available.filePath);

    // A recording whose 7 days are over, as the cleanup (T16) finds it. It never had a file.
    const now = Date.now();
    const expired = await must(
      "the expired recording",
      admin
        .from("recordings")
        .insert({
          order_id: expiredOrder,
          agency_id: agency.id,
          file_path: `jobs/${expiredOrder}.mp4`,
          created_at: new Date(now - 8 * day).toISOString(),
          expires_at: new Date(now - day).toISOString(),
        })
        .select("id")
        .single<{ id: string }>(),
    );

    return {
      agency: { id: agency.id, name: agencyName },
      customer,
      other,
      cleaners,
      orders: { available: availableOrder, expired: expiredOrder, none: noneOrder },
      recordings: { available: available.id, expired: expired.id },
      availableFile: available.filePath,
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
