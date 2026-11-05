import { CircleAlert, CircleCheck } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ClientMessages } from "@/i18n/client-messages";
import { listMyReviews, type MyReview } from "@/lib/reviews/reviews";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReviewForm } from "./review-form";
import { Stars } from "./stars";

type OrderReviewProps = {
  orderId: string;
  cleanerName: string | null;
};

// "Ulasan" on a finished job's details (T30), under the recording. The customer rates the job once:
// the form until they have, then the review they gave. Which jobs are reviewed is read with the
// customer's own session (my_reviews()), behind <Suspense>, so the rest of the order shows at once.
// Only HomeKlin's words: the service and the Petugas HomeKlin, never who supplies the cleaner.
export async function OrderReview({ orderId, cleanerName }: OrderReviewProps) {
  const t = await getTranslations("Reviews");
  return (
    <section aria-labelledby="review-title" className="flex flex-col gap-3 border-t border-border p-5 md:p-6">
      <h3 id="review-title" className="font-display text-lg font-semibold text-ink">
        {t("title")}
      </h3>
      <Suspense fallback={<div aria-hidden="true" className="h-32 animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none" />}>
        <ReviewContent orderId={orderId} cleanerName={cleanerName} />
      </Suspense>
    </section>
  );
}

async function ReviewContent({ orderId, cleanerName }: OrderReviewProps) {
  const t = await getTranslations("Reviews");
  let review: MyReview | undefined;
  try {
    const reviews = await listMyReviews(await createSupabaseServerClient({ writeCookies: false }));
    review = reviews.find((candidate) => candidate.orderId === orderId);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[reviews] could not read the customer's reviews:", error);
    return (
      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
        <span>{t("loadError")}</span>
      </p>
    );
  }

  if (!review) {
    return (
      <>
        <p className="text-sm text-ink-muted">{t("lead")}</p>
        <ClientMessages namespaces={["Reviews"]}>
          <ReviewForm orderId={orderId} cleanerName={cleanerName} />
        </ClientMessages>
      </>
    );
  }

  const locale = await getLocale();
  const sent = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const ratings = [
    { label: t("serviceGroup"), value: review.serviceRating },
    ...(review.cleanerRating ? [{ label: t("cleanerLabel"), value: review.cleanerRating }] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="flex items-start gap-2 rounded-md bg-success-surface px-4 py-3 text-sm font-medium text-success">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{t("given.thanks")}</span>
      </p>
      <ul className="flex flex-col gap-2">
        {ratings.map((rating) => (
          <li key={rating.label} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
            <span className="font-medium">{rating.label}:</span> <Stars value={rating.value} />{" "}
            <span className="tabular-nums">{t("stars", { count: rating.value })}</span>
          </li>
        ))}
      </ul>
      {review.comment ? (
        <blockquote className="rounded-md bg-surface-sunken px-4 py-3 text-base text-ink">{review.comment}</blockquote>
      ) : null}
      <p className="text-sm text-ink-faint">{t("given.date", { date: sent.format(new Date(review.createdAt)) })}</p>
    </div>
  );
}
