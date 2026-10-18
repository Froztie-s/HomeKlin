import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Dasbor",
  emptyTitle: "Ringkasan agensi muncul di sini",
  emptyBody:
    "Pesanan baru, jadwal petugas hari ini, dan pekerjaan yang sedang berlangsung tampil di halaman ini.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function AgencyDashboardPage() {
  return (
    <>
      <PageHeader title={copy.title} />
      <EmptyState icon={LayoutDashboard} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </>
  );
}
