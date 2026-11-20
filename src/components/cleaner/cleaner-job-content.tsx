import { Hash, MapPin, MessageSquareText, Navigation, Phone, SearchX, UserRound, Video, type LucideIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { parseOrderCode } from "@/components/back-office/admin-order";
import { jakartaDayOf } from "@/components/customer/booking-query";
import { getSlotLabels } from "@/components/customer/slot-labels";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClientMessages } from "@/i18n/client-messages";
import { getCatalogServices } from "@/lib/catalog/cached";
import { checkInOpensAt } from "@/lib/jobs/check-in";
import { listMyJobs, type CleanerJob } from "@/lib/jobs/jobs";
import { myStreamStatus } from "@/lib/stream/streams";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { localPhone, mapsSearchUrl, streamFromStatus } from "./cleaner-views";
import { JobActions } from "./job-actions";
import type { CleanerStream } from "./stream-control-state";
import { ReadFailed } from "./read-failed";

// One of the cleaner's jobs, /cleaner/jobs/HK-1042 (D4, mocks Cleaner-Job and Cleaner-Live), inside the
// page's role check. The job is found among the cleaner's own jobs (my_jobs(), their own session), so a
// job of another cleaner, or one finished more than a day ago, is simply not found. The page shows the
// address, the customer with a phone link, the customer's note (B7), whether the customer agreed to the
// stream and the order number; under it the actions (job-actions.tsx): check-in, then the stream and
// check-out. A job in progress starts from the stream's state on the server (my_stream_status).
export async function CleanerJobContent({ code: raw }: { code: string }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("CleanerJobPage")]);
  const back = { href: "/cleaner/jobs", label: t("back") };
  const code = parseOrderCode(raw);

  let job: CleanerJob | undefined;
  let serviceName: string | undefined;
  const client = await createSupabaseServerClient({ writeCookies: false });
  try {
    const [jobs, services] = await Promise.all([code ? listMyJobs(client) : [], getCatalogServices()]);
    job = jobs.find((candidate) => candidate.orderCode === code);
    serviceName = job ? services.find((service) => service.id === job?.serviceId)?.name[locale] : undefined;
  } catch (error) {
    unstable_rethrow(error);
    console.error("[cleaner] could not read the job:", error);
    return (
      <>
        <PageHeader title={t("errorTitle")} back={back} />
        <ReadFailed title={t("errorTitle")} body={t("errorBody")} retry={t("retry")} />
      </>
    );
  }
  if (!job) {
    return (
      <>
        <PageHeader title={t("notFoundTitle")} back={back} />
        <EmptyState tone="forest" icon={SearchX} title={t("notFoundTitle")}>
          {t("notFoundBody")}
        </EmptyState>
      </>
    );
  }

  // The stream's state only matters while the job is in progress; a failed read leaves it unknown, and
  // the page then shows what this tab last saw (stream-memory.ts).
  let stream: CleanerStream | null = "off";
  if (job.checkedInAt && !job.completedAt) {
    try {
      stream = streamFromStatus(await myStreamStatus(client, job.id));
    } catch (error) {
      unstable_rethrow(error);
      console.error("[cleaner] could not read the stream state:", error);
      stream = null;
    }
  }

  const now = new Date();
  const labels = await getSlotLabels(locale);
  const customer = job.customerName || t("customerFallback");
  const maps = mapsSearchUrl(job.address);

  return (
    <>
      <PageHeader
        title={serviceName ?? t("serviceFallback")}
        description={<span className="tabular-nums">{t("when", { day: labels.day(jakartaDayOf(job.startsAt, now)), window: labels.window(job) })}</span>}
        back={back}
      />
      <section aria-label={t("detailsLabel")} className="flex flex-col gap-3.5 rounded-lg bg-card p-4">
        <dl className="flex flex-col gap-3.5">
          <Fact icon={MapPin} term={t("fields.address")}>
            <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <span>{job.address}</span>
              {/* Audit item 4: the address in Google Maps, in a new tab (the Maps app on most phones). A
                  plain link: the address goes to Google only when the cleaner taps it (cleaner-views.ts). */}
              {maps ? (
                <a href={maps} target="_blank" rel="noopener noreferrer" className={pillLink}>
                  <Navigation className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {t("maps")}
                  <span className="sr-only"> {t("newTab")}</span>
                </a>
              ) : null}
            </span>
          </Fact>
          <Fact icon={UserRound} term={t("fields.customer")}>
            <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <span>{customer}</span>
              {job.contactPhone ? (
                <a href={`tel:${job.contactPhone}`} className={`${pillLink} tabular-nums`}>
                  <Phone className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="sr-only">{t("call")} </span>
                  {localPhone(job.contactPhone)}
                </a>
              ) : null}
            </span>
          </Fact>
          {job.customerNote.trim() ? (
            <Fact icon={MessageSquareText} term={t("fields.note")}>
              <span className="whitespace-pre-line">{job.customerNote}</span>
            </Fact>
          ) : null}
          <Fact icon={Video} term={t("fields.stream")}>
            {job.streamConsent ? t("consentYes") : t("consentNo")}
          </Fact>
          <Fact icon={Hash} term={t("fields.order")}>
            <span className="tabular-nums">{job.orderCode}</span>
          </Fact>
        </dl>
      </section>
      <ClientMessages namespaces={["CleanerJobActions", "CleanerStream"]}>
        <JobActions
          job={job}
          renderedAt={now.toISOString()}
          stream={stream}
          times={{
            opensAt: labels.time(checkInOpensAt(job.startsAt)),
            endsAt: labels.time(job.endsAt),
            checkedInAt: job.checkedInAt ? labels.time(job.checkedInAt) : null,
            completedAt: job.completedAt ? labels.time(job.completedAt) : null,
          }}
        />
      </ClientMessages>
    </>
  );
}

// One fact of the job: a lime-wash icon well, the term small and muted, the value in semibold ink.
/** The job's outlined pill links: the phone number and "Buka di Maps". */
const pillLink =
  "inline-flex min-h-touch items-center gap-2 rounded-full bg-card px-4 text-sm font-semibold whitespace-nowrap text-ink inset-ring-[1.5px] inset-ring-outline transition-colors duration-150 ease-out-quart hover:bg-sunken active:bg-lime-wash";

function Fact({ icon: Icon, term, children }: { icon: LucideIcon; term: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-lime-wash text-on-lime-wash">
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <dt className="text-xs text-ink-muted">{term}</dt>
        <dd className="text-sm font-semibold break-words text-ink">{children}</dd>
      </div>
    </div>
  );
}
