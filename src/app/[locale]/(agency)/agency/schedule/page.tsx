import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ScheduleContent } from "@/components/agency/schedule-content";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AgencySchedulePage");
  return { title: t("title") };
}

// Agency staff only (T5): "Jadwal", the agency's own arrival windows per area (T27), one week at a time
// (?week=, ?area=). The title is prerendered; the rest renders inside the page's own role check (a
// layout's check would not protect it).
export default function AgencySchedulePage({ searchParams }: PageProps<"/[locale]/agency/schedule">) {
  const t = useTranslations("AgencySchedulePage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["agency"]}>
          <ScheduleContent searchParams={searchParams} />
        </RoleGate>
      </Suspense>
    </>
  );
}
