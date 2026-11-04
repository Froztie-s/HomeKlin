"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The cleaner's stream controls (T22): start the stream of a job in progress, report its state, stop
// it. Public POST endpoints, so each checks the role and parses its input; the database checks it is
// the cleaner's own job in progress (supabase/migrations/20261104140000_streams.sql).

export type StreamFailureKey = "notAllowed" | "notFound" | "notCheckedIn" | "completed" | "consentMissing" | "unavailable";
export type StreamActionState = { ok?: true; formError?: StreamFailureKey } | null;

const refusals: Record<string, StreamFailureKey> = {
  not_cleaner: "notAllowed",
  job_not_found: "notFound",
  stream_not_found: "notFound",
  not_checked_in: "notCheckedIn",
  job_completed: "completed",
  consent_missing: "consentMissing",
};

const failure = (error: { message: string }): StreamActionState => ({ formError: refusals[error.message] ?? "unavailable" });

const input = z.object({
  orderId: z.uuid(),
  status: z.enum(["active", "weak", "disconnected", "ended"]).optional(),
});

function parse(formData: FormData) {
  return input.safeParse({ orderId: formData.get("orderId") ?? undefined, status: formData.get("status") ?? undefined });
}

export async function startStream(_previous: StreamActionState, formData: FormData): Promise<StreamActionState> {
  if (!(await authorize(["cleaner"]))) return { formError: "notAllowed" };
  const parsed = parse(formData);
  if (!parsed.success) return { formError: "notFound" };
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.rpc("start_stream", { p_order: parsed.data.orderId, p_source: "demo" });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

/** Reports the stream's state (active, weak, disconnected) or ends it. */
export async function setStreamStatus(_previous: StreamActionState, formData: FormData): Promise<StreamActionState> {
  if (!(await authorize(["cleaner"]))) return { formError: "notAllowed" };
  const parsed = parse(formData);
  if (!parsed.success || !parsed.data.status) return { formError: "notFound" };
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.rpc("set_stream_status", { p_order: parsed.data.orderId, p_status: parsed.data.status });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}
