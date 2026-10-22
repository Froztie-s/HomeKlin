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
  const t = await getTranslations("AccountPage");
  return { title: t("title") };
}

// Customers only (T5): who is signed in, and signing out. The title is prerendered; the rest renders
// inside the page's own role check (a layout's check would not protect it).
export default function AccountPage() {
  const t = useTranslations("AccountPage");
  return (
    <PageContainer>
      <PageHeader title={t("title")} size="large" />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["customer"]}>
          <AccountSummary />
        </RoleGate>
      </Suspense>
    </PageContainer>
  );
}
