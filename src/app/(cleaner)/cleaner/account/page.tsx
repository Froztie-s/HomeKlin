import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Akun",
  emptyTitle: "Anda belum masuk",
  emptyBody:
    "Setelah masuk, data akun Anda dan agensi tempat Anda bekerja muncul di sini.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function CleanerAccountPage() {
  return (
    <PageContainer>
      <PageHeader title={copy.title} />
      <EmptyState icon={UserRound} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </PageContainer>
  );
}
