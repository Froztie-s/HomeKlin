import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Jadwal",
  emptyTitle: "Belum ada slot jadwal",
  emptyBody:
    "Slot waktu yang dapat dipesan pelanggan muncul di sini. Slot yang sudah dipesan tidak dapat dipesan lagi.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function AgencySchedulePage() {
  return (
    <>
      <PageHeader title={copy.title} />
      <EmptyState icon={CalendarDays} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </>
  );
}
