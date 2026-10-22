import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AccountSummary } from "@/components/auth/account-summary";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("CleanerAccountPage");
  return { title: t("title") };
}

// Cleaners only (T5): the cleaner's name and signing out, one tap from the bottom bar. The title is
// prerendered; the rest renders inside the page's own role check.
export default function CleanerAccountPage() {
  const t = useTranslations("CleanerAccountPage");
  return (
    <PageContainer>
      <PageHeader title={t("title")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["cleaner"]}>
          <AccountSummary />
        </RoleGate>
      </Suspense>
    </PageContainer>
  );
}
