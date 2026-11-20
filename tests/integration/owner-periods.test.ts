import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUsers, removed, type TestUser } from "./test-project";
import { createWorld, hours, minutes, type World } from "./world";

// B5 (supabase/migrations/20261114200000_owner_periods.sql) against the real test project: the owner's
// numbers for a period of 7, 30 or 90 days next to the period before, the daily revenue of the last 14
// days and the payouts per agency; the agency summary's previous period; the partner list's 30-day
// numbers (completed, on time, cancelled, paid out); and the admins' last sign-in. Other suites write
// to the same project at the same time, so totals over all agencies are checked by their arithmetic,
// and exact numbers only for this world's own agencies.

let world: World;
let owner: TestUser | undefined;
let quietAgency = "";
let neverSignedIn = "";
const day = hours(24);
const fee = Math.round(66000 * 0.7);

function ownerUser(): TestUser {
  if (!owner) throw new Error("The owner test user was not created (see beforeAll).");
  return owner;
}

async function addFee(orderId: string, agencyId: string) {
  const { error } = await adminClient()
    .from("order_fees")
    .insert({ order_id: orderId, agency_id: agencyId, price_idr: world.price, percent: 70, fee_idr: fee });
  if (error) throw new Error(`Could not add the fee row: ${error.message}`);
}

