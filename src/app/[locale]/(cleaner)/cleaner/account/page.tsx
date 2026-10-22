import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("CleanerAccountPage");
  return { title: t("title") };
}

// Placeholder until the feature is built; the empty state says what will appear here.
export default function CleanerAccountPage() {
  const t = useTranslations("CleanerAccountPage");
  return (
    <PageContainer>
      <PageHeader title={t("title")} />
      <EmptyState icon={UserRound} title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    </PageContainer>
  );
}
