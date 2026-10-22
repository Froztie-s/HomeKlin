import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AreaPicker } from "@/components/customer/area-picker";
import {
  defaultArea,
  previewJob,
  previewServices,
  serviceAreas,
} from "@/components/customer/home-preview-data";
import { JobStatusCard } from "@/components/customer/job-status-card";
import { ServiceRow } from "@/components/customer/service-row";
import { SampleNote } from "@/components/ui/sample-note";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("HomePage");
  return { title: t("metaTitle") };
}

// The customer app home: where (area), what is happening now (the running job), then what to book.
// Static design preview until T7-T8 connect the catalog and T12 the customer's real orders.
// The brand sits in the app bar (src/components/shell/app-header.tsx) on every width.
export default function HomePage() {
  const t = useTranslations("HomePage");
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-safe pt-6 md:px-gutter-wide md:pt-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
        <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl md:tracking-display">
          {t("title")}
        </h1>
        <AreaPicker areas={serviceAreas} defaultArea={defaultArea} />
      </header>

      <JobStatusCard job={previewJob} />

      <section aria-labelledby="home-services-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="home-services-title" className="font-display text-xl font-semibold text-ink">
            {t("services")}
          </h2>
          <Link
            href="/services"
            className="-mr-3 inline-flex min-h-touch shrink-0 items-center gap-0.5 rounded-full px-3 text-sm font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:bg-brand-50 hover:text-brand-800 active:bg-brand-100"
          >
            {t("seeAll")}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {previewServices.map((service) => (
            <li key={service.id}>
              <ServiceRow service={service} />
            </li>
          ))}
        </ul>
      </section>

      <SampleNote>{t("previewNote")}</SampleNote>
    </div>
  );
}
