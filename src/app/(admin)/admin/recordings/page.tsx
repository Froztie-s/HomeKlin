import type { Metadata } from "next";
import { CirclePlay } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Rekaman",
  emptyTitle: "Belum ada rekaman",
  emptyBody:
    "Rekaman semua pekerjaan yang masih dalam masa simpan 7 hari muncul di sini.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function AdminRecordingsPage() {
  return (
    <>
      <PageHeader title={copy.title} />
      <EmptyState icon={CirclePlay} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </>
  );
}
