import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Pekerjaan hari ini",
  emptyTitle: "Belum ada pekerjaan hari ini",
  emptyBody:
    "Pekerjaan yang ditugaskan agensi Anda muncul di sini, lengkap dengan alamat dan jam kerja. Saat tiba di lokasi, Anda check-in dari halaman ini.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function CleanerJobsPage() {
  return (
    <PageContainer>
      <PageHeader title={copy.title} />
      <EmptyState icon={ClipboardCheck} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </PageContainer>
  );
}
