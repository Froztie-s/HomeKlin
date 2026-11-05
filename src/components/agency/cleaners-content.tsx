import { CalendarClock, MapPinCheck, UsersRound } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Notice } from "@/components/admin/notice";
import { initialsOf } from "@/components/auth/user-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientMessages } from "@/i18n/client-messages";
import { addCleaner } from "@/lib/agency/actions";
import { AgencyError, getMyAgency } from "@/lib/agency/agency";
import { JobsError, listAgencyCleaners, listAgencyJobs, type AgencyCleaner, type AgencyJob } from "@/lib/jobs/jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddCleanerForm } from "./add-cleaner-form";
import { NoAgency } from "./no-agency";

// "Petugas" (T28): the agency's own cleaners, by name with their photo (initials without one), what each
// is doing (at a job now, or how many jobs are coming), and the form that adds one. Read with the
// agency's own session: agency_cleaners() and agency_jobs() answer with this agency's rows only.
export async function CleanersContent() {
  const t = await getTranslations("AgencyCleanersPage");

  let cleaners: AgencyCleaner[] = [];
  let jobs: AgencyJob[] = [];
  let linked = false;
  let failed = false;
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    linked = (await getMyAgency(client)) !== null;
    if (linked) [cleaners, jobs] = await Promise.all([listAgencyCleaners(client), listAgencyJobs(client)]);
  } catch (error) {
    if (!(error instanceof AgencyError || error instanceof JobsError)) throw error;
    console.error(error);
    failed = true;
  }
  if (failed) {
    return (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }
  if (!linked) return <NoAgency title={t("noAgencyTitle")} body={t("noAgencyBody")} />;

  const now = new Date().getTime();
  const workOf = (cleanerId: string) => {
    const own = jobs.filter((job) => job.cleanerId === cleanerId && !job.completedAt);
    return {
      atWork: own.some((job) => job.checkedInAt),
      upcoming: own.filter((job) => !job.checkedInAt && Date.parse(job.endsAt) > now).length,
    };
  };

  return (
    <ClientMessages namespaces={["AgencyCleanersPage", "AgencyErrors"]}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
        <section aria-labelledby="cleaners-title" className="flex flex-col gap-4">
          <header className="flex items-baseline justify-between gap-3">
            <h2 id="cleaners-title" className="font-display text-lg font-semibold text-ink">
              {t("listTitle")}
            </h2>
            <p className="text-sm text-ink-muted">{t("count", { count: cleaners.length })}</p>
          </header>
          {cleaners.length === 0 ? (
            <EmptyState icon={UsersRound} title={t("emptyTitle")}>
              {t("emptyBody")}
            </EmptyState>
          ) : (
            <ul aria-labelledby="cleaners-title" className="divide-y divide-border rounded-xl border border-border bg-surface">
              {cleaners.map((cleaner) => {
                const work = workOf(cleaner.id);
                return (
                  <li key={cleaner.id} data-cleaner={cleaner.id} className="flex items-center gap-4 px-4 py-3 md:px-5">
                    <CleanerPhoto name={cleaner.fullName} photoUrl={cleaner.photoUrl} alt={t("photoAlt", { name: cleaner.fullName })} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-semibold text-ink">{cleaner.fullName}</span>
                      <span className="flex items-center gap-1.5 text-sm text-ink-muted">
                        {work.atWork ? (
                          <>
                            <MapPinCheck className="size-4 shrink-0 text-live" aria-hidden="true" />
                            {t("atWork")}
                          </>
                        ) : (
                          <>
                            <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
                            {t("upcoming", { count: work.upcoming })}
                          </>
                        )}
                      </span>
                    </div>
                    {cleaner.photoUrl ? null : <span className="hidden text-xs text-ink-faint sm:inline">{t("noPhoto")}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <AddCleanerForm addCleaner={addCleaner} />
      </div>
    </ClientMessages>
  );
}

function CleanerPhoto({ name, photoUrl, alt }: { name: string; photoUrl: string | null; alt: string }) {
  if (!photoUrl) {
    return (
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-base font-semibold text-brand-800"
      >
        {initialsOf(name)}
      </span>
    );
  }
  return (
    <Image
      src={photoUrl}
      width={96}
      height={96}
      alt={alt}
      sizes="48px"
      // The site's own photos (/images/...) are optimised; an uploaded photo (https) is shown as it is.
      unoptimized={!photoUrl.startsWith("/")}
      className="size-12 shrink-0 rounded-full bg-surface-sunken object-cover"
    />
  );
}
