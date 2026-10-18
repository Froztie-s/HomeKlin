import type { Metadata } from "next";
import { MonitorPlay } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Monitor Langsung",
  emptyTitle: "Tidak ada pekerjaan yang sedang berlangsung",
  emptyBody:
    "Siaran langsung semua pekerjaan yang sedang berlangsung muncul di sini dalam satu tampilan.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function AdminMonitorPage() {
  return (
    <>
      <PageHeader title={copy.title} />
      <EmptyState icon={MonitorPlay} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </>
  );
}
