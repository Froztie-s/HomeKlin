"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Reviewing a completed job (T30). A public POST endpoint: it checks the customer role and parses the
// ratings; submit_review() checks that it is the customer's own completed job and that it has no
// review yet (supabase/migrations/20261104170000_reviews.sql).

export type ReviewFailureKey = "notAllowed" | "notFound" | "exists" | "ratingInvalid" | "commentInvalid" | "unavailable";
export type ReviewActionState = { ok?: true; formError?: ReviewFailureKey } | null;

const refusals: Record<string, ReviewFailureKey> = {
  not_customer: "notAllowed",
  job_not_found: "notFound",
  review_exists: "exists",
  rating_invalid: "ratingInvalid",
  comment_invalid: "commentInvalid",
};

const rating = z.coerce.number().int().min(1).max(5);

const input = z.object({
  orderId: z.uuid(),
  serviceRating: rating,
  cleanerRating: rating.optional(),
  comment: z.string().trim().max(500),
});

export async function submitReview(_previous: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  if (!(await authorize(["customer"]))) return { formError: "notAllowed" };
  const value = (name: string) => {
    const entry = formData.get(name);
    return entry === null || entry === "" ? undefined : entry;
  };
  const parsed = input.safeParse({
    orderId: value("orderId"),
    serviceRating: value("serviceRating"),
    cleanerRating: value("cleanerRating"),
    comment: value("comment") ?? "",
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { formError: field === "orderId" ? "notFound" : field === "comment" ? "commentInvalid" : "ratingInvalid" };
  }
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.rpc("submit_review", {
    p_order: parsed.data.orderId,
    p_service_rating: parsed.data.serviceRating,
    p_cleaner_rating: parsed.data.cleanerRating ?? null,
    p_comment: parsed.data.comment,
  });
  if (error) return { formError: refusals[error.message] ?? "unavailable" };
  refresh();
  return { ok: true };
}
