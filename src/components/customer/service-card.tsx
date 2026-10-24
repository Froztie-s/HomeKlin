import { Clock } from "lucide-react";
import { useLocale } from "next-intl";
import type { Service } from "@/lib/catalog/catalog";
import { formatRupiah } from "@/lib/format";
import { ServiceDuration } from "./service-duration";
import { ServiceVisual } from "./service-visual";

// One HomeKlin service on /services: what it covers, how long it takes and its one full price (no
// "from": the price is the whole price, with no fees on top). The facts sit in the same place on
// every card. A narrow card (a phone) puts a small picture beside the name, so the list stays easy to
// scan; from a 384 px card the photo moves on top. No booking button until booking exists (T9), so
// there is no dead end. Free slots are the same for every service (any service fits any arrival
// window), so the page shows them once for the area instead of on each card.
export function ServiceCard({ service }: { service: Service }) {
  const locale = useLocale();
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
          <h3 className="text-base font-semibold text-ink @sm:text-lg">{service.name[locale]}</h3>
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
    </article>
  );
}
