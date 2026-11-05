import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Notice } from "@/components/admin/notice";
import { AssignCleaner } from "@/components/agency/assign-cleaner";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { JobsTable } from "@/components/back-office/jobs-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClientMessages } from "@/i18n/client-messages";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import { JobsError, listAgencyCleaners, listAgencyJobs, type AgencyCleaner, type AgencyJob } from "@/lib/jobs/jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AgencyOrdersPage");
  return { title: t("title") };
}

// Agency staff only (T5): the paid jobs routed to the agency, newest first, with the cleaner and where
// each job stands (T18), and for every job nobody has checked in to yet a control that assigns one of
// the agency's own cleaners (T28). The title is prerendered; the rest renders inside the page's own role
// check (a layout's check would not protect it).
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

// Read with the agency's own session: agency_jobs() and agency_cleaners() return only this agency's rows.
async function AgencyOrdersContent() {
  const [t, locale] = await Promise.all([getTranslations("AgencyOrdersPage"), getLocale()]);

  let jobs: AgencyJob[];
  let cleaners: AgencyCleaner[];
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    [jobs, cleaners] = await Promise.all([listAgencyJobs(client), listAgencyCleaners(client)]);
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
  const choices = cleaners.map((cleaner) => ({ id: cleaner.id, fullName: cleaner.fullName }));
  const rows = jobs.map((job) => {
    const area = areas.find((candidate) => candidate.id === job.areaId)?.name[locale] ?? job.areaId;
    // Assigning is allowed until check-in; the database refuses it after that as well.
    const open = !job.checkedInAt && !job.completedAt;
    return {
      ...job,
      serviceName: services.find((service) => service.id === job.serviceId)?.name[locale],
      detail: `${area} · ${job.address}`,
      assign: open ? <AssignCleaner orderId={job.id} cleaners={choices} cleanerId={job.cleanerId} /> : undefined,
    };
  });

  return (
    <ClientMessages namespaces={["AgencyOrdersPage"]}>
      <p className="text-sm text-ink-muted">{t("summary", { count: jobs.length })}</p>
      <JobsTable rows={rows} caption={t("caption")} when="date" />
    </ClientMessages>
  );
}
