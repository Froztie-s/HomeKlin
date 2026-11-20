import type { SupabaseClient } from "@supabase/supabase-js";
import { checkOutOverdue } from "./overdue";

// What each role reads about jobs (T17, T24, T26, T28), through the database functions of
// supabase/migrations/20261104090000_jobs.sql, which check the role and return only what that role may
// see. Pass the signed-in user's session client (createSupabaseServerClient), behind <Suspense>.

export class JobsError extends Error {
  constructor(cause: { message: string }) {
    super(`Could not read the jobs: ${cause.message}`);
    this.name = "JobsError";
  }
}

const iso = (value: string) => new Date(value).toISOString();
const isoOrNull = (value: string | null) => (value ? iso(value) : null);

async function read<T>(client: SupabaseClient, fn: string): Promise<T[]> {
  const { data, error } = await client.rpc(fn);
  if (error) throw new JobsError(error);
  return (data ?? []) as T[];
}

/** One of the cleaner's own jobs: where, when, for whom, and how far it has got. */
export type CleanerJob = {
  id: string;
  serviceId: string;
  areaId: string;
  startsAt: string;
  endsAt: string;
  address: string;
  contactPhone: string | null;
  customerName: string | null;
  streamConsent: boolean;
  checkedInAt: string | null;
  completedAt: string | null;
  /** The short order number, "HK-1042" (20261114100000_order_code_everywhere.sql). */
  orderCode: string;
  /** The customer's note for the cleaner (B7); empty when there is none. */
  customerNote: string;
};

type CleanerJobRow = {
  order_id: string;
  service_id: string;
  area_id: string;
  starts_at: string;
  ends_at: string;
  address: string;
  contact_phone: string | null;
  customer_name: string | null;
  stream_consent: boolean;
  checked_in_at: string | null;
  completed_at: string | null;
  order_code: string;
  customer_note: string | null;
};

/** The cleaner's jobs for today and later, and those finished in the last day, earliest first. */
export async function listMyJobs(client: SupabaseClient): Promise<CleanerJob[]> {
  return (await read<CleanerJobRow>(client, "my_jobs")).map((row) => ({
    id: row.order_id,
    serviceId: row.service_id,
    areaId: row.area_id,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    address: row.address,
    contactPhone: row.contact_phone,
    customerName: row.customer_name,
    streamConsent: row.stream_consent,
    checkedInAt: isoOrNull(row.checked_in_at),
    completedAt: isoOrNull(row.completed_at),
    orderCode: row.order_code,
    customerNote: row.customer_note ?? "",
  }));
}

/** A job as the back office sees it: the agency its own, admin every one. */
export type BackOfficeJob = {
  id: string;
  serviceId: string;
  areaId: string;
  startsAt: string;
  endsAt: string;
  cleanerId: string | null;
  cleanerName: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  recordingId: string | null;
  recordingExpiresAt: string | null;
  recordingDeleted: boolean;
};

/**
 * orderCode: the short order number, "HK-1042" (20261114100000_order_code_everywhere.sql).
 * assignedAt: when the agency gave the job to the cleaner (B3); null before that and on older jobs.
 * agencyFeeIdr: the agency's fee (B4, 20261114120000_agency_fee_expected.sql): the real one once the
 * job is done (agencyFeeFinal true), before that the expected one at the agency's current percent.
 * customerNote: the customer's note for the cleaner (B7); empty when there is none.
 */
export type AgencyJob = BackOfficeJob & {
  address: string;
  contactPhone: string | null;
  orderCode: string;
  assignedAt: string | null;
  agencyFeeIdr: number;
  agencyFeeFinal: boolean;
  customerNote: string;
};
/** orderCode: the short order number, "HK-1042" (20261112100000_admin_jobs_code.sql). */
export type AdminJob = BackOfficeJob & { agencyName: string; orderCode: string };

type BackOfficeRow = {
  order_id: string;
  service_id: string;
  area_id: string;
  starts_at: string;
  ends_at: string;
  cleaner_id?: string | null;
  cleaner_name: string | null;
  checked_in_at: string | null;
  completed_at: string | null;
  recording_id: string | null;
  recording_expires_at: string | null;
  recording_deleted: boolean | null;
};

