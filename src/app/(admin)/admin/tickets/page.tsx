import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

const copy = {
  title: "Tiket",
  emptyTitle: "Belum ada tiket",
  emptyBody:
    "Pertanyaan pelanggan yang diteruskan dari halaman Bantuan muncul di sini, diurutkan dari yang paling mendesak.",
};

export const metadata: Metadata = { title: copy.title };

// Placeholder until the feature is built; the empty state says what will appear here.
export default function AdminTicketsPage() {
  return (
    <>
      <PageHeader title={copy.title} />
      <EmptyState icon={MessagesSquare} title={copy.emptyTitle}>
        {copy.emptyBody}
      </EmptyState>
    </>
  );
}
