import { randomUUID } from "node:crypto";
import { adminClient, createTestUser, deleteTestUsers, type TestUser } from "./test-project";

// A small world of its own in the test project, for the tests from T15 on: an area, a service, two
// partner agencies (A and B) with a sign-in each and two cleaners each, two customers and an admin.
// Every row carries a random prefix, so tests running at the same time never meet. Jobs are written
// straight into the table with the secret key, so a test can place a job in the past or right now
// (book_slot only books future windows); the booking itself is tested in booking.test.ts.

export type World = {
  prefix: string;
  area: string;
  serviceId: string;
  price: number;
  agencies: { A: string; B: string };
  users: {
    customer: TestUser;
    otherCustomer: TestUser;
    agencyA: TestUser;
    agencyB: TestUser;
    cleanerA: TestUser;
    cleanerA2: TestUser;
    cleanerB: TestUser;
    admin: TestUser;
  };
  /** A paid job of the customer at agency A (or B), at the given times, optionally with a cleaner. */
  job: (options: JobOptions) => Promise<string>;
  cleanup: () => Promise<void>;
};

export type JobOptions = {
  startsAt: Date;
  hours?: number;
  agency?: "A" | "B";
  cleaner?: TestUser | null;
  customer?: TestUser;
  status?: "pending_payment" | "paid" | "failed" | "cancelled";
  checkedIn?: boolean;
  completed?: boolean;
  consent?: boolean;
};

async function must<T>(what: string, request: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(`Could not set up ${what}: ${error.message}`);
  // Writes without .select() answer null; the setup reads only what it selected.
  return data as T;
}

export async function createWorld(label: string): Promise<World> {
  const prefix = `${label}-${randomUUID().slice(0, 8)}`;
  const admin = adminClient();
  const area = `${prefix}-area`;
  const serviceId = `${prefix}-svc`;
  const price = 66000;

  const users = {
    customer: await createTestUser(`${label}-customer`),
    otherCustomer: await createTestUser(`${label}-other`),
    agencyA: await createTestUser(`${label}-agency-a`),
    agencyB: await createTestUser(`${label}-agency-b`),
    cleanerA: await createTestUser(`${label}-cleaner-a`),
    cleanerA2: await createTestUser(`${label}-cleaner-a2`),
    cleanerB: await createTestUser(`${label}-cleaner-b`),
    admin: await createTestUser(`${label}-admin`),
  };
  const roles: [TestUser, string][] = [
    [users.agencyA, "agency"], [users.agencyB, "agency"],
    [users.cleanerA, "cleaner"], [users.cleanerA2, "cleaner"], [users.cleanerB, "cleaner"],
    [users.admin, "admin"],
  ];
  for (const [user, role] of roles) {
    await must(`the ${role} role`, admin.from("profiles").update({ role }).eq("id", user.id));
  }
  await must("the customer name", admin.from("profiles").update({ full_name: "Uji Pelanggan" }).eq("id", users.customer.id));

  await must("the area", admin.from("service_areas").insert({ id: area, name_id: `Uji ${label}`, name_en: `Test ${label}` }));
  const agencies = await must(
    "the agencies",
    admin
      .from("agencies")
      .insert([
        { key: `${prefix}-a`, name: "Uji Agensi A", user_id: users.agencyA.id },
        { key: `${prefix}-b`, name: "Uji Agensi B", user_id: users.agencyB.id },
      ])
      .select("id, key"),
  );
  const A = agencies.find((row) => row.key === `${prefix}-a`)?.id ?? "";
  const B = agencies.find((row) => row.key === `${prefix}-b`)?.id ?? "";
  await must("the agency areas", admin.from("agency_areas").insert([{ agency_id: A, area_id: area }, { agency_id: B, area_id: area }]));
  await must(
    "the cleaners",
    admin.from("cleaners").insert([
      { user_id: users.cleanerA.id, agency_id: A, full_name: "Uji Petugas A" },
      { user_id: users.cleanerA2.id, agency_id: A, full_name: "Uji Petugas A2" },
      { user_id: users.cleanerB.id, agency_id: B, full_name: "Uji Petugas B" },
    ]),
  );
  await must(
    "the service",
    admin.from("services").insert({
      id: serviceId, category: "rooms", name_id: `Uji ${label}`, name_en: `Test ${label}`,
      description_id: "Layanan uji.", description_en: "A test service.", price_idr: price, duration_minutes: 60,
    }),
  );

  let minuteOffset = 0;
  async function job(options: JobOptions): Promise<string> {
    const agencyId = options.agency === "B" ? B : A;
    // Each job gets its own window: windows are unique per agency, area and start.
    minuteOffset += 1;
    const startsAt = new Date(options.startsAt.getTime() + minuteOffset * 1000);
    const endsAt = new Date(startsAt.getTime() + (options.hours ?? 2) * 3_600_000);
    const slot = await must(
      "a window",
      admin
        .from("availability_slots")
        .insert({ agency_id: agencyId, area_id: area, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), capacity: 1, booked: 1 })
        .select("id")
        .single<{ id: string }>(),
    );
    const cleaner = options.cleaner === undefined ? users.cleanerA : options.cleaner;
    const order = await must(
      "a job",
      admin
        .from("orders")
        .insert({
          customer_id: (options.customer ?? users.customer).id,
          service_id: serviceId,
          area_id: area,
          agency_id: agencyId,
          slot_id: slot.id,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          address: "Jl. Uji Pekerjaan No. 18, Jakarta",
          contact_phone: "+6281234567890",
          price_idr: price,
          stream_consent: options.consent ?? true,
          status: options.status ?? "paid",
          cleaner_id: cleaner?.id ?? null,
          checked_in_at: options.checkedIn || options.completed ? startsAt.toISOString() : null,
          check_in_lat: options.checkedIn || options.completed ? -6.2 : null,
          check_in_lng: options.checkedIn || options.completed ? 106.8 : null,
          completed_at: options.completed ? endsAt.toISOString() : null,
        })
        .select("id")
        .single<{ id: string }>(),
    );
    return order.id;
  }

  async function cleanup() {
    await deleteTestUsers(Object.values(users));
    await admin.from("availability_slots").delete().eq("area_id", area);
    await admin.from("agencies").delete().like("key", `${prefix}-%`);
    await admin.from("services").delete().eq("id", serviceId);
    await admin.from("service_areas").delete().eq("id", area);
  }

  return { prefix, area, serviceId, price, agencies: { A, B }, users, job, cleanup };
}

export const minutes = (count: number) => count * 60_000;
export const hours = (count: number) => count * 3_600_000;
