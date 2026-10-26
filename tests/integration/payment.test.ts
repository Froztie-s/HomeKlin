import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUsers, type TestUser } from "./test-project";

// Starting a payment (T10, supabase/migrations/20261026090000_payments.sql), against the real test
// project. order_for_payment() gives the order's own customer what the payment needs (price, service,
// phone, an existing payment link), and attach_payment() stores the Midtrans Snap link on the order,
// both only for that customer and only while the order waits for payment. Another customer gets
// nothing and can change nothing.

const prefix = `t10-${randomUUID().slice(0, 8)}`;
const area = `${prefix}-area`;
const serviceId = `${prefix}-svc`;
let owner: TestUser | undefined;
let other: TestUser | undefined;
let orderId = "";
let paidOrderId = "";

function user(u: TestUser | undefined): TestUser {
  if (!u) throw new Error("The test user was not created (see beforeAll).");
  return u;
}

beforeAll(async () => {
  const admin = adminClient();
  await admin.from("service_areas").insert({ id: area, name_id: "Uji Bayar", name_en: "Test Pay" });
  const { data: agency } = await admin.from("agencies").insert({ key: `${prefix}-a`, name: "Uji Agensi" }).select("id").single();
  await admin.from("agency_areas").insert({ agency_id: agency?.id, area_id: area });
  await admin.from("services").insert({
    id: serviceId, category: "rooms", name_id: "Uji Bayar", name_en: "Test Payment",
    description_id: "Layanan uji.", description_en: "A test service.", price_idr: 99000, duration_minutes: 60,
  });
  const start = new Date(Date.UTC(2031, 0, 5, 1));
  await admin.from("availability_slots").insert({
    agency_id: agency?.id, area_id: area, capacity: 3,
    starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 7_200_000).toISOString(),
  });

  owner = await createTestUser("t10-owner");
  other = await createTestUser("t10-other");
  const book = () =>
    user(owner).client.rpc("book_slot", {
      p_service: serviceId, p_area: area, p_starts_at: start.toISOString(),
      p_address: "Jl. Uji Bayar No. 2, Jakarta", p_phone: "+6281234567890", p_consent: true,
    });
  orderId = (await book()).data?.[0]?.order_id;
  paidOrderId = (await book()).data?.[0]?.order_id;
  await admin.from("orders").update({ status: "paid" }).eq("id", paidOrderId);
}, 90_000);

afterAll(async () => {
  const admin = adminClient();
  await deleteTestUsers([owner, other]);
  await admin.from("agencies").delete().like("key", `${prefix}-%`);
  await admin.from("services").delete().eq("id", serviceId);
  await admin.from("service_areas").delete().eq("id", area);
}, 60_000);

describe("order_for_payment", () => {
  it("gives the order's customer the price, service, window and phone, without the agency", async () => {
    const { data, error } = await user(owner).client.rpc("order_for_payment", { p_order: orderId });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({
      order_id: orderId,
      service_id: serviceId,
      service_name_id: "Uji Bayar",
      service_name_en: "Test Payment",
      price_idr: 99000,
      contact_phone: "+6281234567890",
      status: "pending_payment",
      payment_url: null,
    });
    expect(Object.keys(data?.[0] ?? {})).not.toContain("agency_id");
  });

  it("gives another customer nothing", async () => {
    const { data, error } = await user(other).client.rpc("order_for_payment", { p_order: orderId });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("attach_payment", () => {
  it("refuses another customer and changes nothing", async () => {
    const { error } = await user(other).client.rpc("attach_payment", {
      p_order: orderId, p_token: "evil", p_url: "https://app.sandbox.midtrans.com/snap/v4/redirection/evil",
    });
    expect(error?.message).toBe("order_not_payable");
    const { data } = await adminClient().from("orders").select("payment_url").eq("id", orderId).single();
    expect(data?.payment_url).toBeNull();
  });

  it("refuses a link that is not Midtrans' own payment page", async () => {
    const { error } = await user(owner).client.rpc("attach_payment", {
      p_order: orderId, p_token: "t", p_url: "https://evil.example/snap/v4/redirection/x",
    });
    expect(error?.message).toBe("payment_url_invalid");
  });

  it("stores the Snap link once for the waiting order, which the customer then reads back", async () => {
    const url = "https://app.sandbox.midtrans.com/snap/v4/redirection/abc-123";
    const { error } = await user(owner).client.rpc("attach_payment", { p_order: orderId, p_token: "abc-123", p_url: url });
    expect(error).toBeNull();
    const { data } = await user(owner).client.rpc("order_for_payment", { p_order: orderId });
    expect(data?.[0]?.payment_url).toBe(url);

    // A second link is refused: the first one is still valid and is reused.
    const again = await user(owner).client.rpc("attach_payment", { p_order: orderId, p_token: "x", p_url: url.replace("abc", "xyz") });
    expect(again.error?.message).toBe("order_not_payable");
  });

  it("refuses an order that is already paid", async () => {
    const { error } = await user(owner).client.rpc("attach_payment", {
      p_order: paidOrderId, p_token: "t", p_url: "https://app.sandbox.midtrans.com/snap/v4/redirection/t",
    });
    expect(error?.message).toBe("order_not_payable");
  });
});
