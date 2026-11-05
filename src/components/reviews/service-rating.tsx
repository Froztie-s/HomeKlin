import { ChevronDown, Star } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getServiceReviews, type ServiceReviews } from "@/lib/reviews/reviews";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { formatAverage } from "./rating";
import { Stars } from "./stars";

type ServiceRatingProps = {
  serviceId: string;
  /** The service's name in the page's language, for the list's name. */
  serviceName: string;
};

/** How many of the latest reviews a card shows. */
const latestCount = 3;

// A service's rating on its /services card (T30): one star, the average and how many reviews, and
// under "Lihat ulasan" the latest few, each with its stars, the comment, the date and the Petugas
// HomeKlin's first name. Never the customer's name and never who supplies the cleaner: service_reviews()
// returns neither. Read fresh with the cookie-free client, so a new review shows at once; a service
// without reviews, or a failed read, shows nothing rather than an empty or invented rating.
export async function ServiceRating({ serviceId, serviceName }: ServiceRatingProps) {
  let reviews: ServiceReviews;
  try {
    reviews = await getServiceReviews(createSupabasePublicClient(), serviceId, latestCount);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[reviews] could not read a service's reviews:", error);
    return null;
  }
  if (reviews.count === 0 || reviews.average === null) return null;

  const [t, locale] = await Promise.all([getTranslations("Reviews"), getLocale()]);
  const average = formatAverage(reviews.average, locale);
  const date = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

  return (
    <details className="group/reviews mt-2">
      <summary className="-mx-2 flex min-h-touch w-fit cursor-pointer list-none items-center gap-1.5 rounded-full px-2 text-sm transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50 [&::-webkit-details-marker]:hidden">
        <Star className="size-4 shrink-0 fill-rating text-rating" strokeWidth={1.75} aria-hidden="true" />
        <span className="sr-only">{t("summary.label", { average, count: reviews.count })}</span>
        <span aria-hidden="true" className="font-semibold text-ink tabular-nums">
          {average}
        </span>
        <span aria-hidden="true" className="text-ink-muted">
          {t("summary.count", { count: reviews.count })}
        </span>
        <span className="ml-1 font-semibold text-brand-700">{t("summary.show")}</span>
        <ChevronDown className="size-4 shrink-0 text-brand-700 transition-transform duration-150 group-open/reviews:rotate-180" aria-hidden="true" />
      </summary>
      <ul aria-label={t("summary.listLabel", { service: serviceName })} className="mt-2 flex flex-col divide-y divide-border rounded-md bg-surface-sunken px-3">
        {reviews.latest.map((review, index) => (
          <li key={`${review.createdAt}-${index}`} className="flex flex-col gap-1 py-3 text-sm">
            <p className="flex flex-wrap items-center gap-x-2">
              <Stars value={review.serviceRating} size="sm" />
              <span className="text-ink-muted">{t("stars", { count: review.serviceRating })}</span>
            </p>
            {review.comment ? <p className="text-base text-ink">{review.comment}</p> : null}
            <p className="text-ink-faint">
              {review.cleanerFirstName ? (
                <>
                  {t("summary.cleaner", { name: review.cleanerFirstName })} <span aria-hidden="true">·</span>{" "}
                </>
              ) : null}
              {date.format(new Date(review.createdAt))}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
