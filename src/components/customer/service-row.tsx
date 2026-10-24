import { ChevronRight, Clock } from "lucide-react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Service } from "@/lib/catalog/catalog";
import { formatRupiah } from "@/lib/format";
import { ServiceDuration } from "./service-duration";
import { ServiceVisual } from "./service-visual";

// One HomeKlin service as a list row on /home: the same facts in the same place on every row, and its
// one full price. Phones stack the price under the name; from tablet width it moves to the right.
// The row leads to /services, where the free slots of the customer's area are.
export function ServiceRow({ service }: { service: Service }) {
  const locale = useLocale();
  return (
    <Link
      href="/services"
      className="group flex items-center gap-3 px-4 py-3 -outline-offset-2 transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50 md:gap-4 md:px-5"
    >
      <ServiceVisual
        service={service}
        sizes="64px"
        className="size-14 shrink-0 rounded-md md:size-16"
        iconClassName="size-6"
      />
      <div className="grid min-w-0 flex-1 gap-0.5 md:grid-cols-[1fr_auto] md:items-center md:gap-x-6">
        <h3 className="text-base font-semibold text-ink">{service.name[locale]}</h3>
        <p className="font-semibold text-ink tabular-nums md:col-start-2 md:row-span-2 md:row-start-1 md:text-right md:text-base">
          {formatRupiah(service.priceIdr, locale)}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-ink-faint">
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          <ServiceDuration minutes={service.durationMinutes} />
        </p>
      </div>
      <ChevronRight
        className="size-5 shrink-0 text-ink-faint transition-colors duration-150 group-hover:text-ink-muted"
        aria-hidden="true"
      />
    </Link>
  );
}
