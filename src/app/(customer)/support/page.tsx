import type { Metadata } from "next";
import { CircleQuestionMark } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Bantuan",
  emptyTitle: "Pertanyaan umum muncul di sini",
  emptyBody:
    "Anda dapat mencari jawaban dengan kata kunci. Jika jawabannya tidak ada, Anda dapat menghubungi admin lewat chat dari halaman ini.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function SupportPage() {
  return (
    <PageContainer>
      <PageHeader title={copy.title} size="large" />
      <EmptyState icon={CircleQuestionMark} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </PageContainer>
  );
}
