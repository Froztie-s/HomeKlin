import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminFaqPage");
  return { title: t("title") };
}

// Placeholder until the feature is built; the empty state says what will appear here.
export default function AdminFaqPage() {
  const t = useTranslations("AdminFaqPage");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState icon={BookOpen} title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    </>
  );
}
