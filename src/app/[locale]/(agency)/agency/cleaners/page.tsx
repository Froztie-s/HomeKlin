import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CleanersContent } from "@/components/agency/cleaners-content";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AgencyCleanersPage");
  return { title: t("title") };
}

// Agency staff only (T5): the agency's own cleaners and the form that adds one (T28). The title is
// prerendered; the rest renders inside the page's own role check (a layout's check would not protect it).
export default function AgencyCleanersPage() {
  const t = useTranslations("AgencyCleanersPage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["agency"]}>
          <CleanersContent />
        </RoleGate>
      </Suspense>
    </>
  );
}
