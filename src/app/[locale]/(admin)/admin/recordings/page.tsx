import type { Metadata } from "next";
import { CirclePlay } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminRecordingsPage");
  return { title: t("title") };
}

// Placeholder until the feature is built; the empty state says what will appear here.
export default function AdminRecordingsPage() {
  const t = useTranslations("AdminRecordingsPage");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState icon={CirclePlay} title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    </>
  );
}
