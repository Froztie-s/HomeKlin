import { CalendarDays, ChevronLeft, ChevronRight, CircleSlash, MapPinCheck, Moon, Plus, UsersRound } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Notice } from "@/components/admin/notice";
import { initialsOf } from "@/components/auth/user-avatar";
import { StatusPill } from "@/components/back-office/status-pill";
import { getSlotLabels } from "@/components/customer/slot-labels";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";
import { addCleaner, updateCleanerDetails } from "@/lib/agency/actions";
import { AgencyError, getMyAgency, listAgencySlots, type AgencySlot, type MyAgency } from "@/lib/agency/agency";
import { getServiceAreas } from "@/lib/catalog/cached";
import { JobsError, listAgencyCleaners, listAgencyJobs, type AgencyCleaner, type AgencyJob } from "@/lib/jobs/jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddCleanerDialog } from "./add-cleaner-dialog";
import { CleanerRow } from "./cleaner-row";
import { availabilityGrid, cleanerWeekJobs, formatAgencyDate, jakartaWeek, type AvailabilityCell } from "./agency-views";
import { Panel } from "./agency-ui";
import { NoAgency } from "./no-agency";
import { addDays, lastScheduleWeek, parseScheduleWeek } from "./schedule-time";
import { panel, secondaryButton } from "./styles";

type SearchParams = Record<string, string | string[] | undefined>;

const headCell = "px-4 py-3 text-left text-xs font-semibold text-ink-muted";
const weekLink =
  "inline-flex size-11 items-center justify-center rounded-full border border-border-control bg-card text-ink transition-[background-color,transform] duration-150 ease-out-quart";

type Read = { agency: MyAgency; cleaners: AgencyCleaner[]; jobs: AgencyJob[]; slots: AgencySlot[] } | null;

