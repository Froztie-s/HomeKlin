import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { DashboardContent } from "@/components/agency/dashboard-content";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AgencyDashboardPage");
  return { title: t("title") };
}

// Agency staff only (T5): a short summary with links (T28). The title is prerendered; the rest renders
// inside the page's own role check (a layout's check would not protect it).
export default function AgencyDashboardPage() {
  const t = useTranslations("AgencyDashboardPage");
  return (
    <>
      <PageHeader title={t("title")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["agency"]}>
          <DashboardContent />
        </RoleGate>
      </Suspense>
    </>
  );
}
