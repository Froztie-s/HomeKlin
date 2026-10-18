import type { Metadata } from "next";
import { Store } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Agensi",
  emptyTitle: "Daftar agensi muncul di sini",
  emptyBody:
    "Anda dapat mencari agensi menurut area dan jenis layanan, lalu membandingkan rating, harga, dan jadwal yang masih tersedia.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function AgenciesPage() {
  return (
    <PageContainer>
      <PageHeader title={copy.title} />
      <EmptyState icon={Store} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </PageContainer>
  );
}
