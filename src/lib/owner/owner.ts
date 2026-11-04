import type { SupabaseClient } from "@supabase/supabase-js";

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

export type BusinessNumbers = {
  revenueIdr: number;
  paidOrders: number;
  completedJobs: number;
  byStatus: OrderStatusCounts;
  /** The last 30 days, oldest first (Jakarta dates, YYYY-MM-DD). */
  trend: { date: string; orders: number; revenueIdr: number }[];
  agencies: { id: string; name: string; status: "active" | "suspended"; jobs: number; completed: number; revenueIdr: number }[];
};

type NumbersRow = {
  revenue_idr: number;
  paid_orders: number;
  completed_jobs: number;
  by_status: OrderStatusCounts;
  trend: { date: string; orders: number; revenue_idr: number }[];
  agencies: { agency_id: string; name: string; status: "active" | "suspended"; jobs: number; completed: number; revenue_idr: number }[];
};

export async function getBusinessNumbers(client: SupabaseClient): Promise<BusinessNumbers> {
  const { data, error } = await client.rpc("owner_numbers");
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
};

export async function listOwnerAgencies(client: SupabaseClient): Promise<OwnerAgency[]> {
  const { data, error } = await client.rpc("owner_agencies");
  if (error) throw new OwnerError(error);
  type Row = {
    agency_id: string; key: string; name: string; status: "active" | "suspended"; area_ids: string[];
    cleaners: number; jobs: number; revenue_idr: number; has_sign_in: boolean; created_at: string;
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
  }));
}

export type AdminAccount = { id: string; fullName: string; email: string; createdAt: string };

export async function listAdminAccounts(client: SupabaseClient): Promise<AdminAccount[]> {
  const { data, error } = await client.rpc("owner_admins");
  if (error) throw new OwnerError(error);
  type Row = { user_id: string; full_name: string; email: string; created_at: string };
  return (data as Row[]).map((row) => ({ id: row.user_id, fullName: row.full_name, email: row.email, createdAt: new Date(row.created_at).toISOString() }));
}
