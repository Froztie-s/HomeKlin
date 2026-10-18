import type { Metadata } from "next";
import { CirclePlay } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Rekaman",
  emptyTitle: "Belum ada rekaman",
  emptyBody:
    "Rekaman pekerjaan petugas Anda muncul di sini selama 7 hari setelah pekerjaan selesai, lalu dihapus otomatis.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function AgencyRecordingsPage() {
  return (
    <>
      <PageHeader title={copy.title} />
      <EmptyState icon={CirclePlay} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </>
  );
}
