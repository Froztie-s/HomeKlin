import type { Metadata } from "next";
import { defaultArea, previewServices } from "@/components/customer/home-preview-data";
import { ServiceCard } from "@/components/customer/service-card";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { SampleNote } from "@/components/ui/sample-note";

const copy = {
  title: "Layanan",
  description: (area: string) => `Satu daftar harga dari HomeKlin. Jadwal terdekat untuk ${area}.`,
  previewNote: "Pratinjau tampilan: layanan, harga, dan jadwal di halaman ini adalah data contoh.",
};

export const metadata: Metadata = { title: copy.title };

// HomeKlin's services with the one price list. Static preview until T7 (catalog) and T8 (free slots).
export default function ServicesPage() {
  return (
    <PageContainer>
      <PageHeader title={copy.title} description={copy.description(defaultArea.label)} size="large" />
      <ul className="grid gap-4 md:grid-cols-2 md:gap-5">
        {previewServices.map((service) => (
          <li key={service.id}>
            <ServiceCard service={service} />
          </li>
        ))}
      </ul>
      <SampleNote>{copy.previewNote}</SampleNote>
    </PageContainer>
  );
}
