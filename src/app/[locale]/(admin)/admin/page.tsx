import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Notice } from "@/components/admin/notice";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { JobsTable } from "@/components/back-office/jobs-table";
import { jobsOfJakartaToday } from "@/components/jobs/job-days";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCatalogServices } from "@/lib/catalog/cached";
import { JobsError, listAdminJobs, type AdminJob } from "@/lib/jobs/jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminDashboardPage");
  return { title: t("title") };
}

// Admins only (T5). For now the dashboard holds today's jobs with their check-in status (T18), read-only;
// the full dashboard is T24. The title is prerendered; the rest renders inside the page's own role check
// (a layout's check would not protect it).
export default function AdminDashboardPage() {
  const t = useTranslations("AdminDashboardPage");
  return (
    <>
      <PageHeader title={t("title")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["admin"]}>
          <TodaysJobs />
        </RoleGate>
      </Suspense>
    </>
  );
}

// Read with the admin's own session: admin_jobs() answers admins only, and names the agency.
async function TodaysJobs() {
  const t = await getTranslations("AdminDashboardPage");
  return (
    <section aria-labelledby="today-jobs" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 id="today-jobs" className="font-display text-lg font-semibold text-ink">
          {t("todayTitle")}
        </h2>
        <p className="max-w-prose text-sm text-ink-muted">{t("todayDescription")}</p>
      </header>
      <TodaysJobsTable />
    </section>
  );
}

async function TodaysJobsTable() {
  const [t, locale] = await Promise.all([getTranslations("AdminDashboardPage"), getLocale()]);

  let jobs: AdminJob[];
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    jobs = jobsOfJakartaToday(await listAdminJobs(client), new Date());
  } catch (error) {
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
      <EmptyState icon={CalendarClock} title={t("todayEmptyTitle")}>
        {t("todayEmptyBody")}
      </EmptyState>
    );
  }

  const services = await getCatalogServices();
  const rows = jobs.map((job) => ({
    ...job,
    serviceName: services.find((service) => service.id === job.serviceId)?.name[locale],
  }));

  return (
    <>
      <p className="text-sm text-ink-muted">{t("todaySummary", { count: jobs.length })}</p>
      <JobsTable rows={rows} caption={t("todayTitle")} when="time" />
    </>
  );
}
