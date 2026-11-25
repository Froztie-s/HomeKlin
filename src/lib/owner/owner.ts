import type { SupabaseClient } from "@supabase/supabase-js";
import type { ValidDays } from "@/lib/payouts/schemas";

// The owner dashboard's reads (T29b, T29c), through supabase/migrations/20261104160100_owner.sql, which
// answers only the owner role. Pass the owner's session client (createSupabaseServerClient), behind
// <Suspense>. None of it carries customer personal data.

export class OwnerError extends Error {
  constructor(cause: { message: string }) {
    super(`Could not read the owner's data: ${cause.message}`);
    this.name = "OwnerError";
  }
}

export type OrderStatusCounts = { pending_payment: number; paid: number; failed: number; cancelled: number };

/** Totals for one period (B5): paid out is the agency fees of jobs completed in it; HomeKlin keeps the rest. */
export type PeriodTotals = { revenueIdr: number; paidOrders: number; avgOrderIdr: number; paidOutIdr: number; homeklinIdr: number };

export type BusinessNumbers = {
  /** All time from here to `agencies`. */
  revenueIdr: number;
  paidOrders: number;
  completedJobs: number;
  byStatus: OrderStatusCounts;
  /** The last 30 days, oldest first (Jakarta dates, YYYY-MM-DD). */
  trend: { date: string; orders: number; revenueIdr: number }[];
  agencies: { id: string; name: string; status: "active" | "suspended"; jobs: number; completed: number; revenueIdr: number }[];
  /** The chosen period: the last 7, 30 or 90 days, and the same number of days before it. */
  days: ValidDays;
  period: PeriodTotals;
  previous: PeriodTotals;
  /** Revenue per Jakarta day for the last 14 days, oldest first (YYYY-MM-DD). */
  daily: { date: string; revenueIdr: number }[];
  /** Agency fees per agency in the period, largest first; agencies that earned nothing are left out. */
  payoutsByAgency: { id: string; name: string; paidOutIdr: number }[];
  /**
   * Revenue per Jakarta day over the whole chosen period, oldest first (2026-11-20). Before
   * 20261120100000_owner_numbers_period.sql is applied the database has no such key: then `daily`.
   */
  dailyPeriod: { date: string; revenueIdr: number }[];
  /** The orders made in the chosen period, by status (2026-11-20); all time (`byStatus`) before the migration. */
  byStatusPeriod: OrderStatusCounts;
};

type TotalsRow = { revenue_idr: number; paid_orders: number; avg_order_idr: number; paid_out_idr: number; homeklin_idr: number };

const totals = (row: TotalsRow): PeriodTotals => ({
  revenueIdr: Number(row.revenue_idr),
  paidOrders: Number(row.paid_orders),
  avgOrderIdr: Number(row.avg_order_idr),
  paidOutIdr: Number(row.paid_out_idr),
  homeklinIdr: Number(row.homeklin_idr),
});

type NumbersRow = {
  revenue_idr: number;
  paid_orders: number;
  completed_jobs: number;
  by_status: OrderStatusCounts;
  trend: { date: string; orders: number; revenue_idr: number }[];
  agencies: { agency_id: string; name: string; status: "active" | "suspended"; jobs: number; completed: number; revenue_idr: number }[];
  days: ValidDays;
  period: TotalsRow;
  previous: TotalsRow;
  daily: { date: string; revenue_idr: number }[];
  payouts_by_agency: { agency_id: string; name: string; paid_out_idr: number }[];
  daily_period?: { date: string; revenue_idr: number }[];
  by_status_period?: OrderStatusCounts;
};

const dailyFrom = (rows: { date: string; revenue_idr: number }[]) =>
  rows.map((day) => ({ date: day.date.slice(0, 10), revenueIdr: Number(day.revenue_idr) }));

export async function getBusinessNumbers(client: SupabaseClient, days: ValidDays = 30): Promise<BusinessNumbers> {
  const { data, error } = await client.rpc("owner_numbers", { p_days: days });
  if (error) throw new OwnerError(error);
  const row = data as NumbersRow;
  return {
    revenueIdr: Number(row.revenue_idr),
    paidOrders: Number(row.paid_orders),
    completedJobs: Number(row.completed_jobs),
    byStatus: row.by_status,
    trend: row.trend.map((day) => ({ date: day.date.slice(0, 10), orders: Number(day.orders), revenueIdr: Number(day.revenue_idr) })),
    agencies: row.agencies.map((agency) => ({
      id: agency.agency_id,
      name: agency.name,
      status: agency.status,
      jobs: Number(agency.jobs),
      completed: Number(agency.completed),
      revenueIdr: Number(agency.revenue_idr),
    })),
    days: row.days,
    period: totals(row.period),
    previous: totals(row.previous),
    daily: dailyFrom(row.daily),
    dailyPeriod: dailyFrom(row.daily_period ?? row.daily),
    byStatusPeriod: row.by_status_period ?? row.by_status,
    payoutsByAgency: row.payouts_by_agency.map((agency) => ({ id: agency.agency_id, name: agency.name, paidOutIdr: Number(agency.paid_out_idr) })),
  };
}

export type OwnerAgency = {
  id: string;
  key: string;
  name: string;
  status: "active" | "suspended";
  areaIds: string[];
  cleaners: number;
  jobs: number;
  revenueIdr: number;
  hasSignIn: boolean;
  createdAt: string;
  /** The last 30 days: completed jobs, the share checked in by the start time (null without jobs), cancelled orders, fees. */
  completed30d: number;
  onTimePercent: number | null;
  cancelled30d: number;
  paidOut30dIdr: number;
};

export async function listOwnerAgencies(client: SupabaseClient): Promise<OwnerAgency[]> {
  const { data, error } = await client.rpc("owner_agencies");
  if (error) throw new OwnerError(error);
  type Row = {
    agency_id: string; key: string; name: string; status: "active" | "suspended"; area_ids: string[];
    cleaners: number; jobs: number; revenue_idr: number; has_sign_in: boolean; created_at: string;
    completed_30d: number; on_time_percent: number | null; cancelled_30d: number; paid_out_30d_idr: number;
  };
  return (data as Row[]).map((row) => ({
    id: row.agency_id,
    key: row.key,
    name: row.name,
    status: row.status,
    areaIds: row.area_ids,
    cleaners: Number(row.cleaners),
    jobs: Number(row.jobs),
    revenueIdr: Number(row.revenue_idr),
    hasSignIn: row.has_sign_in,
    createdAt: new Date(row.created_at).toISOString(),
    completed30d: Number(row.completed_30d),
    onTimePercent: row.on_time_percent === null ? null : Number(row.on_time_percent),
    cancelled30d: Number(row.cancelled_30d),
    paidOut30dIdr: Number(row.paid_out_30d_idr),
  }));
}

export type AdminAccount = { id: string; fullName: string; email: string; createdAt: string; lastSignInAt: string | null };

export async function listAdminAccounts(client: SupabaseClient): Promise<AdminAccount[]> {
  const { data, error } = await client.rpc("owner_admins");
  if (error) throw new OwnerError(error);
  type Row = { user_id: string; full_name: string; email: string; created_at: string; last_sign_in_at: string | null };
  return (data as Row[]).map((row) => ({
    id: row.user_id,
    fullName: row.full_name,
    email: row.email,
    createdAt: new Date(row.created_at).toISOString(),
    lastSignInAt: row.last_sign_in_at ? new Date(row.last_sign_in_at).toISOString() : null,
  }));
}
