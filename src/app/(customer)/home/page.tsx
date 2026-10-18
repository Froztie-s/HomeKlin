import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
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

const copy = {
  pageTitle: "Beranda",
  title: "Pesan kebersihan rumah",
  services: "Layanan HomeKlin",
  seeAll: "Semua layanan",
  previewNote: "Pratinjau tampilan: layanan, harga, jadwal, dan pesanan di halaman ini adalah data contoh.",
};

export const metadata: Metadata = { title: copy.pageTitle };

// The customer app home: where (area), what is happening now (the running job), then what to book.
// Static design preview until T7-T8 connect the catalog and T12 the customer's real orders.
export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-safe pt-4 md:px-gutter-wide md:pt-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="flex flex-col gap-5">
          {/* Phones have no top bar, so the brand sits here; from tablet width the top bar shows it. */}
          <div className="md:hidden">
            <Wordmark />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl md:tracking-display">
            {copy.title}
          </h1>
        </div>
        <AreaPicker areas={serviceAreas} defaultArea={defaultArea.id} />
      </header>

      <JobStatusCard job={previewJob} />

      <section aria-labelledby="home-services-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="home-services-title" className="font-display text-xl font-semibold text-ink">
            {copy.services}
          </h2>
          <Link
            href="/services"
            className="-mr-3 inline-flex min-h-touch shrink-0 items-center gap-0.5 rounded-full px-3 text-sm font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:bg-brand-50 hover:text-brand-800 active:bg-brand-100"
          >
            {copy.seeAll}
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

      <SampleNote>{copy.previewNote}</SampleNote>
    </div>
  );
}
