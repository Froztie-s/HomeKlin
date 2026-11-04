import type { SupabaseClient } from "@supabase/supabase-js";

// Ratings and reviews (T30), through supabase/migrations/20261104170000_reviews.sql. A service's rating
// and latest reviews are public and never name the customer or a partner agency; the customer's own
// reviews tell the order page which jobs are reviewed already.

export class ReviewsError extends Error {
  constructor(cause: { message: string }) {
    super(`Could not read the reviews: ${cause.message}`);
    this.name = "ReviewsError";
  }
}

export type ServiceReviews = {
  average: number | null;
  count: number;
  latest: { serviceRating: number; cleanerRating: number | null; comment: string; createdAt: string; cleanerFirstName: string | null }[];
};

export async function getServiceReviews(client: SupabaseClient, serviceId: string, limit = 5): Promise<ServiceReviews> {
  const { data, error } = await client.rpc("service_reviews", { p_service: serviceId, p_limit: limit });
  if (error) throw new ReviewsError(error);
  type Row = {
    average: number | string | null;
    count: number;
    latest: { service_rating: number; cleaner_rating: number | null; comment: string; created_at: string; cleaner_first_name: string | null }[];
  };
  const row = data as Row;
  return {
    average: row.average === null ? null : Number(row.average),
    count: Number(row.count),
    latest: row.latest.map((review) => ({
      serviceRating: review.service_rating,
      cleanerRating: review.cleaner_rating,
      comment: review.comment,
      createdAt: new Date(review.created_at).toISOString(),
      cleanerFirstName: review.cleaner_first_name || null,
    })),
  };
}

export type MyReview = { orderId: string; serviceRating: number; cleanerRating: number | null; comment: string; createdAt: string };

export async function listMyReviews(client: SupabaseClient): Promise<MyReview[]> {
  const { data, error } = await client.rpc("my_reviews");
  if (error) throw new ReviewsError(error);
  type Row = { order_id: string; service_rating: number; cleaner_rating: number | null; comment: string; created_at: string };
  return (data as Row[]).map((row) => ({
    orderId: row.order_id,
    serviceRating: row.service_rating,
    cleanerRating: row.cleaner_rating,
    comment: row.comment,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
