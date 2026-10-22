import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("CleanerJobsPage");
  return { title: t("title") };
}

// Cleaners only (T5). The title is prerendered; the rest renders inside the page's own role check
// (a layout's check would not protect it).
export default function CleanerJobsPage() {
  const t = useTranslations("CleanerJobsPage");
  return (
    <PageContainer>
      <PageHeader title={t("title")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["cleaner"]}>
          <CleanerJobsContent />
        </RoleGate>
      </Suspense>
    </PageContainer>
  );
}

// Placeholder until the feature is built; the empty state says what will appear here.
function CleanerJobsContent() {
  const t = useTranslations("CleanerJobsPage");
  return (
    <EmptyState icon={ClipboardCheck} title={t("emptyTitle")}>
      {t("emptyBody")}
    </EmptyState>
  );
}
