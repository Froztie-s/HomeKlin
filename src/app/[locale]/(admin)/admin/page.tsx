import type { Metadata } from "next";
import { CalendarClock, MapPinCheck, MessagesSquare, UserRoundSearch } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { Notice } from "@/components/admin/notice";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { jobsSummary, latestOpenTickets, ticketsSummary, type JobsSummary, type TicketsSummary } from "@/components/back-office/admin-console";
import { getAdminInbox, getAdminJobs } from "@/components/back-office/admin-data";
import { JobsTable } from "@/components/back-office/jobs-table";
import { OpenTickets } from "@/components/back-office/open-tickets";
import { SummaryTile } from "@/components/back-office/summary-tile";
import { jobsOfJakartaToday } from "@/components/jobs/job-days";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Link } from "@/i18n/navigation";
import { getCatalogServices } from "@/lib/catalog/cached";
import { JobsError, type AdminJob } from "@/lib/jobs/jobs";
import { SupportError, type InboxTicket } from "@/lib/support/support";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminDashboardPage");
  return { title: t("title") };
}

// How many open tickets the dashboard lists; the rest are one click away in the inbox.
const ticketsShown = 5;

// Admins only (T5). The admin dashboard (T24): four numbers (today's jobs, jobs in progress, today's jobs
// still without a cleaner, open tickets with the urgent ones), today's jobs with their check-in status
// (T18), and the latest open tickets, each linking on to the page where admin acts. Read-only. The title
// is prerendered; the rest renders inside the page's own role check (a layout's check would not protect
// it), read with the admin's own session (src/components/back-office/admin-data.ts).
export default function AdminDashboardPage() {
  const t = useTranslations("AdminDashboardPage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["admin"]}>
          <div className="flex flex-col gap-10">
            <Summary />
            <TodaysJobs />
            <LatestTickets />
          </div>
        </RoleGate>
      </Suspense>
    </>
  );
}

/**
 * A read, or null when it failed the expected way (the page then says it could not load); anything
 * else, such as Next.js' own signals, goes on.
 */
async function settle<T>(read: () => Promise<T>, expected: (error: unknown) => boolean): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    if (!expected(error)) throw error;
    console.error(error);
    return null;
  }
}

const readJobs = () => settle<AdminJob[]>(getAdminJobs, (error) => error instanceof JobsError);
const readTickets = () => settle<InboxTicket[]>(getAdminInbox, (error) => error instanceof SupportError);

async function Summary() {
  const [t, jobs, tickets] = await Promise.all([getTranslations("AdminDashboardPage"), readJobs(), readTickets()]);
  const counts: JobsSummary | null = jobs ? jobsSummary(jobs, new Date()) : null;
  const open: TicketsSummary | null = tickets ? ticketsSummary(tickets) : null;
  const unavailable = t("tileUnavailable");

  return (
    <section aria-labelledby="summary" className="flex flex-col gap-3">
      <h2 id="summary" className="sr-only">
        {t("summaryTitle")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          id="today"
          label={t("tiles.today.label")}
          value={counts?.today ?? null}
          hint={counts ? t("tiles.today.hint") : unavailable}
          href="#today-jobs"
          icon={CalendarClock}
        />
        <SummaryTile
          id="inProgress"
          label={t("tiles.inProgress.label")}
          value={counts?.inProgress ?? null}
          hint={counts ? t("tiles.inProgress.hint") : unavailable}
          href="/admin/monitor"
          icon={MapPinCheck}
        />
        <SummaryTile
          id="waiting"
          label={t("tiles.waiting.label")}
          value={counts?.waiting ?? null}
          hint={counts ? t("tiles.waiting.hint") : unavailable}
          href="#today-jobs"
          icon={UserRoundSearch}
          tone={counts && counts.waiting > 0 ? "attention" : "default"}
        />
        <SummaryTile
          id="tickets"
          label={t("tiles.tickets.label")}
          value={open?.open ?? null}
          hint={open ? t("tiles.tickets.hint", { urgent: open.urgent }) : unavailable}
          href="/admin/tickets"
          icon={MessagesSquare}
          tone={open && open.urgent > 0 ? "attention" : "default"}
        />
      </div>
    </section>
  );
}

function Section({ id, title, description, action, children }: { id: string; title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex scroll-mt-20 flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1">
          <h2 id={id} className="font-display text-lg font-semibold text-ink">
            {title}
          </h2>
          <p className="max-w-prose text-sm text-ink-muted">{description}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

async function TodaysJobs() {
  const [t, locale, all] = await Promise.all([getTranslations("AdminDashboardPage"), getLocale(), readJobs()]);

  let content: ReactNode;
  if (!all) {
    content = (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  } else {
    const jobs = jobsOfJakartaToday(all, new Date());
    if (jobs.length === 0) {
      content = (
        <EmptyState icon={CalendarClock} title={t("todayEmptyTitle")}>
          {t("todayEmptyBody")}
        </EmptyState>
      );
    } else {
      const services = await getCatalogServices();
      const rows = jobs.map((job) => ({
        ...job,
        serviceName: services.find((service) => service.id === job.serviceId)?.name[locale],
      }));
      content = (
        <>
          <p className="text-sm text-ink-muted">{t("todaySummary", { count: jobs.length })}</p>
          <JobsTable rows={rows} caption={t("todayTitle")} when="time" />
        </>
      );
    }
  }

  return (
    <Section id="today-jobs" title={t("todayTitle")} description={t("todayDescription")}>
      {content}
    </Section>
  );
}

async function LatestTickets() {
  const [t, tickets] = await Promise.all([getTranslations("AdminDashboardPage"), readTickets()]);
  const shown = tickets ? latestOpenTickets(tickets, ticketsShown) : [];

  const allTickets = (
    <Link
      href="/admin/tickets"
      className="inline-flex min-h-touch items-center rounded-full px-3 text-sm font-semibold whitespace-nowrap text-brand-700 transition-colors duration-150 ease-out-quart hover:bg-surface-sunken hover:text-brand-800 active:bg-brand-50"
    >
      {t("ticketsAll")}
    </Link>
  );

  return (
    <Section id="open-tickets" title={t("ticketsTitle")} description={t("ticketsDescription")} action={allTickets}>
      {!tickets ? (
        <Notice tone="danger" title={t("ticketsErrorTitle")}>
          {t("errorBody")}
        </Notice>
      ) : shown.length === 0 ? (
        <EmptyState icon={MessagesSquare} title={t("ticketsEmptyTitle")}>
          {t("ticketsEmptyBody")}
        </EmptyState>
      ) : (
        <OpenTickets tickets={shown} now={new Date()} />
      )}
    </Section>
  );
}
