import { CircleAlert, ClipboardCheck, Phone } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { jakartaDayOf } from "@/components/customer/booking-query";
import { getSlotLabels } from "@/components/customer/slot-labels";
import { groupCleanerJobs } from "@/components/jobs/job-days";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientMessages } from "@/i18n/client-messages";
import { getCatalogServices } from "@/lib/catalog/cached";
import type { Service } from "@/lib/catalog/catalog";
import { checkInOpensAt } from "@/lib/jobs/check-in";
import { listMyJobs, type CleanerJob } from "@/lib/jobs/jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FinishedNotesProvider } from "./finished-notes";
import { JobCard } from "./job-card";

// The content of /cleaner for a signed-in cleaner, inside the page's role check (T17, T18). It reads
// the cleaner's own jobs with their own session through listMyJobs (my_jobs() returns only the jobs
// assigned to this cleaner, never another cleaner's and never the agency), then lists them in three
// groups: today (earliest first, an unfinished one from before included), upcoming, and just finished.
// Each card shows the service, the arrival window in WIB, the address and the customer with a phone
// link; check-in and check-out are the card's client part.
export async function CleanerJobsContent() {
  const locale = await getLocale();
  let jobs: CleanerJob[];
  let services: Service[];
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    [jobs, services] = await Promise.all([listMyJobs(client), getCatalogServices()]);
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return <JobsUnavailable />;
  }

  const t = await getTranslations("CleanerJobsPage");
  if (jobs.length === 0) {
    return (
      <EmptyState icon={ClipboardCheck} title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    );
  }

  const now = new Date();
  const groups = groupCleanerJobs(jobs, now);
  const labels = await getSlotLabels(locale);
  const serviceName = (job: CleanerJob) =>
    services.find((service) => service.id === job.serviceId)?.name[locale] ?? t("serviceFallback");

  const card = (job: CleanerJob) => (
    <li key={job.id} className="flex flex-col">
      <JobCard
        job={job}
        renderedAt={now.toISOString()}
        times={{
          opensAt: labels.time(checkInOpensAt(job.startsAt)),
          endsAt: labels.time(job.endsAt),
          checkedInAt: job.checkedInAt ? labels.time(job.checkedInAt) : null,
          completedAt: job.completedAt ? labels.time(job.completedAt) : null,
        }}
      >
        <h3 id={`job-${job.id}-title`} className="font-display text-xl font-semibold text-ink">
          {serviceName(job)}
        </h3>
        <dl className="flex flex-col gap-3 text-base">
          <Fact term={t("fields.window")}>
            <span className="font-semibold">
              {t("windowValue", { day: labels.day(jakartaDayOf(job.startsAt, now)), window: labels.window(job) })}
            </span>
          </Fact>
          <Fact term={t("fields.address")}>{job.address}</Fact>
          <Fact term={t("fields.customer")}>
            <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <span>{job.customerName || t("customerFallback")}</span>
              {job.contactPhone ? (
                <a
                  href={`tel:${job.contactPhone}`}
                  className="inline-flex min-h-touch items-center gap-2 rounded-full border border-border-control bg-surface px-4 text-sm font-semibold whitespace-nowrap text-ink tabular-nums transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50"
                >
                  <Phone className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
                  <span className="sr-only">{t("call")} </span>
                  {job.contactPhone}
                </a>
              ) : null}
            </span>
          </Fact>
        </dl>
      </JobCard>
    </li>
  );

  return (
    <ClientMessages namespaces={["CleanerJobActions", "CleanerStream"]}>
      <FinishedNotesProvider>
        <div className="flex flex-col gap-8">
          <JobSection id="today" title={t("sections.today")}>
            {groups.today.length > 0 ? (
              <JobList>{groups.today.map(card)}</JobList>
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-sm text-ink-muted">
                {t("todayNone")}
              </p>
            )}
          </JobSection>
          {groups.upcoming.length > 0 ? (
            <JobSection id="upcoming" title={t("sections.upcoming")}>
              <JobList>{groups.upcoming.map(card)}</JobList>
            </JobSection>
          ) : null}
          {groups.finished.length > 0 ? (
            <JobSection id="finished" title={t("sections.finished")}>
              <JobList>{groups.finished.map(card)}</JobList>
            </JobSection>
          ) : null}
        </div>
      </FinishedNotesProvider>
    </ClientMessages>
  );
}

function JobSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`jobs-${id}`} className="flex flex-col gap-3">
      <h2 id={`jobs-${id}`} className="font-display text-lg font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function JobList({ children }: { children: React.ReactNode }) {
  return <ul className="grid gap-3 lg:grid-cols-2">{children}</ul>;
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-ink-muted">{term}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

async function JobsUnavailable() {
  const t = await getTranslations("CleanerJobsPage");
  return (
    <EmptyState icon={CircleAlert} title={t("errorTitle")}>
      {t("errorBody")}
      <span className="mt-4 flex justify-center">
        {/* A plain link on purpose: a full page load reads the jobs again. */}
        <a
          href=""
          className="inline-flex min-h-touch items-center justify-center rounded-full border border-border-control bg-surface px-5 text-sm font-semibold text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50"
        >
          {t("retry")}
        </a>
      </span>
    </EmptyState>
  );
}
