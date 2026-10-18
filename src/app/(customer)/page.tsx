import { ChevronRight, Info } from "lucide-react";
import Link from "next/link";
import { AgencyCard } from "@/components/customer/agency-card";
import { HomeHeader } from "@/components/customer/home-header";
import {
  previewAgencies,
  previewArea,
  previewJob,
  serviceAreas,
} from "@/components/customer/home-preview-data";
import { JobStatusCard } from "@/components/customer/job-status-card";
import { ServiceCategories } from "@/components/customer/service-categories";

const copy = {
  agencies: (area: string) => `Agensi di ${area}`,
  seeAll: "Lihat semua",
  seeAllContext: "agensi",
  previewNote: "Pratinjau tampilan: agensi dan pesanan di halaman ini adalah data contoh.",
};

// Customer home. Static design preview until T7-T8 connect the catalog and the customer's orders.
export default function HomePage() {
  return (
    <>
      <div className="md:mx-auto md:w-full md:max-w-content md:px-gutter-wide md:pt-6">
        <HomeHeader areas={serviceAreas} selectedArea={previewArea.id} />
      </div>

      <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-safe pt-5 md:px-gutter-wide md:pt-8">
        <JobStatusCard job={previewJob} />
        <ServiceCategories />

        <section aria-labelledby="agencies-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="agencies-title" className="text-lg font-semibold text-ink">
              {copy.agencies(previewArea.label)}
            </h2>
            <Link
              href="/agencies"
              className="-mr-2 inline-flex min-h-touch shrink-0 items-center gap-0.5 rounded-md px-2 text-sm font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:bg-brand-50 hover:text-brand-800 active:bg-brand-100"
            >
              {copy.seeAll}
              <span className="sr-only"> {copy.seeAllContext}</span>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {previewAgencies.map((agency) => (
              <AgencyCard key={agency.id} agency={agency} />
            ))}
          </div>
        </section>

        <p className="flex items-start gap-2 text-xs text-ink-faint">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          {copy.previewNote}
        </p>
      </div>
    </>
  );
}
