import type { Metadata } from "next";
import { ChartColumn } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OwnerDashboardPage");
  return { title: t("title") };
}

// The owner only (T29b). The title is prerendered; the rest renders inside the page's own role check
// (a layout's check would not protect it).
export default function OwnerDashboardPage() {
  const t = useTranslations("OwnerDashboardPage");
  return (
    <PageContainer>
      <PageHeader title={t("title")} size="large" />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["owner"]}>
          <OwnerDashboardContent />
        </RoleGate>
      </Suspense>
    </PageContainer>
  );
}

// Placeholder until the dashboard is built; the empty state says what will appear here.
function OwnerDashboardContent() {
  const t = useTranslations("OwnerDashboardPage");
  return (
    <EmptyState icon={ChartColumn} title={t("emptyTitle")}>
      {t("emptyBody")}
    </EmptyState>
  );
}
