import type { Metadata } from "next";
import { CirclePlay } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminRecordingsPage");
  return { title: t("title") };
}

// Admins only (T5). The title is prerendered; the rest renders inside the page's own role check
// (a layout's check would not protect it).
export default function AdminRecordingsPage() {
  const t = useTranslations("AdminRecordingsPage");
  return (
    <>
      <PageHeader title={t("title")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["admin"]}>
          <AdminRecordingsContent />
        </RoleGate>
      </Suspense>
    </>
  );
}

// Placeholder until the feature is built; the empty state says what will appear here.
function AdminRecordingsContent() {
  const t = useTranslations("AdminRecordingsPage");
  return (
    <EmptyState icon={CirclePlay} title={t("emptyTitle")}>
      {t("emptyBody")}
    </EmptyState>
  );
}
