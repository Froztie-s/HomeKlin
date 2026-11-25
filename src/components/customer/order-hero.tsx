import { ArrowRight, Clock, Lock, MapPin, UserRound, Video } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { CustomerOrder } from "@/lib/booking/orders";
import { formatJakartaTime } from "@/lib/catalog/slots-days";
import { flowAccentButton } from "./flow-styles";
import { initialsOf } from "./job-progress";
import { liveInProgress } from "./live-status";

type OrderHeroProps = {
  /** The page's clock: a job hours past its window without a check-out is no longer live. */
  now: Date;
  order: Pick<CustomerOrder, "id" | "orderCode" | "status" | "cleanerName" | "cleanerPhotoUrl" | "checkedInAt" | "completedAt">;
  /** "Pembersihan Rutin" (or the fallback when the service left the catalog). */
  serviceName: string;
  /** "Kamis, 5 November, 09.00-11.00 WIB". */
  arrival: string;
  /**
   * Where "Tonton langsung" leads: the live view by default; the order-link page (B14a), whose visitor
   * may not be signed in, sends them to sign in first.
   */
  watchHref?: string;
};

// The top of a paid order's page (D5, mock Customer-Orders): a dark forest band with the Petugas
// HomeKlin by name and photo (initials without one), never with the agency they work for
// (markdown/PRODUCT.md principle 6; listMyOrders never returns it), where the job stands in words, and
// while it is in progress the one main action, "Tonton langsung" (/orders/live?order=<id>). The live
// pill pairs the dot with words, so the state never rests on colour alone.
export async function OrderHero({ order, serviceName, arrival, watchHref, now }: OrderHeroProps) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("OrderHero")]);
  const live = liveInProgress(order, now);
  const time = (iso: string) => formatJakartaTime(iso, locale);
  const headline = order.completedAt
    ? t("headlineDone", { time: time(order.completedAt) })
    : order.checkedInAt
      ? t("headlineCheckedIn", { time: time(order.checkedInAt) })
      : order.cleanerName
        ? t("headlineAssigned")
        : t("headlineUnassigned");

  return (
    <section
      aria-label={t("region")}
      className="on-dark-focus relative isolate overflow-hidden rounded-xl bg-primary-container p-6 text-on-primary md:p-10"
    >
      <span aria-hidden="true" className="absolute -right-24 -bottom-40 -z-10 size-96 rounded-full bg-primary" />
      <p className="text-eyebrow font-semibold text-lime uppercase">{t("eyebrow")}</p>
      <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-center md:gap-10">
        <div className="flex items-center gap-4">
          <Avatar name={order.cleanerName} photoUrl={order.cleanerPhotoUrl} alt={order.cleanerName ? t("photoAlt", { name: order.cleanerName }) : ""} />
          <p className="flex min-w-0 flex-col">
            <span className="font-display text-title font-semibold">{order.cleanerName ?? t("unassignedName")}</span>
            <span className="text-sm text-on-band-muted">{order.cleanerName ? t("role") : t("unassignedBody")}</span>
          </p>
        </div>
        {order.checkedInAt ? (
          <ul className="flex flex-col gap-1.5 text-sm">
            <li className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 text-lime" aria-hidden="true" />
              {t("checkedInFact", { time: time(order.checkedInAt) })}
            </li>
            {live ? (
              <li className="flex items-center gap-2">
                <Video className="size-4 shrink-0 text-lime" aria-hidden="true" />
                {t("liveFact")}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      <div className="mt-6 border-t border-on-primary/15 pt-6">
        {live ? (
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-band px-3 py-1.5 text-sm text-lime">
            <span className="size-2 rounded-full bg-mint-bright motion-safe:animate-breathe" aria-hidden="true" />
            {t("livePill")}
          </p>
        ) : null}
        {/* The page's title: what is happening with this order now. */}
        <h1 className="max-w-3xl font-display text-headline-sm font-semibold md:text-headline-md">{headline}</h1>
        <p className="mt-3 flex items-start gap-2 text-on-primary">
          <Clock className="mt-1 size-4 shrink-0" aria-hidden="true" />
          <span>{t("orderLine", { code: order.orderCode, service: serviceName, arrival })}</span>
        </p>
        <p className="mt-3 flex items-start gap-2 text-sm text-on-band-muted">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{t("privacy")}</span>
        </p>
        {live ? (
          <Link href={watchHref ?? `/orders/live?order=${order.id}`} className={`${flowAccentButton} mt-6`}>
            {t("watch")}
            <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function Avatar({ name, photoUrl, alt }: { name: string | null; photoUrl: string | null; alt: string }) {
  if (!name) {
    return (
      <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-lime-wash text-on-lime-wash md:size-18">
        <UserRound className="size-7" aria-hidden="true" />
      </span>
    );
  }
  if (!photoUrl) {
    return (
      <span
        aria-hidden="true"
        className="flex size-16 shrink-0 items-center justify-center rounded-full bg-lime-wash font-display text-title font-semibold text-on-lime-wash md:size-18"
      >
        {initialsOf(name)}
      </span>
    );
  }
  return (
    <Image
      src={photoUrl}
      width={144}
      height={144}
      alt={alt}
      sizes="72px"
      // The site's own photos (/images/...) are optimised; a photo elsewhere (https) is shown as it is.
      unoptimized={!photoUrl.startsWith("/")}
      className="size-16 shrink-0 rounded-full bg-lime-wash object-cover md:size-18"
    />
  );
}
