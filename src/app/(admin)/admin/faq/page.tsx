import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "FAQ",
  emptyTitle: "Belum ada pertanyaan",
  emptyBody:
    "Pertanyaan umum yang tampil di halaman Bantuan pelanggan muncul di sini. Anda dapat menambah dan mengubahnya.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function AdminFaqPage() {
  return (
    <>
      <PageHeader title={copy.title} />
      <EmptyState icon={BookOpen} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </>
  );
}
