import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Layanan & Harga",
  emptyTitle: "Belum ada layanan",
  emptyBody:
    "Daftar layanan dan harga HomeKlin muncul di sini. Pelanggan melihat harga ini apa adanya, tanpa biaya tambahan.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until T7b builds the editor for HomeKlin's one price list; the empty state says what will appear.
export default function AdminServicesPage() {
  return (
    <>
      <PageHeader title={copy.title} />
      <EmptyState icon={Tags} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </>
  );
}
