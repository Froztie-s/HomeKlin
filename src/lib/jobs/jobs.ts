import type { SupabaseClient } from "@supabase/supabase-js";

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

export type AgencyJob = BackOfficeJob & { address: string; contactPhone: string | null };
export type AdminJob = BackOfficeJob & { agencyName: string };

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
  type Row = BackOfficeRow & { address: string; contact_phone: string | null };
  return (await read<Row>(client, "agency_jobs")).map((row) => ({
    ...backOfficeJob(row),
    address: row.address,
    contactPhone: row.contact_phone,
  }));
}

/** Every paid job, for admin, latest first. */
export async function listAdminJobs(client: SupabaseClient): Promise<AdminJob[]> {
  type Row = BackOfficeRow & { agency_name: string };
  return (await read<Row>(client, "admin_jobs")).map((row) => ({ ...backOfficeJob(row), agencyName: row.agency_name }));
}

export type AgencyCleaner = { id: string; fullName: string; photoUrl: string | null };

/** The signed-in agency's own cleaners, by name. */
export async function listAgencyCleaners(client: SupabaseClient): Promise<AgencyCleaner[]> {
  type Row = { cleaner_id: string; full_name: string; photo_url: string | null };
  return (await read<Row>(client, "agency_cleaners")).map((row) => ({ id: row.cleaner_id, fullName: row.full_name, photoUrl: row.photo_url }));
}

/** Where a job stands, for every role's status line. */
export type JobProgress = "unassigned" | "assigned" | "inProgress" | "completed";

export function jobProgress(job: { cleanerName: string | null; checkedInAt: string | null; completedAt: string | null }): JobProgress {
  if (job.completedAt) return "completed";
  if (job.checkedInAt) return "inProgress";
  return job.cleanerName ? "assigned" : "unassigned";
}