function backOfficeJob(row: BackOfficeRow): BackOfficeJob {
  return {
    id: row.order_id,
    serviceId: row.service_id,
    areaId: row.area_id,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    cleanerId: row.cleaner_id ?? null,
    cleanerName: row.cleaner_name,
    checkedInAt: isoOrNull(row.checked_in_at),
    completedAt: isoOrNull(row.completed_at),
    recordingId: row.recording_id,
    recordingExpiresAt: isoOrNull(row.recording_expires_at),
    recordingDeleted: row.recording_deleted === true,
  };
}

/** The paid jobs routed to the signed-in agency, latest first. */
export async function listAgencyJobs(client: SupabaseClient): Promise<AgencyJob[]> {
  type Row = BackOfficeRow & {
    address: string;
    contact_phone: string | null;
    order_code: string;
    assigned_at: string | null;
    agency_fee_idr: number;
    agency_fee_final: boolean;
    customer_note: string | null;
  };
  return (await read<Row>(client, "agency_jobs")).map((row) => ({
    ...backOfficeJob(row),
    address: row.address,
    contactPhone: row.contact_phone,
    orderCode: row.order_code,
    assignedAt: isoOrNull(row.assigned_at),
    agencyFeeIdr: Number(row.agency_fee_idr),
    agencyFeeFinal: row.agency_fee_final === true,
    customerNote: row.customer_note ?? "",
  }));
}

/** Every paid job, for admin, latest first. */
export async function listAdminJobs(client: SupabaseClient): Promise<AdminJob[]> {
  type Row = BackOfficeRow & { agency_name: string; order_code: string };
  return (await read<Row>(client, "admin_jobs")).map((row) => ({
    ...backOfficeJob(row),
    agencyName: row.agency_name,
    orderCode: row.order_code,
  }));
}

/**
 * A cleaner's account details. phone (+628...) and areaId (one of the agency's areas) are set by the
 * agency (B11, 20261114150000_full_windows_cleaner_details.sql); null until then.
 */
export type CleanerProfile = { id: string; fullName: string; photoUrl: string | null; phone: string | null; areaId: string | null };
export type AgencyCleaner = CleanerProfile;

type CleanerRow = { cleaner_id: string; full_name: string; photo_url: string | null; phone: string | null; area_id: string | null };

const cleanerProfile = (row: CleanerRow): CleanerProfile => ({
  id: row.cleaner_id,
  fullName: row.full_name,
  photoUrl: row.photo_url,
  phone: row.phone ?? null,
  areaId: row.area_id ?? null,
});

/** The signed-in agency's own cleaners, by name. */
export async function listAgencyCleaners(client: SupabaseClient): Promise<AgencyCleaner[]> {
  return (await read<CleanerRow>(client, "agency_cleaners")).map(cleanerProfile);
}

/** The signed-in cleaner's own details, or null when the account has no cleaner row. */
export async function getMyCleanerProfile(client: SupabaseClient): Promise<CleanerProfile | null> {
  const [row] = await read<CleanerRow>(client, "my_cleaner_profile");
  return row ? cleanerProfile(row) : null;
}

/** Where a job stands, for every role's status line. */
export type JobProgress = "unassigned" | "assigned" | "inProgress" | "overdue" | "completed";

/**
 * Where a job stands. Given `now` and the window's end, a job checked in to but not checked out hours
 * after its window is "overdue" ("Belum check-out", src/lib/jobs/overdue.ts, 2026-11-20), not under way.
 */
export function jobProgress(
  job: { cleanerName: string | null; checkedInAt: string | null; completedAt: string | null; endsAt?: string },
  now?: Date,
): JobProgress {
  if (job.completedAt) return "completed";
  if (job.checkedInAt) return now && job.endsAt && checkOutOverdue({ ...job, endsAt: job.endsAt }, now) ? "overdue" : "inProgress";
  return job.cleanerName ? "assigned" : "unassigned";
}

/**
 * The cleaner's home page numbers (B6, 20261114170000_cleaner_stats.sql), by Jakarta time: hours from
 * check-in to check-out this week (Monday on; a job in progress counts until now), jobs starting today,
 * and jobs completed this month.
 */
export type JobStats = { activeHoursWeek: number; jobsToday: number; completedMonth: number };

export async function getMyJobStats(client: SupabaseClient): Promise<JobStats> {
  type Row = { active_hours_week: number | string; jobs_today: number | string; completed_month: number | string };
  const [row] = await read<Row>(client, "my_job_stats");
  return {
    activeHoursWeek: Number(row?.active_hours_week ?? 0),
    jobsToday: Number(row?.jobs_today ?? 0),
    completedMonth: Number(row?.completed_month ?? 0),
  };
}
