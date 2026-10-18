import type { Metadata } from "next";
import { UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Petugas",
  emptyTitle: "Belum ada petugas",
  emptyBody:
    "Petugas agensi Anda muncul di sini, beserta status check-in mereka pada pekerjaan hari ini.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function AgencyCleanersPage() {
  return (
    <>
      <PageHeader title={copy.title} />
      <EmptyState icon={UsersRound} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </>
  );
}
