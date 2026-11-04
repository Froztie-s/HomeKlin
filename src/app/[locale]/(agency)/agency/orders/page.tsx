import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Notice } from "@/components/admin/notice";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { JobsTable } from "@/components/back-office/jobs-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import { JobsError, listAgencyJobs, type AgencyJob } from "@/lib/jobs/jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AgencyOrdersPage");
  return { title: t("title") };
}

// Agency staff only (T5): the paid jobs routed to the agency, newest first, with the cleaner and where
// each job stands (T18), read-only until assigning a cleaner arrives (T28). The title is prerendered; the
// rest renders inside the page's own role check (a layout's check would not protect it).
export default function AgencyOrdersPage() {
  const t = useTranslations("AgencyOrdersPage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["agency"]}>
          <AgencyOrdersContent />
        </RoleGate>
      </Suspense>
    </>
  );
}

// Read with the agency's own session: agency_jobs() returns only the jobs routed to this agency.
async function AgencyOrdersContent() {
  const [t, locale] = await Promise.all([getTranslations("AgencyOrdersPage"), getLocale()]);

  let jobs: AgencyJob[];
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    jobs = await listAgencyJobs(client);
  } catch (error) {
    // Only a failed read becomes a message; anything else (such as Next.js' own signals) goes on.
    if (!(error instanceof JobsError)) throw error;
    console.error(error);
    return (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }

  if (jobs.length === 0) {
    return (
      <EmptyState icon={ClipboardList} title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    );
  }

  const [services, areas] = await Promise.all([getCatalogServices(), getServiceAreas()]);
  const rows = jobs.map((job) => {
    const area = areas.find((candidate) => candidate.id === job.areaId)?.name[locale] ?? job.areaId;
    return {
      ...job,
      serviceName: services.find((service) => service.id === job.serviceId)?.name[locale],
      detail: `${area} · ${job.address}`,
    };
  });

  return (
    <>
      <p className="text-sm text-ink-muted">{t("summary", { count: jobs.length })}</p>
      <JobsTable rows={rows} caption={t("caption")} when="date" />
    </>
  );
}
