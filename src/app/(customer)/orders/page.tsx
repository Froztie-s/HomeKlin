import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Pesanan",
  emptyTitle: "Belum ada pesanan",
  emptyBody:
    "Pesanan Anda muncul di sini dengan statusnya, dari dibayar sampai selesai. Saat petugas bekerja, Anda dapat menonton siaran langsung dari halaman ini.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function OrdersPage() {
  return (
    <PageContainer>
      <PageHeader title={copy.title} />
      <EmptyState icon={ClipboardList} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </PageContainer>
  );
}
