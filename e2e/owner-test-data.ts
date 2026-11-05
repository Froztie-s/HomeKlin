import { randomUUID } from "node:crypto";
import { adminClient, createTestUser, deleteTestUsers, visitorClient, type TestUser } from "../tests/integration/test-project";

// Test data for the owner specs and screenshots (T29b, T29c), in the shared Supabase test project: a
// throw-away partner agency of its own in Jakarta Pusat with two paid jobs in past windows (one
// finished) and one free window 25 days ahead, which no customer page lists (they show 14 days) and no
// other agency has at that minute. Orders are written straight into the table with the secret key, as
// in ./recording-test-data.ts. The clean-up removes the customer (their orders go with them), the
// agency (its areas and windows go with it), any partner the spec added through the page (by name) and
// any admin account it created (by email).

export const area = { id: "jakarta-pusat", name: "Jakarta Pusat", nameEn: "Central Jakarta" };
const serviceId = "regular";

const hour = 3_600_000;
const day = 24 * hour;

export type OwnerWorld = {
  key: string;
  agency: { id: string; name: string };
  /** What the agency's two paid jobs add up to. */
  revenueIdr: number;
  /** The agency's own free window. */
  window: { startsAt: string; endsAt: string };
  /** A name for a partner the spec adds through the page. */
  newPartnerName: string;
  /** An admin the spec creates through the page. */
  newAdmin: { fullName: string; email: string; password: string };
  cleanup: () => Promise<void>;
};

async function must<T>(what: string, request: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(`Could not set up ${what}: ${error.message}`);
  return data as T;
}

/** Whether the area's combined free windows for the next 30 days include this start. */
export async function windowOffered(startsAt: string): Promise<boolean> {
  const now = Date.now();
  const { data, error } = await visitorClient().rpc("free_slots", {
    p_area: area.id,
    p_from: new Date(now).toISOString(),
    p_to: new Date(now + 30 * day).toISOString(),
  });
  if (error) throw new Error(`Could not read the free windows: ${error.message}`);
  return (data as { starts_at: string }[]).some((row) => new Date(row.starts_at).toISOString() === startsAt);
}

export async function deleteAuthUserByEmail(email: string): Promise<void> {
  const admin = adminClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = data?.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
  if (user) await admin.auth.admin.deleteUser(user.id);
}

export async function createOwnerWorld(label: string): Promise<OwnerWorld> {
  const admin = adminClient();
  const key = `${label}-${randomUUID().slice(0, 8)}`;
  const agencyName = `Uji Mitra Pemilik ${key}`;
  const newPartnerName = `Uji Mitra Baru ${key}`;
  const newAdmin = { fullName: `Uji Admin Baru ${key}`, email: `homeklin-${key}-admin@example.com`, password: `Sandi-${randomUUID()}` };
  const made: TestUser[] = [];

  const agency = await must("the agency", admin.from("agencies").insert({ key, name: agencyName }).select("id").single<{ id: string }>());

  const cleanup = async () => {
    await deleteTestUsers(made);
    await admin.from("agencies").delete().eq("id", agency.id);
    await admin.from("agencies").delete().eq("name", newPartnerName);
    await deleteAuthUserByEmail(newAdmin.email);
  };

  try {
    const customer = await createTestUser(`${label}-customer`, { full_name: "Uji Pelanggan Pemilik" });
    made.push(customer);
    await must("the agency's area", admin.from("agency_areas").insert({ agency_id: agency.id, area_id: area.id }));
    const { price_idr: price } = await must(
      "the service price",
      admin.from("services").select("price_idr").eq("id", serviceId).single<{ price_idr: number }>(),
    );

    async function paidJob(daysAgo: number, completed: boolean) {
      const moment = new Date(Date.now() - daysAgo * day);
      const startsAt = new Date(Date.UTC(moment.getUTCFullYear(), moment.getUTCMonth(), moment.getUTCDate(), 2));
      const endsAt = new Date(startsAt.getTime() + 2 * hour);
      const slot = await must(
        "a past window",
        admin
          .from("availability_slots")
          .insert({ agency_id: agency.id, area_id: area.id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), capacity: 1, booked: 1 })
          .select("id")
          .single<{ id: string }>(),
      );
      await must(
        "a paid job",
        admin.from("orders").insert({
          customer_id: customer.id,
          service_id: serviceId,
          area_id: area.id,
          agency_id: agency.id,
          slot_id: slot.id,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          address: "Jl. Contoh Pemilik No. 29, Menteng, Jakarta Pusat",
          contact_phone: "+6281234567892",
          price_idr: price,
          stream_consent: true,
          status: "paid",
          completed_at: completed ? new Date(endsAt.getTime() - 10 * 60_000).toISOString() : null,
        }),
      );
    }
    await paidJob(2, true);
    await paidJob(1, false);

    // 25 days ahead at an odd minute: no seeded window starts then.
    const ahead = new Date(Date.now() + 25 * day);
    const startsAt = new Date(Date.UTC(ahead.getUTCFullYear(), ahead.getUTCMonth(), ahead.getUTCDate(), 3, 17));
    const window = { startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 2 * hour).toISOString() };
    await must(
      "the agency's free window",
      admin.from("availability_slots").insert({ agency_id: agency.id, area_id: area.id, starts_at: window.startsAt, ends_at: window.endsAt, capacity: 1 }),
    );

    return { key, agency: { id: agency.id, name: agencyName }, revenueIdr: 2 * price, window, newPartnerName, newAdmin, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
