import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminServicesPage");
  return { title: t("title") };
}

// Admins only (T5). The title is prerendered; the rest renders inside the page's own role check
// (a layout's check would not protect it).
export default function AdminServicesPage() {
  const t = useTranslations("AdminServicesPage");
  return (
    <>
      <PageHeader title={t("title")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["admin"]}>
          <AdminServicesContent />
        </RoleGate>
      </Suspense>
    </>
  );
}

// Placeholder until T7b builds the editor for HomeKlin's one price list; the empty state says what will appear.
function AdminServicesContent() {
  const t = useTranslations("AdminServicesPage");
  return (
    <EmptyState icon={Tags} title={t("emptyTitle")}>
      {t("emptyBody")}
    </EmptyState>
  );
}
