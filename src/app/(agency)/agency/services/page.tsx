import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Layanan",
  emptyTitle: "Belum ada layanan",
  emptyBody:
    "Layanan dan harga agensi Anda muncul di sini. Pelanggan melihat harga ini apa adanya, tanpa biaya tambahan.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function AgencyServicesPage() {
  return (
    <>
      <PageHeader title={copy.title} />
      <EmptyState icon={Tags} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </>
  );
}
