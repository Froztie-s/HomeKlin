import { ArrowRight, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { AreaPicker } from "@/components/customer/area-picker";
import { previewJob } from "@/components/customer/home-preview-data";
import { JobStatusCard } from "@/components/customer/job-status-card";
import { ServiceRow } from "@/components/customer/service-row";
import { SampleNote } from "@/components/ui/sample-note";
import { getPathname, Link } from "@/i18n/navigation";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import { defaultAreaId } from "@/lib/catalog/customer-filters";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("HomePage");
  return { title: t("metaTitle") };
}

// The customer app home: where (area), what is happening now (the running job), then what to book.
// The services, prices and areas are HomeKlin's real catalog, cached and prerendered with the page
// (src/lib/catalog/cached.ts); the running job stays a labelled sample until T12 brings the customer's
// real orders. The brand sits in the app bar (src/components/shell/app-header.tsx) on every width.
export default function HomePage() {
  const t = useTranslations("HomePage");
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-safe pt-6 md:px-gutter-wide md:pt-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
        <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl md:tracking-display">
          {t("title")}
        </h1>
        <HomeAreaForm />
      </header>

      <div className="flex flex-col gap-3">
        <JobStatusCard job={previewJob} />
        <SampleNote>{t("previewNote")}</SampleNote>
      </div>

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
        <HomeServices />
      </section>
    </div>
  );
}

// Choosing an area leads to /services?area=..., where that area's free slots and services are. A
// button sends it (choosing in the list alone never leaves the page); next/form makes it a client-side
// navigation, and without JavaScript it is a plain GET form.
async function HomeAreaForm() {
  const [areas, locale, t] = await Promise.all([getServiceAreas(), getLocale(), getTranslations("HomePage")]);
  return (
    <Form action={getPathname({ href: "/services", locale })} className="flex flex-wrap items-center gap-x-3 gap-y-3">
      <AreaPicker areas={areas} value={defaultAreaId} />
      <button
        type="submit"
        className="inline-flex min-h-touch items-center gap-2 rounded-full border border-border-control bg-surface px-5 text-sm font-semibold text-ink transition-[background-color,border-color,transform] duration-150 ease-out-quart hover:border-brand-600 hover:bg-brand-50 active:scale-[0.98] active:bg-brand-100"
      >
        {t("areaSubmit")}
        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      </button>
    </Form>
  );
}

async function HomeServices() {
  const services = await getCatalogServices();
  return (
    <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {services.map((service) => (
        <li key={service.id}>
          <ServiceRow service={service} />
        </li>
      ))}
    </ul>
  );
}
