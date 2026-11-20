import { CalendarDays, ChevronRight, ClipboardCheck, Clock, MapPin, UserRound } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { jakartaDayOf } from "@/components/customer/booking-query";
import { getSlotLabels, type SlotLabels } from "@/components/customer/slot-labels";
import { groupCleanerJobs } from "@/components/jobs/job-days";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";
import { getCatalogServices } from "@/lib/catalog/cached";
import type { Service } from "@/lib/catalog/catalog";
import { formatJakartaDay } from "@/lib/catalog/slots-days";
import { listMyJobs, type CleanerJob } from "@/lib/jobs/jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { focusJob, pillBase } from "./cleaner-views";
import { JobStatePill } from "./job-state";
import { ReadFailed } from "./read-failed";

// The cleaner's job list /cleaner/jobs (D4, mock Cleaner-Jobs), inside the page's role check (T17). It
// reads the cleaner's own jobs with their own session through listMyJobs (my_jobs() returns only the
// jobs assigned to this cleaner, never another cleaner's and never the agency), then lists them in
// three groups: today (earliest first, an unfinished one from before included), upcoming, and just
// finished. Each job is one white card that opens its page (/cleaner/jobs/HK-1042), where check-in,
// the stream and check-out are; the next job to do today wears a forest edge and "Berikutnya", or
// "Sekarang" once the cleaner has checked in to it (2026-11-20, UX audit item 10).
export async function CleanerJobsContent() {
  const locale = await getLocale();
  const t = await getTranslations("CleanerJobsPage");
  let jobs: CleanerJob[];
  let services: Service[];
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    [jobs, services] = await Promise.all([listMyJobs(client), getCatalogServices()]);
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return <ReadFailed title={t("errorTitle")} body={t("errorBody")} retry={t("retry")} />;
  }

  if (jobs.length === 0) {
    return (
      <EmptyState tone="forest" icon={ClipboardCheck} title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    );
  }

  const now = new Date();
  const groups = groupCleanerJobs(jobs, now);
  const labels = await getSlotLabels(locale);
  const focus = focusJob(groups.today, now);
  const today = formatJakartaDay(jakartaDayOf(now.toISOString(), now).date, locale);
  const serviceName = (job: CleanerJob) =>
    services.find((service) => service.id === job.serviceId)?.name[locale] ?? t("serviceFallback");

  const card = (job: CleanerJob, kind: "today" | "upcoming" | "finished") => (
    <li key={job.id}>
      <JobLinkCard
        job={job}
        serviceName={serviceName(job)}
        labels={labels}
        renderedAt={now.toISOString()}
        upcomingDay={kind === "upcoming" ? labels.day(jakartaDayOf(job.startsAt, now)) : null}
        isNext={job.id === focus?.job.id}
        nextLabel={focus?.now ? t("now") : t("next")}
        customerLine={t("customerLine", { name: job.customerName || t("customerFallback") })}
      />
    </li>
  );

  return (
    <ClientMessages namespaces={["CleanerJobActions"]}>
      <div className="flex flex-col gap-6">
        <JobSection id="today" title={t("sections.today", { date: `${today.weekday} ${today.date}` })}>
          {groups.today.length > 0 ? (
            <JobList>{groups.today.map((job) => card(job, "today"))}</JobList>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-card px-4 py-5 text-sm text-ink-muted">
              {t("todayNone")}
            </p>
          )}
        </JobSection>
        {groups.upcoming.length > 0 ? (
          <JobSection id="upcoming" title={t("sections.upcoming")}>
            <JobList>{groups.upcoming.map((job) => card(job, "upcoming"))}</JobList>
          </JobSection>
        ) : null}
        {groups.finished.length > 0 ? (
          <JobSection id="finished" title={t("sections.finished")}>
            <JobList>{groups.finished.map((job) => card(job, "finished"))}</JobList>
          </JobSection>
        ) : null}
      </div>
    </ClientMessages>
  );
}

type JobLinkCardProps = {
  job: CleanerJob;
  serviceName: string;
  labels: SlotLabels;
  renderedAt: string;
  /** For a later day: the day in place of the state, which is always "not open yet" there. */
  upcomingDay: string | null;
  isNext: boolean;
  nextLabel: string;
  customerLine: string;
};

// One job: its state (or its day), the window in the title face, the service, the address and the
// customer, and a chevron. The whole card is the link; the focus ring follows its rounded edge.
function JobLinkCard({ job, serviceName, labels, renderedAt, upcomingDay, isNext, nextLabel, customerLine }: JobLinkCardProps) {
  return (
    <article aria-labelledby={`job-${job.id}-title`} className="h-full">
      <Link
        href={`/cleaner/jobs/${job.orderCode}`}
        className={`group flex h-full flex-col gap-2.5 rounded-lg bg-card p-4 transition-[box-shadow,transform] duration-150 ease-out-quart hover:shadow-card-hover active:scale-[0.99] motion-reduce:active:scale-100 ${
          isNext ? "inset-ring-2 inset-ring-primary" : ""
        }`}
      >
        <span className="flex flex-wrap items-center gap-2">
          {isNext ? (
            <span className={`${pillBase} bg-primary text-on-primary`}>
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
              {nextLabel}
            </span>
          ) : null}
          {upcomingDay ? (
            <span className={`${pillBase} bg-sunken text-ink`}>
              <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
              {upcomingDay}
            </span>
          ) : (
            <JobStatePill job={job} renderedAt={renderedAt} />
          )}
        </span>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-display text-title font-semibold text-ink tabular-nums">{labels.window(job)} WIB</span>
            <h3 id={`job-${job.id}-title`} className="text-body font-semibold text-ink">
              {serviceName}
            </h3>
          </div>
          <ChevronRight
            className="mt-1.5 size-5.5 shrink-0 text-ink transition-transform duration-150 ease-out-quart group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </div>
        <span className="flex items-start gap-2 text-sm text-ink-muted">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{job.address}</span>
        </span>
        <span className="flex items-start gap-2 text-sm text-ink-muted">
          <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{customerLine}</span>
        </span>
      </Link>
    </article>
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
