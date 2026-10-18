import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Pesanan",
  emptyTitle: "Belum ada pesanan",
  emptyBody:
    "Pesanan yang sudah dibayar muncul di sini. Dari halaman ini Anda menugaskan petugas untuk setiap pesanan.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function AgencyOrdersPage() {
  return (
    <>
      <PageHeader title={copy.title} />
      <EmptyState icon={ClipboardList} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </>
  );
}
