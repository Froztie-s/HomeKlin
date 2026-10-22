import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OrdersPage");
  return { title: t("title") };
}

// Customers only (T5). The title is prerendered; everything else renders inside the role check, which
// every protected page makes itself, because a layout's check does not protect its pages
// (node_modules/next/dist/docs/01-app/02-guides/authentication.md, "Layouts and auth checks").
export default function OrdersPage() {
  const t = useTranslations("OrdersPage");
  return (
    <PageContainer>
      <PageHeader title={t("title")} size="large" />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["customer"]}>
          <OrdersContent />
        </RoleGate>
      </Suspense>
    </PageContainer>
  );
}

// Placeholder until the feature is built; the empty state says what will appear here. Data for the
// page is read here, behind the role check.
function OrdersContent() {
  const t = useTranslations("OrdersPage");
  return (
    <EmptyState icon={ClipboardList} title={t("emptyTitle")}>
      {t("emptyBody")}
    </EmptyState>
  );
}
