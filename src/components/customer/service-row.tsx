import { CalendarClock, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatRupiah } from "@/lib/format";
import type { PreviewService } from "./home-preview-data";

// One HomeKlin service as a list row on /home: the same facts in the same place on every row.
// Phones stack the price under the name; from tablet width it moves to the right.
export function ServiceRow({ service }: { service: PreviewService }) {
  const t = useTranslations("Service");
  const preview = useTranslations("PreviewData");
  const locale = useLocale();
  const { photo } = service;
  return (
    <Link
      href="/services"
      className="group flex items-center gap-3 px-4 py-3 -outline-offset-2 transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50 md:gap-4 md:px-5"
    >
      <Image
        src={photo.src}
        width={photo.width}
        height={photo.height}
        alt={preview(`services.${service.id}.photoAlt`)}
        sizes="64px"
        className="size-14 shrink-0 rounded-md bg-surface-sunken object-cover md:size-16"
      />
      <div className="grid min-w-0 flex-1 gap-0.5 md:grid-cols-[1fr_auto] md:items-center md:gap-x-6">
        <h3 className="text-base font-semibold text-ink">{preview(`services.${service.id}.name`)}</h3>
        <p className="flex flex-wrap items-baseline gap-x-1 text-sm text-ink-muted md:col-start-2 md:row-span-2 md:row-start-1 md:flex-col md:items-end">
          {t("from")}
          <span className="font-semibold text-ink tabular-nums md:text-base">
            {formatRupiah(service.startingPrice, locale)}
          </span>
        </p>
        <p className="flex items-start gap-1.5 text-sm text-ink-faint">
          <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {t.rich("nextSlot", {
              slot: preview(`services.${service.id}.nextSlot`),
              nowrap: (chunks) => <span className="whitespace-nowrap">{chunks}</span>,
            })}
          </span>
        </p>
      </div>
      <ChevronRight
        className="size-5 shrink-0 text-ink-faint transition-colors duration-150 group-hover:text-ink-muted"
        aria-hidden="true"
      />
    </Link>
  );
}
