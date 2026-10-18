import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Jadwal",
  emptyTitle: "Belum ada ketersediaan",
  emptyBody:
    "Ketersediaan agensi Anda per area muncul di sini. Pelanggan hanya ditawari slot yang masih kosong.",
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
