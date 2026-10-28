import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUsers, visitorClient, type TestUser } from "./test-project";

// Recording Midtrans' verdict on an order (T11, supabase/migrations/20261028090000_payment_results.sql),
// against the real test project. apply_payment_result() moves an order that waits for payment to paid,
// failed or cancelled exactly once; a failed or cancelled order gives its place in the window back.
// Midtrans may send the same notification more than once, or two at the same moment: the second one
// changes nothing and gives no place back a second time. Only HomeKlin's server (the secret key) may
// call it, never a customer or a visitor.

const prefix = `t11-${randomUUID().slice(0, 8)}`;
const area = `${prefix}-area`;
const serviceId = `${prefix}-svc`;
const price = 99000;
const start = new Date(Date.UTC(2031, 1, 3, 1)).toISOString();
let customer: TestUser | undefined;
let slotId = "";

function user(u: TestUser | undefined): TestUser {
  if (!u) throw new Error("The test user was not created (see beforeAll).");
  return u;
}

async function book(): Promise<string> {
  const { data, error } = await user(customer).client.rpc("book_slot", {
    p_service: serviceId, p_area: area, p_starts_at: start,
    p_address: "Jl. Uji Hasil Bayar No. 3, Jakarta", p_phone: "+6281234567890", p_consent: true,
  });
  if (error) throw new Error(`Could not book the test window: ${error.message}`);
  return data?.[0]?.order_id;
}

async function booked(): Promise<number> {
  const { data } = await adminClient().from("availability_slots").select("booked").eq("id", slotId).single();
  return data?.booked;
}

async function statusOf(orderId: string): Promise<string> {
  const { data } = await adminClient().from("orders").select("status").eq("id", orderId).single();
  return data?.status;
}

const apply = (orderId: string, status: string, amount = price) =>
  adminClient().rpc("apply_payment_result", { p_order: orderId, p_status: status, p_amount: amount });

beforeAll(async () => {
  const admin = adminClient();
  await admin.from("service_areas").insert({ id: area, name_id: "Uji Hasil", name_en: "Test Result" });
  const { data: agency } = await admin.from("agencies").insert({ key: `${prefix}-a`, name: "Uji Agensi" }).select("id").single();
  await admin.from("agency_areas").insert({ agency_id: agency?.id, area_id: area });
  await admin.from("services").insert({
    id: serviceId, category: "rooms", name_id: "Uji Hasil", name_en: "Test Result",
    description_id: "Layanan uji.", description_en: "A test service.", price_idr: price, duration_minutes: 60,
  });
  const { data: slot } = await admin
    .from("availability_slots")
    .insert({
      agency_id: agency?.id, area_id: area, capacity: 10,
      starts_at: start, ends_at: new Date(Date.parse(start) + 7_200_000).toISOString(),
    })
    .select("id")
    .single();
  slotId = slot?.id;
  customer = await createTestUser("t11-customer");
}, 90_000);

afterAll(async () => {
  const admin = adminClient();
  await deleteTestUsers([customer]);
  await admin.from("agencies").delete().like("key", `${prefix}-%`);
  await admin.from("services").delete().eq("id", serviceId);
  await admin.from("service_areas").delete().eq("id", area);
}, 60_000);

describe("apply_payment_result", () => {
  it("marks a successful payment as paid and keeps the place taken", async () => {
    const orderId = await book();
    const before = await booked();

    const { data, error } = await apply(orderId, "paid");

    expect(error).toBeNull();
    expect(data).toBe("paid");
    expect(await statusOf(orderId)).toBe("paid");
    expect(await booked()).toBe(before);
  });

  it.each(["failed", "cancelled"])("marks the order %s and gives its place back", async (status) => {
    const orderId = await book();
    const before = await booked();

    const { data, error } = await apply(orderId, status);

    expect(error).toBeNull();
    expect(data).toBe(status);
    expect(await statusOf(orderId)).toBe(status);
    expect(await booked()).toBe(before - 1);
  });

  it("changes nothing when the same notification comes again", async () => {
    const orderId = await book();
    const before = await booked();

    await apply(orderId, "cancelled");
    const again = await apply(orderId, "cancelled");

    expect(again.error).toBeNull();
    expect(again.data).toBe("cancelled");
    expect(await booked()).toBe(before - 1);
  });

  it("gives the place back only once when two notifications arrive at the same moment", async () => {
    const orderId = await book();
    const before = await booked();

    const answers = await Promise.all([apply(orderId, "failed"), apply(orderId, "failed"), apply(orderId, "failed")]);

    expect(answers.map((answer) => answer.error)).toEqual([null, null, null]);
    expect(answers.map((answer) => answer.data)).toEqual(["failed", "failed", "failed"]);
    expect(await booked()).toBe(before - 1);
  });

  it("keeps a paid order paid when a late failure arrives, and answers with the status it has", async () => {
    const orderId = await book();
    await apply(orderId, "paid");
    const before = await booked();

    const late = await apply(orderId, "failed");

    expect(late.error).toBeNull();
    expect(late.data).toBe("paid");
    expect(await statusOf(orderId)).toBe("paid");
    expect(await booked()).toBe(before);
  });

  it("counts a payment that succeeds after a decline, and takes the place again", async () => {
    const orderId = await book();
    await apply(orderId, "failed");
    const before = await booked();

    const retried = await apply(orderId, "paid");
    const again = await apply(orderId, "paid");

    expect(retried).toMatchObject({ data: "paid", error: null });
    expect(again).toMatchObject({ data: "paid", error: null });
    expect(await statusOf(orderId)).toBe("paid");
    expect(await booked()).toBe(before + 1);
  });

  it("keeps the order cancelled when money arrives after its window filled up", async () => {
    const orderId = await book();
    await apply(orderId, "cancelled");
    const admin = adminClient();
    const { data: slot } = await admin.from("availability_slots").select("booked, capacity").eq("id", slotId).single();
    await admin.from("availability_slots").update({ booked: slot?.capacity }).eq("id", slotId);
    try {
      const late = await apply(orderId, "paid");

      expect(late).toMatchObject({ data: "cancelled", error: null });
      expect(await statusOf(orderId)).toBe("cancelled");
      expect(await booked()).toBe(slot?.capacity);
    } finally {
      await admin.from("availability_slots").update({ booked: slot?.booked }).eq("id", slotId);
    }
  });

  it("refuses an amount that is not the order's price, and changes nothing", async () => {
    const orderId = await book();
    const { error } = await apply(orderId, "paid", price - 1);
    expect(error?.message).toBe("amount_mismatch");
    expect(await statusOf(orderId)).toBe("pending_payment");
  });

  it("refuses an order that does not exist", async () => {
    const { error } = await apply(randomUUID(), "paid");
    expect(error?.message).toBe("order_not_found");
  });

  it("refuses a result that is not paid, failed or cancelled", async () => {
    const orderId = await book();
    const { error } = await apply(orderId, "pending_payment");
    expect(error?.message).toBe("status_invalid");
    expect(await statusOf(orderId)).toBe("pending_payment");
  });

  it("cannot be called by the order's own customer, nor by a visitor", async () => {
    const orderId = await book();
    const args = { p_order: orderId, p_status: "paid", p_amount: price };

    const asCustomer = await user(customer).client.rpc("apply_payment_result", args);
    const asVisitor = await visitorClient().rpc("apply_payment_result", args);

    expect(asCustomer.error).not.toBeNull();
    expect(asVisitor.error).not.toBeNull();
    expect(await statusOf(orderId)).toBe("pending_payment");
  });
});
