import { ArrowRight, CircleAlert, Clock, MapPin, Sparkles } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { firstNameOf } from "@/components/auth/user-avatar";
import { getSlotLabels } from "@/components/customer/slot-labels";
import { groupCleanerJobs } from "@/components/jobs/job-days";
import { Link } from "@/i18n/navigation";
import { getCatalogServices } from "@/lib/catalog/cached";
import { getMyJobStats, listMyJobs, type CleanerJob, type JobStats } from "@/lib/jobs/jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CleanerProfileCard, readCleanerCard, type CleanerCardData } from "./cleaner-profile";
import { focusJob, pillBase, roundHours } from "./cleaner-views";
import { ReadFailed } from "./read-failed";

// The cleaner's home page /cleaner (D4, mock Cleaner-Home), inside the page's role check: a welcome
// with the first name, the job to go to now (2026-11-20, UX audit: the cleaner had to open "Pekerjaan"
// first to find it), the profile card, and the summary from my_job_stats (B6): hours from check-in to
// check-out this week, jobs starting today and jobs finished this month, by Jakarta time. Every read
// uses the cleaner's own session. When the numbers cannot be read, the page still greets the cleaner and
// says so in place of the tiles.
export async function CleanerHomeContent() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("CleanerHomePage")]);
  const client = await createSupabaseServerClient({ writeCookies: false });

  let card: CleanerCardData;
  try {
    card = await readCleanerCard(client, locale);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[cleaner] could not read the profile:", error);
    return <ReadFailed title={t("errorTitle")} body={t("errorBody")} retry={t("retry")} heading="h1" />;
  }

  let stats: JobStats | null = null;
  try {
    stats = await getMyJobStats(client);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[cleaner] could not read the job numbers:", error);
  }

  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-display text-ink">
        {t.rich("welcome", {
          name: firstNameOf(card.name) || card.name,
          accent: (chunks) => <span className="serif-accent">{chunks}</span>,
        })}
      </h1>
      <NextJob />
      <CleanerProfileCard card={card} headingId="home-profile" />
      <section aria-labelledby="cleaner-summary" className="flex flex-col gap-2.5">
        <h2 id="cleaner-summary" className="font-display text-lg font-semibold text-ink">
          {t("summary")}
        </h2>
        {stats ? (
          <ul className="grid grid-cols-2 gap-2.5">
            <li className="col-span-2 flex flex-col gap-0.5 rounded-lg bg-band px-4 py-4.5">
              <span className="font-display text-fact font-semibold text-lime tabular-nums">
                {t("hours", { hours: roundHours(stats.activeHoursWeek) })}
              </span>
              <span className="text-sm text-on-band-muted">{t("hoursLabel")}</span>
            </li>
            <SmallTile value={stats.jobsToday} label={t("todayLabel")} tone="bg-lime-wash text-on-lime-wash" />
            <SmallTile value={stats.completedMonth} label={t("monthLabel")} tone="bg-success-surface text-success" />
          </ul>
        ) : (
          <p className="flex items-start gap-2.5 rounded-md bg-warning-surface px-4 py-3 text-sm text-warning">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">{t("statsErrorTitle")}</span>
              <span>{t("statsErrorBody")}</span>
            </span>
          </p>
        )}
      </section>
    </>
  );
}

// The number in the tile's own dark colour (on-lime-wash 9.9:1, success 5.6:1 on its surface), the
// label in ink.
function SmallTile({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <li className={`flex min-w-0 flex-col gap-0.5 rounded-lg px-3 py-3.5 ${tone}`}>
      <span className="font-display text-4xl font-semibold tabular-nums">{value}</span>
      <span className="text-sm text-ink">{label}</span>
    </li>
  );
}

/**
 * The job to go to now (2026-11-20, UX audit): the one the job list puts first (focusJob), with its
 * window, service and address, as one link to its page, where check-in, the stream and check-out are.
 * "Sekarang" once checked in, "Berikutnya" before. With nothing left today, a line and the way to the
 * list. When the jobs cannot be read the card is left out: the list says so on its own page.
 */
async function NextJob() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("CleanerHomePage")]);
  let jobs: CleanerJob[];
  let serviceName: (job: CleanerJob) => string;
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    const [mine, services] = await Promise.all([listMyJobs(client), getCatalogServices()]);
    jobs = mine;
    serviceName = (job) => services.find((service) => service.id === job.serviceId)?.name[locale] ?? t("serviceFallback");
  } catch (error) {
    unstable_rethrow(error);
    console.error("[cleaner] could not read the jobs for the home:", error);
    return null;
  }
  const now = new Date();
  const focus = focusJob(groupCleanerJobs(jobs, now).today, now);

  if (!focus) {
    return (
      <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-dashed border-border bg-card px-4 py-3 text-sm text-ink-muted">
        <span>{t("noneToday")}</span>
        <Link href="/cleaner/jobs" className="inline-flex min-h-touch items-center gap-1 font-semibold text-primary underline underline-offset-4 hover:decoration-2">
          {t("allJobs")}
        </Link>
      </p>
    );
  }

  const labels = await getSlotLabels(locale);
  const { job } = focus;
  return (
    <section aria-labelledby="home-next-job">
      <h2 id="home-next-job" className="sr-only">
        {focus.now ? t("nowTitle") : t("nextTitle")}
      </h2>
      <Link
        href={`/cleaner/jobs/${job.orderCode}`}
        className="group flex flex-col gap-2.5 rounded-lg bg-card p-4 inset-ring-2 inset-ring-primary transition-[box-shadow,transform] duration-150 ease-out-quart hover:shadow-card-hover active:scale-[0.99] motion-reduce:active:scale-100"
      >
        <span className={`${pillBase} ${focus.now ? "bg-success-surface text-success" : "bg-primary text-on-primary"}`}>
          {focus.now ? <Sparkles className="size-3.5 shrink-0" aria-hidden="true" /> : <Clock className="size-3.5 shrink-0" aria-hidden="true" />}
          {focus.now ? t("nowTitle") : t("nextTitle")}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-title font-semibold text-ink tabular-nums">{labels.window(job)} WIB</span>
          <span className="text-body font-semibold text-ink">{serviceName(job)}</span>
        </span>
        <span className="flex items-start gap-2 text-sm text-ink-muted">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{job.address}</span>
        </span>
        <span className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary transition-colors duration-150 ease-out-quart group-hover:bg-primary-container">
          {focus.now ? t("openNow") : t("openNext")}
          <ArrowRight className="size-4.5 shrink-0" aria-hidden="true" />
        </span>
      </Link>
    </section>
  );
}
