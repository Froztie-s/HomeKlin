import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAdminOrderDetail } from "@/lib/jobs/admin-order";
import { adminClient, visitorClient } from "./test-project";
import { createWorld, hours, type World } from "./world";

// B2 (Phase 15, supabase/migrations/20261114130000_admin_order_detail.sql, the cleaner's phone added in
// 20261120090000_admin_cleaner_phone.sql): admin's read of one order
// for the Admin-Order and Admin-Order-Issue screens, against the real test project: who, where and when,
// the fee split (real after check-out, expected before), the status times and the stream's state.

let world: World;

beforeAll(async () => {
  world = await createWorld("b2");
}, 180_000);

afterAll(async () => {
  await world.cleanup();
}, 120_000);

const detail = (order: string) => world.users.admin.client.rpc("admin_order_detail", { p_order: order });

describe("admin_order_detail", { timeout: 60_000 }, () => {
  it("gives admin the order with the customer, the cleaner, the agency and the times", async () => {
    // The fixture writes the cleaner straight into the order, so there is no assigned time (see the next test).
    const job = await world.job({ startsAt: new Date(Date.now() - hours(1)), checkedIn: true });
    const paidAt = new Date(Date.now() - hours(3)).toISOString();
    await adminClient().from("orders").update({ payment_result_at: paidAt }).eq("id", job);

    const order = await getAdminOrderDetail(world.users.admin.client, job);
    const { data: codeRow } = await adminClient().from("orders").select("code, created_at").eq("id", job).single<{ code: string; created_at: string }>();
    expect(order).toMatchObject({
      id: job,
      orderCode: codeRow?.code,
      status: "paid",
      serviceId: world.serviceId,
      areaId: world.area,
      address: "Jl. Uji Pekerjaan No. 18, Jakarta",
      contactPhone: "+6281234567890",
      customerName: "Uji Pelanggan",
      agencyId: world.agencies.A,
      agencyName: "Uji Agensi A",
      cleanerId: world.users.cleanerA.id,
      cleanerName: "Uji Petugas A",
      priceIdr: world.price,
      agencyFeeIdr: Math.round(world.price * 0.7),
      homeklinIncomeIdr: world.price - Math.round(world.price * 0.7),
      agencyFeeFinal: false,
      paidAt,
      assignedAt: null,
      completedAt: null,
      streamStatus: null,
      streamUpdatedAt: null,
    });
    expect(order?.createdAt).toBe(new Date(codeRow?.created_at ?? 0).toISOString());
    expect(order?.checkedInAt).not.toBeNull();
  });

  // 2026-11-20 (20261120090000_admin_cleaner_phone.sql): admin can call the cleaner when a stream drops.
  it("gives admin the cleaner's phone once their agency has set it, and null before", async () => {
    const job = await world.job({ startsAt: new Date(Date.now() - hours(1)), checkedIn: true });
    const cleaner = world.users.cleanerA.id;
    const { data: before } = await adminClient().from("cleaners").select("phone").eq("user_id", cleaner).single<{ phone: string | null }>();
    try {
      await adminClient().from("cleaners").update({ phone: null }).eq("user_id", cleaner);
      expect((await getAdminOrderDetail(world.users.admin.client, job))?.cleanerPhone).toBeNull();
      await adminClient().from("cleaners").update({ phone: "+6281298765432" }).eq("user_id", cleaner);
      expect((await getAdminOrderDetail(world.users.admin.client, job))?.cleanerPhone).toBe("+6281298765432");
    } finally {
      await adminClient().from("cleaners").update({ phone: before?.phone ?? null }).eq("user_id", cleaner);
    }
  });

  it("has the assigned time, the stream's state and its last change", async () => {
    const job = await world.job({ startsAt: new Date(Date.now() + hours(2)), cleaner: null });
    expect((await world.users.agencyA.client.rpc("assign_cleaner", { p_order: job, p_cleaner: world.users.cleanerA.id })).error).toBeNull();
    const assigned = await getAdminOrderDetail(world.users.admin.client, job);
    expect(assigned?.assignedAt).not.toBeNull();

    // A stream that went weak: the state and its last report.
    const started = await world.job({ startsAt: new Date(Date.now() - hours(1)), checkedIn: true });
    expect((await world.users.cleanerA.client.rpc("start_stream", { p_order: started })).error).toBeNull();
    expect((await world.users.cleanerA.client.rpc("set_stream_status", { p_order: started, p_status: "weak" })).error).toBeNull();
    const live = await getAdminOrderDetail(world.users.admin.client, started);
    expect(live?.streamStatus).toBe("weak");
    expect(Math.abs(new Date(live?.streamUpdatedAt ?? 0).getTime() - Date.now())).toBeLessThan(60_000);
  });

  it("splits the price into the real fee and HomeKlin's income after check-out", async () => {
    const job = await world.job({ startsAt: new Date(Date.now() - hours(1)), checkedIn: true });
    expect((await world.users.cleanerA.client.rpc("check_out", { p_order: job })).error).toBeNull();
    const order = await getAdminOrderDetail(world.users.admin.client, job);
    expect(order?.agencyFeeFinal).toBe(true);
    expect(order?.completedAt).not.toBeNull();
    expect((order?.agencyFeeIdr ?? 0) + (order?.homeklinIncomeIdr ?? 0)).toBe(world.price);
  });

  it("reads an unpaid order too, without a paid time", async () => {
    const job = await world.job({ startsAt: new Date(Date.now() + hours(3)), status: "pending_payment", cleaner: null });
    const order = await getAdminOrderDetail(world.users.admin.client, job);
    expect(order).toMatchObject({ status: "pending_payment", paidAt: null, cleanerName: null });
  });

  it("answers order_not_found for an unknown order", async () => {
    expect((await detail(randomUUID())).error?.message).toBe("order_not_found");
    expect(await getAdminOrderDetail(world.users.admin.client, randomUUID())).toBeNull();
  });

  it("is for admins only", async () => {
    const job = await world.job({ startsAt: new Date(Date.now() + hours(4)) });
    for (const user of [world.users.customer, world.users.agencyA, world.users.cleanerA]) {
      const { error } = await user.client.rpc("admin_order_detail", { p_order: job });
      expect(error?.message, user.email).toBe("not_admin");
    }
    expect((await visitorClient().rpc("admin_order_detail", { p_order: job })).error).not.toBeNull();
  });
});