beforeAll(async () => {
  world = await createWorld("b5");
  owner = await createTestUser("b5-owner");
  const admin = adminClient();
  await admin.from("profiles").update({ role: "owner" }).eq("id", owner.id);

  // Agency A, last 30 days: one job finished now through check_out (on time, its fee is the only one),
  // one finished job whose cleaner checked in 15 minutes late, one cancelled order; and a job finished
  // 40 days ago that counts nowhere.
  const now = await world.job({ startsAt: new Date(Date.now() - hours(1)), checkedIn: true });
  const checkOut = await world.users.cleanerA.client.rpc("check_out", { p_order: now });
  if (checkOut.error) throw new Error(`Could not check out: ${checkOut.error.message}`);
  const lateStart = new Date(Date.now() - hours(5));
  const late = await world.job({ startsAt: lateStart, completed: true });
  await admin.from("orders").update({ checked_in_at: new Date(lateStart.getTime() + minutes(15) + 1000).toISOString() }).eq("id", late);
  await world.job({ startsAt: new Date(Date.now() + hours(30)), status: "cancelled" });
  await world.job({ startsAt: new Date(Date.now() - 40 * day), completed: true });

  // Agency B: one job paid and finished 10 days ago, with its fee: in the previous 7 days, in the last 30.
  const old = await world.job({ startsAt: new Date(Date.now() - 10 * day), agency: "B", cleaner: world.users.cleanerB, completed: true });
  await admin.from("orders").update({ created_at: new Date(Date.now() - 11 * day).toISOString(), payment_result_at: new Date(Date.now() - 11 * day).toISOString() }).eq("id", old);
  await addFee(old, world.agencies.B);

  // An agency with no jobs at all, removed with the world (its key starts with the world's prefix).
  const { data: quiet, error } = await admin.from("agencies").insert({ key: `${world.prefix}-quiet`, name: "Uji Agensi Sepi" }).select("id").single<{ id: string }>();
  if (error || !quiet) throw new Error(`Could not add the quiet agency: ${error?.message}`);
  quietAgency = quiet.id;

  // An admin who has never signed in.
  const created = await admin.auth.admin.createUser({ email: `homeklin-b5-new-admin-${world.prefix}@example.com`, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`Could not add the new admin: ${created.error?.message}`);
  neverSignedIn = created.data.user.id;
  await admin.from("profiles").update({ role: "admin" }).eq("id", neverSignedIn);
}, 180_000);

afterAll(async () => {
  if (neverSignedIn) await removed("the new admin", adminClient().auth.admin.deleteUser(neverSignedIn));
  await deleteTestUsers([owner]);
  await world.cleanup();
}, 120_000);

type Totals = { revenue_idr: number; paid_orders: number; avg_order_idr: number; paid_out_idr: number; homeklin_idr: number };
type Numbers = {
  days: number;
  period: Totals;
  previous: Totals;
  daily: { date: string; revenue_idr: number }[];
  payouts_by_agency: { agency_id: string; name: string; paid_out_idr: number }[];
  daily_period: { date: string; revenue_idr: number }[];
  by_status_period: Record<"pending_payment" | "paid" | "failed" | "cancelled", number>;
};

async function numbers(days: number): Promise<Numbers> {
  const { data, error } = await ownerUser().client.rpc("owner_numbers", { p_days: days });
  expect(error).toBeNull();
  return data as Numbers;
}

const jakartaToday = () => new Date(Date.now() + hours(7)).toISOString().slice(0, 10);

describe("the owner's numbers for a period", { timeout: 30_000 }, () => {
  it("accepts 7, 30 and 90 days only", async () => {
    for (const days of [0, 1, 14, 31, 365, -7]) {
      expect((await ownerUser().client.rpc("owner_numbers", { p_days: days })).error?.message, String(days)).toBe("invalid_days");
    }
    expect((await ownerUser().client.rpc("owner_numbers", { p_days: null })).error?.message).toBe("invalid_days");
    expect((await world.users.admin.client.rpc("owner_numbers", { p_days: 30 })).error?.code).toBe("42501");
  });

  it("gives the period and the period before, whose shares add up to the revenue", async () => {
    for (const days of [7, 30, 90]) {
      const data = await numbers(days);
      expect(data.days).toBe(days);
      for (const totals of [data.period, data.previous]) {
        expect(Object.keys(totals).sort()).toEqual(["avg_order_idr", "homeklin_idr", "paid_orders", "paid_out_idr", "revenue_idr"]);
        expect(totals.homeklin_idr).toBe(totals.revenue_idr - totals.paid_out_idr);
        expect(totals.avg_order_idr).toBe(totals.paid_orders ? Math.round(totals.revenue_idr / totals.paid_orders) : 0);
      }
    }
    // Agency B's job, paid and finished 10 days ago, is in the 7 days before the last 7.
    const week = await numbers(7);
    expect(week.previous.revenue_idr).toBeGreaterThanOrEqual(world.price);
    expect(week.previous.paid_out_idr).toBeGreaterThanOrEqual(fee);
  });

  it("has the daily revenue of the last 14 Jakarta days, ending today", async () => {
    const { daily } = await numbers(7);
    expect(daily).toHaveLength(14);
    expect(daily.at(-1)?.date.slice(0, 10)).toBe(jakartaToday());
    expect(daily.at(-1)?.revenue_idr).toBeGreaterThanOrEqual(3 * world.price);
  });

  // 20261120100000_owner_numbers_period.sql: the chart and the status counts follow the period.
  it("has the daily revenue over the whole period, ending today, and the period's orders by status", async () => {
    for (const days of [7, 30, 90]) {
      const data = await numbers(days);
      expect(data.daily_period, String(days)).toHaveLength(days);
      expect(data.daily_period.at(-1)?.date.slice(0, 10)).toBe(jakartaToday());
      const sum = data.daily_period.reduce((total, day) => total + Number(day.revenue_idr), 0);
      expect(sum).toBeGreaterThanOrEqual(3 * world.price);
      expect(Object.keys(data.by_status_period).sort()).toEqual(["cancelled", "failed", "paid", "pending_payment"]);
    }
    // Dated as revenue is (20261120110000): the period's paid orders and "Dibayar" agree.
    for (const days of [7, 30, 90]) {
      const data = await numbers(days);
      expect(data.by_status_period.paid, String(days)).toBe(data.period.paid_orders);
    }
    // A longer period holds at least the orders of a shorter one.
    const [week, quarter] = [await numbers(7), await numbers(90)];
    expect(quarter.by_status_period.paid).toBeGreaterThanOrEqual(week.by_status_period.paid);
    // The old keys stay as they were, for the code already deployed.
    expect(week.daily).toHaveLength(14);
  });

  it("splits the payouts by agency for the period", async () => {
    const find = (data: Numbers, agency: string) => data.payouts_by_agency.find((row) => row.agency_id === agency);
    const week = await numbers(7);
    expect(find(week, world.agencies.A)).toEqual({ agency_id: world.agencies.A, name: "Uji Agensi A", paid_out_idr: fee });
    expect(find(week, world.agencies.B)).toBeUndefined();
    const month = await numbers(30);
    expect(find(month, world.agencies.B)?.paid_out_idr).toBe(fee);
  });

  it("carries no customer data", async () => {
    const text = JSON.stringify(await numbers(90));
    for (const secret of [world.users.customer.email, world.users.customer.id, "+6281234567890", "Uji Pelanggan", "Jl. Uji"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("still answers without a period, as the last 30 days", async () => {
    const { data, error } = await ownerUser().client.rpc("owner_numbers");
    expect(error).toBeNull();
    expect(data.days).toBe(30);
    expect(data.trend).toHaveLength(30);
  });
});

describe("the agency summary's previous period", { timeout: 30_000 }, () => {
  const summary = async (user: TestUser, days: number) => {
    const { data, error } = await user.client.rpc("agency_summary", { p_days: days });
    expect(error).toBeNull();
    return data[0] as { total_fee_idr: number; previous_total_fee_idr: number; jobs_count: number };
  };

  it("gives the total of the period before, for the agency's own fees only", async () => {
    expect(await summary(world.users.agencyA, 7)).toMatchObject({ total_fee_idr: fee, previous_total_fee_idr: 0, jobs_count: 1 });
    expect(await summary(world.users.agencyB, 7)).toMatchObject({ total_fee_idr: 0, previous_total_fee_idr: fee });
    expect(await summary(world.users.agencyB, 30)).toMatchObject({ total_fee_idr: fee, previous_total_fee_idr: 0 });
  });

  it("refuses any other period, and anyone but an agency", async () => {
    for (const days of [null, 14]) {
      expect((await world.users.agencyA.client.rpc("agency_summary", { p_days: days })).error?.message).toBe("invalid_days");
    }
    for (const user of [world.users.customer, world.users.cleanerA, world.users.admin, ownerUser()]) {
      expect((await user.client.rpc("agency_summary", { p_days: 30 })).error?.message, user.email).toBe("not_agency");
    }
  });
});

describe("the partner list's last 30 days", { timeout: 30_000 }, () => {
  type Row = { agency_id: string; completed_30d: number; on_time_percent: number | null; cancelled_30d: number; paid_out_30d_idr: number };
  const rows = async () => {
    const { data, error } = await ownerUser().client.rpc("owner_agencies");
    expect(error).toBeNull();
    return data as Row[];
  };

  it("counts completed jobs, the share checked in on time, cancelled orders and the fees", async () => {
    const list = await rows();
    const pick = ({ completed_30d, on_time_percent, cancelled_30d, paid_out_30d_idr }: Row) => ({ completed_30d, on_time_percent, cancelled_30d, paid_out_30d_idr });
    const of = (agency: string) => {
      const row = list.find((item) => item.agency_id === agency);
      if (!row) throw new Error(`No row for ${agency}`);
      return pick(row);
    };
    expect(of(world.agencies.A)).toEqual({ completed_30d: 2, on_time_percent: 50, cancelled_30d: 1, paid_out_30d_idr: fee });
    expect(of(world.agencies.B)).toEqual({ completed_30d: 1, on_time_percent: 100, cancelled_30d: 0, paid_out_30d_idr: fee });
    expect(of(quietAgency)).toEqual({ completed_30d: 0, on_time_percent: null, cancelled_30d: 0, paid_out_30d_idr: 0 });
  });
});

describe("the admins' last sign-in", { timeout: 30_000 }, () => {
  it("is the time the admin last signed in, or null for one who never has", async () => {
    const { data, error } = await ownerUser().client.rpc("owner_admins");
    expect(error).toBeNull();
    const admins = data as { user_id: string; last_sign_in_at: string | null }[];
    const signedIn = admins.find((row) => row.user_id === world.users.admin.id);
    expect(signedIn?.last_sign_in_at).not.toBeNull();
    expect(Date.now() - new Date(signedIn?.last_sign_in_at ?? 0).getTime()).toBeLessThan(hours(1));
    expect(admins.find((row) => row.user_id === neverSignedIn)?.last_sign_in_at).toBeNull();
  });
});
