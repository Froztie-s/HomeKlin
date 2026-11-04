"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { attachRecording, RecordingError } from "@/lib/recordings/attach";
import { retentionDaysFromEnv } from "@/lib/recordings/retention";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// The cleaner's check-in and check-out (T18) and the agency's assignment of a cleaner (T28). Each is
// a public POST endpoint, so each checks the role, parses its input with Zod and leaves every rule to
// the database function it calls with the caller's own session (supabase/migrations/
// 20261104090000_jobs.sql): it is the cleaner's own job, the time is inside the check-in window, the
// cleaner belongs to the agency. Check-out then attaches the job's recording with the server's own
// client, the one seam for recordings (src/lib/recordings/attach.ts). Refusals come back as message keys.

export type JobFailureKey =
  | "notAllowed"
  | "notFound"
  | "tooEarly"
  | "tooLate"
  | "alreadyCheckedIn"
  | "notCheckedIn"
  | "completed"
  | "locationInvalid"
  | "cleanerNotFound"
  | "started"
  | "unavailable";

export type JobActionState = { ok?: true; formError?: JobFailureKey; recordingMissing?: true } | null;

const refusals: Record<string, JobFailureKey> = {
  job_not_found: "notFound",
  too_early: "tooEarly",
  too_late: "tooLate",
  already_checked_in: "alreadyCheckedIn",
  not_checked_in: "notCheckedIn",
  job_completed: "completed",
  location_invalid: "locationInvalid",
  cleaner_not_found: "cleanerNotFound",
  job_started: "started",
  not_cleaner: "notAllowed",
  not_agency: "notAllowed",
};

function failure(error: { message: string }): JobActionState {
  return { formError: refusals[error.message] ?? "unavailable" };
}

const coordinate = (min: number, max: number) => z.coerce.number().min(min).max(max);

const checkInInput = z.object({
  orderId: z.uuid(),
  lat: coordinate(-90, 90),
  lng: coordinate(-180, 180),
  accuracy: z.coerce.number().min(0).max(100_000).optional(),
});

const orderInput = z.object({ orderId: z.uuid() });
const assignInput = z.object({ orderId: z.uuid(), cleanerId: z.uuid() });

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return value === null || value === "" ? undefined : value;
};

export async function checkIn(_previous: JobActionState, formData: FormData): Promise<JobActionState> {
  if (!(await authorize(["cleaner"]))) return { formError: "notAllowed" };
  const parsed = checkInInput.safeParse({
    orderId: field(formData, "orderId"),
    lat: field(formData, "lat"),
    lng: field(formData, "lng"),
    accuracy: field(formData, "accuracy"),
  });
  if (!parsed.success) {
    return { formError: parsed.error.issues.some((issue) => issue.path[0] === "orderId") ? "notFound" : "locationInvalid" };
  }

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.rpc("check_in", {
    p_order: parsed.data.orderId,
    p_lat: parsed.data.lat,
    p_lng: parsed.data.lng,
    p_accuracy: parsed.data.accuracy ?? null,
  });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

export async function checkOut(_previous: JobActionState, formData: FormData): Promise<JobActionState> {
  if (!(await authorize(["cleaner"]))) return { formError: "notAllowed" };
  const parsed = orderInput.safeParse({ orderId: field(formData, "orderId") });
  if (!parsed.success) return { formError: "notFound" };

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.rpc("check_out", { p_order: parsed.data.orderId });
  if (error) return failure(error);

  // The job is complete whatever happens next; a missing recording is logged and shown, not hidden.
  try {
    await attachRecording(createSupabaseServiceClient(), parsed.data.orderId, { retentionDays: retentionDaysFromEnv() });
  } catch (cause) {
    console.error(
      "[jobs] %s completed without a recording (%s):",
      parsed.data.orderId,
      cause instanceof RecordingError ? (cause.reason ?? "error") : "error",
      cause,
    );
    refresh();
    return { ok: true, recordingMissing: true };
  }
  refresh();
  return { ok: true };
}

export async function assignCleaner(_previous: JobActionState, formData: FormData): Promise<JobActionState> {
  if (!(await authorize(["agency"]))) return { formError: "notAllowed" };
  const parsed = assignInput.safeParse({ orderId: field(formData, "orderId"), cleanerId: field(formData, "cleanerId") });
  if (!parsed.success) return { formError: parsed.error.issues.some((issue) => issue.path[0] === "cleanerId") ? "cleanerNotFound" : "notFound" };

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.rpc("assign_cleaner", { p_order: parsed.data.orderId, p_cleaner: parsed.data.cleanerId });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}
