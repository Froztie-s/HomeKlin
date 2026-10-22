import { CalendarClock, Clock } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { formatRupiah } from "@/lib/format";
import type { PreviewService } from "./home-preview-data";

// One HomeKlin service on /services: photo header, what it covers, how long it takes, the next free
// slot and the starting price. No booking button until booking exists (T9), so no dead ends.
export function ServiceCard({ service }: { service: PreviewService }) {
  const t = useTranslations("Service");
  const preview = useTranslations("PreviewData");
  const locale = useLocale();
  const { photo } = service;
  return (
    <article className="@container flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <Image
        src={photo.src}
        width={photo.width}
        height={photo.height}
        alt={preview(`services.${service.id}.photoAlt`)}
        sizes="(min-width: 960px) 460px, (min-width: 768px) 50vw, 100vw"
        style={{ objectPosition: photo.focus }}
        className="aspect-video w-full bg-surface-sunken object-cover"
      />
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg font-semibold text-ink">{preview(`services.${service.id}.name`)}</h2>
        <p className="mt-1 text-sm text-ink-muted">{preview(`services.${service.id}.description`)}</p>
        {/* A narrow card stacks the price under the facts; from a 384 px card they share one row. */}
        <div className="mt-auto flex flex-col gap-3 pt-5 @sm:flex-row @sm:items-end @sm:justify-between @sm:gap-4">
          <div className="flex flex-col gap-1.5 text-sm text-ink-muted">
            <p className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
              {t("duration", { hours: service.hours })}
            </p>
            <p className="flex items-start gap-2">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
              <span>
                {t.rich("nextSlot", {
                  slot: preview(`services.${service.id}.nextSlot`),
                  nowrap: (chunks) => <span className="whitespace-nowrap">{chunks}</span>,
                })}
              </span>
            </p>
          </div>
          <p className="flex flex-col @sm:items-end">
            <span className="text-sm text-ink-muted">{t("from")}</span>
            <span className="font-display text-2xl font-semibold text-ink tabular-nums">
              {formatRupiah(service.startingPrice, locale)}
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}
