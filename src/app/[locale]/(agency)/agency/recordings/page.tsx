import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { RecordingsContent } from "@/components/agency/recordings-content";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AgencyRecordingsPage");
  return { title: t("title") };
}

// Agency staff only (T5): the live streams and recordings of the agency's own cleaners (T29);
// ?recording=<id> opens one. The title is prerendered; the rest renders inside the page's own role check
// (a layout's check would not protect it).
export default function AgencyRecordingsPage({ searchParams }: PageProps<"/[locale]/agency/recordings">) {
  const t = useTranslations("AgencyRecordingsPage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["agency"]}>
          <RecordingsContent searchParams={searchParams} />
        </RoleGate>
      </Suspense>
    </>
  );
}
