import { ArrowRight, Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Service } from "@/lib/catalog/catalog";
import { formatRupiah } from "@/lib/format";
import { ServiceDuration } from "./service-duration";
import { ServiceVisual } from "./service-visual";

type ServiceCardProps = {
  service: Service;
  /**
   * Where "Pesan" leads: the order page for this service in the area's earliest free window
   * (orderHref in ./order-query.ts). Left out when the area has no free window, so the card never
   * offers a booking that cannot be made.
   */
  bookHref?: string;
};

// One HomeKlin service on /services: what it covers, how long it takes and its one full price (no
// "from": the price is the whole price, with no fees on top). The facts sit in the same place on
// every card. A narrow card (a phone) puts a small picture beside the name, so the list stays easy to
// scan; from a 384 px card the photo moves on top. "Pesan" opens the order page (T9b) in the earliest free
// window of the area, which the customer can change there (T9). Free slots are the same for every
// service (any service fits any arrival window), so the page shows them once for the area instead of
// on each card.
export function ServiceCard({ service, bookHref }: ServiceCardProps) {
  const locale = useLocale();
  const t = useTranslations("ServiceCard");
  const name = service.name[locale];
  return (
    <article className="@container flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="flex flex-1 gap-4 p-4 @sm:flex-col @sm:gap-0 @sm:p-0">
        <ServiceVisual
          service={service}
          sizes="(min-width: 768px) 440px, (min-width: 416px) 100vw, 80px"
          className="size-20 shrink-0 rounded-md @sm:aspect-video @sm:h-auto @sm:w-full @sm:rounded-none"
          iconClassName="size-7 @sm:size-10"
        />
        <div className="flex min-w-0 flex-col @sm:px-5 @sm:pt-5">
          <h3 className="text-base font-semibold text-ink @sm:text-lg">{name}</h3>
          <p className="mt-1 text-sm text-ink-muted">{service.description[locale]}</p>
        </div>
      </div>
      <div className="mx-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border py-3 @sm:mx-5 @sm:mt-4 @sm:py-4">
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Clock className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
          <ServiceDuration minutes={service.durationMinutes} />
        </p>
        <p className="ml-auto font-display text-xl font-semibold whitespace-nowrap text-ink tabular-nums @sm:text-2xl">
          {formatRupiah(service.priceIdr, locale)}
        </p>
      </div>
      {bookHref ? (
        <div className="px-4 pb-4 @sm:px-5 @sm:pb-5">
          {/* The visible word starts the accessible name, which adds the service (WCAG 2.5.3). */}
          <Link
            href={bookHref}
            aria-label={t("bookLabel", { service: name })}
            className="inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-semibold text-on-brand transition-[background-color,transform] duration-150 ease-out-quart hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800"
          >
            {t("book")}
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </article>
  );
}