// "Petugas dan ketersediaan" (D2, after the mock Partner-Cleaners; T28): the agency's own cleaners with
// their photo (initials without one), phone and area (changed in place with "Ubah", B11), whether each
// is at a job now, and how many jobs each has this week; then the week's arrival windows as a grid of days and start times, with the free places of each
// (?week= moves a week at a time, over the 60 days the database lists), linking to "Jadwal" where they
// are changed; then the form that adds a cleaner. The schedule belongs to the agency, not to one
// cleaner: the database keeps places per window, not who is free (docs/redesign-gaps.md, Partner agency). Read
// with the agency's own session: agency_cleaners(), agency_jobs() and agency_slots() answer with this
// agency's rows only.
export async function CleanersContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [t, locale, params] = await Promise.all([getTranslations("AgencyCleanersPage"), getLocale(), searchParams]);
  const now = new Date();
  const index = parseScheduleWeek(params.week);
  const thisWeek = jakartaWeek(now);
  const week = { from: addDays(thisWeek.from, index * 7), to: addDays(thisWeek.to, index * 7) };

  let data: Read;
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    const agency = await getMyAgency(client);
    if (!agency) data = null;
    else {
      // From the week's Monday, so this week's earlier days show their windows too.
      const [cleaners, jobs, slots] = await Promise.all([
        listAgencyCleaners(client),
        listAgencyJobs(client),
        listAgencySlots(client, new Date(`${week.from}T00:00:00+07:00`).toISOString()),
      ]);
      data = { agency, cleaners, jobs, slots };
    }
  } catch (error) {
    if (!(error instanceof AgencyError || error instanceof JobsError)) throw error;
    console.error(error);
    return (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }
  if (!data) return <NoAgency title={t("noAgencyTitle")} body={t("noAgencyBody")} />;

  const { cleaners, jobs } = data;
  const atWork = (cleanerId: string) => jobs.some((job) => job.cleanerId === cleanerId && job.checkedInAt && !job.completedAt);
  const grid = availabilityGrid(data.slots, week);
  const [labels, allAreas] = await Promise.all([getSlotLabels(locale), getServiceAreas()]);
  // The agency's own areas, by name, in the catalog's order: the only areas a cleaner can have.
  const areas = allAreas.filter((area) => data.agency.areaIds.includes(area.id)).map((area) => ({ id: area.id, name: area.name[locale] }));
  const span = { from: formatAgencyDate(week.from, locale, "short"), to: formatAgencyDate(week.to, locale, "short") };
  const weekHref = (next: number) => (next === 0 ? "/agency/cleaners#availability-title" : { pathname: "/agency/cleaners", query: { week: String(next) }, hash: "availability-title" });

  return (
    <ClientMessages namespaces={["AgencyCleanersPage", "AgencyErrors"]}>
      <section aria-labelledby="cleaners-title" className={`${panel} flex min-w-0 flex-col overflow-hidden`}>
        <header className="flex flex-wrap items-baseline justify-between gap-3 px-5 pt-5 pb-4 md:px-6 md:pt-6">
          <h2 id="cleaners-title" className="font-display text-lg font-semibold text-ink">
            {t("listTitle")}
          </h2>
          <p className="text-sm text-ink-muted">{t("count", { count: cleaners.length })}</p>
        </header>
        {cleaners.length === 0 ? (
          <div className="px-5 pb-5 md:px-6 md:pb-6">
            <EmptyState tone="forest" icon={UsersRound} title={t("emptyTitle")}>
              {t("emptyBody")}
            </EmptyState>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t("listTitle")}</caption>
            <thead className="bg-sunken">
              <tr>
                <th scope="col" className={headCell}>
                  {t("table.cleaner")}
                </th>
                <th scope="col" className={`${headCell} hidden lg:table-cell`}>
                  {t("table.phone")}
                </th>
                <th scope="col" className={`${headCell} hidden lg:table-cell`}>
                  {t("table.area")}
                </th>
                <th scope="col" className={`${headCell} hidden sm:table-cell`}>
                  {t("table.status")}
                </th>
                <th scope="col" className={`${headCell} hidden text-right sm:table-cell`}>
                  {t("table.week")}
                </th>
                <th scope="col" className={headCell}>
                  <span className="sr-only">{t("table.edit")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cleaners.map((cleaner) => {
                const status = atWork(cleaner.id) ? (
                  <StatusPill Icon={MapPinCheck} pill="bg-live-surface text-live" label={t("atWork")} />
                ) : (
                  <StatusPill Icon={Moon} pill="bg-sunken text-ink-muted" label={t("notAtWork")} />
                );
                return (
                  <CleanerRow
                    key={cleaner.id}
                    cleaner={{ id: cleaner.id, fullName: cleaner.fullName, phone: cleaner.phone, areaId: cleaner.areaId }}
                    areas={areas}
                    photo={<CleanerPhoto name={cleaner.fullName} photoUrl={cleaner.photoUrl} alt={t("photoAlt", { name: cleaner.fullName })} />}
                    status={status}
                    weekJobs={cleanerWeekJobs(jobs, cleaner.id, thisWeek)}
                    updateCleanerDetails={updateCleanerDetails}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <Panel
        id="availability-title"
        title={t("availability.title")}
        description={t(index === 0 ? "availability.thisWeek" : "availability.week", span)}
        action={
          <nav aria-label={t("availability.weekNav")} className="flex items-center gap-2">
            {index > 0 ? (
              <Link href={weekHref(index - 1)} aria-label={t("availability.previous")} className={`${weekLink} hover:bg-sunken active:scale-95 active:bg-lime-wash`}>
                <ChevronLeft className="size-5" aria-hidden="true" />
              </Link>
            ) : (
              <span role="link" aria-disabled="true" aria-label={t("availability.previous")} className={`${weekLink} cursor-not-allowed text-ink-muted opacity-60`}>
                <ChevronLeft className="size-5" aria-hidden="true" />
              </span>
            )}
            {index < lastScheduleWeek ? (
              <Link href={weekHref(index + 1)} aria-label={t("availability.next")} className={`${weekLink} hover:bg-sunken active:scale-95 active:bg-lime-wash`}>
                <ChevronRight className="size-5" aria-hidden="true" />
              </Link>
            ) : (
              <span role="link" aria-disabled="true" aria-label={t("availability.next")} className={`${weekLink} cursor-not-allowed text-ink-muted opacity-60`}>
                <ChevronRight className="size-5" aria-hidden="true" />
              </span>
            )}
          </nav>
        }
      >
        {/* The grid scrolls inside its own box on a phone; it is relative so the cells' screen-reader
            words (absolutely placed, sr-only) stay inside that box instead of widening the page. */}
        {grid.rows.length === 0 ? (
          <EmptyState tone="forest" icon={CalendarDays} title={t("availability.emptyTitle")}>
            {t("availability.emptyBody")}
          </EmptyState>
        ) : (
          <div className="relative -mx-5 overflow-x-auto px-5 md:-mx-6 md:px-6">
            <table className="w-full min-w-176 border-separate border-spacing-1.5 text-sm">
              <caption className="sr-only">{t("availability.caption", span)}</caption>
              <thead>
                <tr>
                  <td />
                  {grid.days.map((date) => (
                    <th key={date} scope="col" className="pb-1 text-center text-xs font-semibold text-ink tabular-nums">
                      {formatAgencyDate(date, locale, "weekday").split(" ").slice(0, 2).join(" ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr key={row.time}>
                    <th scope="row" className="pr-2 text-left text-xs font-semibold whitespace-nowrap text-ink-muted tabular-nums">
                      {row.time.replace(":", ".")}
                    </th>
                    {row.cells.map((slot, column) => (
                      <td key={grid.days[column]} className="p-0">
                        <AvailabilitySlot slot={slot} window={slot ? labels.window(slot) : ""} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-sm text-ink-muted">{t("availability.note")}</p>
          <Link href="/agency/schedule" className={secondaryButton}>
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            {t("availability.manage")}
          </Link>
        </div>
      </Panel>

      {/* Opened by the header's "Tambah petugas" (UX audit item 17), not a form at the end of the page. */}
      <AddCleanerDialog addCleaner={addCleaner} />
    </ClientMessages>
  );
}

/** The header's "Tambah petugas": a link to #add-cleaner, which AddCleanerDialog opens as a dialog. */
export async function AddCleanerJump() {
  const t = await getTranslations("AgencyCleanersPage");
  return (
    <a
      href="#add-cleaner"
      className="inline-flex min-h-touch items-center gap-2 rounded-full bg-primary pr-2.5 pl-5 text-sm font-semibold whitespace-nowrap text-on-primary transition-[background-color,transform] duration-150 ease-out-quart hover:bg-primary-container active:scale-[0.98] active:bg-band"
    >
      {t("form.title")}
      <span aria-hidden="true" className="ml-1 flex size-6 items-center justify-center rounded-full bg-lime text-on-lime">
        <Plus className="size-3.5" strokeWidth={2.5} />
      </span>
    </a>
  );
}

// One window of the week: its free places as words ("2 tempat kosong"), "Penuh" with an icon when every
// place is taken, or "Tutup" when the agency has no window then. Never colour alone.
async function AvailabilitySlot({ slot, window }: { slot: AvailabilityCell | null; window: string }) {
  const t = await getTranslations("AgencyCleanersPage.availability");
  const box = "flex min-h-touch flex-col items-center justify-center rounded-sm px-2 py-1 text-center text-xs";
  if (!slot) {
    return (
      <span className={`${box} bg-sunken text-ink-muted`}>
        {t("closed")}
      </span>
    );
  }
  const free = Math.max(slot.capacity - slot.booked, 0);
  if (free === 0) {
    return (
      <span title={window} className={`${box} gap-0.5 bg-warning-surface font-semibold text-warning`}>
        <CircleSlash className="size-3.5 shrink-0" aria-hidden="true" />
        {t("full")}
        <span className="sr-only">, {window}</span>
      </span>
    );
  }
  return (
    <span title={window} className={`${box} bg-lime-wash font-semibold text-on-lime-wash tabular-nums`}>
      {t("free", { free, capacity: slot.capacity })}
      <span className="sr-only">, {window}</span>
    </span>
  );
}

function CleanerPhoto({ name, photoUrl, alt }: { name: string; photoUrl: string | null; alt: string }) {
  if (!photoUrl) {
    return (
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lime-wash text-sm font-semibold text-on-lime-wash">
        {initialsOf(name)}
      </span>
    );
  }
  return (
    <Image
      src={photoUrl}
      width={88}
      height={88}
      alt={alt}
      sizes="44px"
      // The site's own photos (/images/...) are optimised; an uploaded photo (https) is shown as it is.
      unoptimized={!photoUrl.startsWith("/")}
      className="size-11 shrink-0 rounded-full bg-sunken object-cover"
    />
  );
}
