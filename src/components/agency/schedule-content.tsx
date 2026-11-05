import { CalendarDays, ChevronLeft, ChevronRight, CircleSlash, MapPin } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Notice } from "@/components/admin/notice";
import { getSlotLabels } from "@/components/customer/slot-labels";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";
import { addSlot, deleteSlot, setSlotCapacity } from "@/lib/agency/actions";
import { AgencyError, getMyAgency, listAgencySlots, type AgencySlot, type MyAgency } from "@/lib/agency/agency";
import { getServiceAreas } from "@/lib/catalog/cached";
import { formatJakartaDay } from "@/lib/catalog/slots-days";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AddSlotForm } from "./add-slot-form";
import { NoAgency } from "./no-agency";
import {
  addDays,
  groupScheduleDays,
  jakartaToday,
  lastScheduleWeek,
  parseScheduleArea,
  parseScheduleWeek,
  scheduleWeek,
} from "./schedule-time";
import { SlotRowActions } from "./slot-row-actions";

type SearchParams = Record<string, string | string[] | undefined>;

const navLink =
  "inline-flex min-h-touch items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors duration-150 ease-out-quart";

// "Jadwal" (T27): the agency's own arrival windows, one week of seven Jakarta days at a time (?week=0 to
// 8, the 60 days agency_slots() lists), optionally one of its areas (?area=), by day and then by area,
// each with its booked places and capacity, which it can change, and a remove button for windows nobody
// booked. Above the list, the form that adds a window. Everything is read with the agency's own session:
// the database answers with this agency's windows only (supabase/migrations/20261104150000_agency_back_office.sql).
export async function ScheduleContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [t, locale, params] = await Promise.all([getTranslations("AgencySchedulePage"), getLocale(), searchParams]);

  let agency: MyAgency | null;
  let slots: AgencySlot[] = [];
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    agency = await getMyAgency(client);
    if (agency) slots = await listAgencySlots(client);
  } catch (error) {
    // Only a failed read becomes a message; anything else (such as Next.js' own signals) goes on.
    if (!(error instanceof AgencyError)) throw error;
    console.error(error);
    return (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }
  if (!agency) return <NoAgency title={t("noAgencyTitle")} body={t("noAgencyBody")} />;

  const [catalogAreas, labels] = await Promise.all([getServiceAreas(), getSlotLabels(locale)]);
  const areaName = (id: string) => catalogAreas.find((area) => area.id === id)?.name[locale] ?? id;
  const areas = agency.areaIds.map((id) => ({ id, name: areaName(id) }));

  const now = new Date();
  const today = jakartaToday(now);
  const week = parseScheduleWeek(params.week);
  const areaFilter = parseScheduleArea(params.area, agency.areaIds);
  const range = scheduleWeek(week, now);
  const days = groupScheduleDays(areaFilter ? slots.filter((slot) => slot.areaId === areaFilter) : slots, agency.areaIds, range);
  const count = days.reduce((sum, day) => sum + day.areas.reduce((inDay, area) => inDay + area.slots.length, 0), 0);

  const query = (next: { week?: number; area?: string | null }) => {
    const nextWeek = next.week ?? week;
    const nextArea = next.area === undefined ? areaFilter : next.area;
    return {
      pathname: "/agency/schedule",
      query: { ...(nextWeek > 0 ? { week: String(nextWeek) } : {}), ...(nextArea ? { area: nextArea } : {}) },
    } as const;
  };
  const dayName = (date: string) => labels.day({ date, relative: date === today ? "today" : date === addDays(today, 1) ? "tomorrow" : null });
  const span = { from: formatJakartaDay(range.from, locale).date, to: formatJakartaDay(range.to, locale).date };
  const weekLabel = week === 0 ? t("thisWeek", span) : t("weekLabel", span);

  return (
    <ClientMessages namespaces={["AgencySchedulePage", "AgencyErrors"]}>
      <AddSlotForm areas={areas} areaFilter={areaFilter} minDate={today} maxDate={addDays(today, 59)} addSlot={addSlot} />

      <section aria-labelledby="schedule-week" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <header className="flex flex-col gap-1">
            <h2 id="schedule-week" className="font-display text-lg font-semibold text-ink">
              {weekLabel}
            </h2>
            <p className="text-sm text-ink-muted">{t("weekSummary", { count })}</p>
          </header>
          <nav aria-label={t("weekNav")} className="flex items-center gap-1">
            {week > 0 ? (
              <Link href={query({ week: week - 1 })} className={`${navLink} text-ink hover:bg-surface-sunken active:bg-brand-50`}>
                <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
                {t("previousWeek")}
              </Link>
            ) : (
              <span aria-disabled="true" className={`${navLink} cursor-not-allowed text-ink-faint`}>
                <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
                {t("previousWeek")}
              </span>
            )}
            {week < lastScheduleWeek ? (
              <Link href={query({ week: week + 1 })} className={`${navLink} text-ink hover:bg-surface-sunken active:bg-brand-50`}>
                {t("nextWeek")}
                <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              </Link>
            ) : (
              <span aria-disabled="true" className={`${navLink} cursor-not-allowed text-ink-faint`}>
                {t("nextWeek")}
                <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              </span>
            )}
          </nav>
        </div>

        {areas.length > 1 ? (
          <nav aria-label={t("areaFilter")} className="-mx-1 flex flex-wrap gap-1.5">
            {[{ id: null, name: t("allAreas") }, ...areas].map((area) => {
              const current = area.id === areaFilter;
              return (
                <Link
                  key={area.id ?? "all"}
                  href={query({ area: area.id })}
                  aria-current={current ? "true" : undefined}
                  className={`${navLink} border ${
                    current
                      ? "border-brand-600 bg-brand-100 text-brand-800"
                      : "border-border bg-surface text-ink hover:border-brand-200 hover:bg-surface-sunken"
                  }`}
                >
                  {area.id ? <MapPin className="size-4 shrink-0" aria-hidden="true" /> : null}
                  {area.name}
                </Link>
              );
            })}
          </nav>
        ) : null}

        {days.length === 0 ? (
          <EmptyState icon={CalendarDays} title={t("emptyTitle")}>
            {t("emptyBody")}
          </EmptyState>
        ) : (
          <ol className="flex flex-col gap-4">
            {days.map((day) => (
              <li key={day.date} className="rounded-xl border border-border bg-surface">
                <section aria-labelledby={`day-${day.date}`}>
                  <h3 id={`day-${day.date}`} className="border-b border-border px-4 py-3 font-display text-base font-semibold text-ink md:px-5">
                    {dayName(day.date)}
                  </h3>
                  {day.areas.map((group) => (
                    <div key={group.areaId} className="border-b border-border last:border-b-0">
                      <h4 className="flex items-center gap-1.5 bg-surface-sunken px-4 py-2 text-xs font-semibold text-ink-muted md:px-5">
                        <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                        {areaName(group.areaId)}
                      </h4>
                      <ul className="divide-y divide-border">
                        {group.slots.map((slot) => {
                          const window = t("window", { start: labels.time(slot.startsAt), end: labels.time(slot.endsAt) });
                          const full = slot.booked >= slot.capacity;
                          return (
                            <li
                              key={slot.id}
                              data-slot={slot.id}
                              className="grid gap-3 px-4 py-3 md:grid-cols-[9rem_minmax(0,1fr)_auto] md:items-start md:px-5"
                            >
                              <span className="pt-2.5 text-sm font-semibold whitespace-nowrap text-ink tabular-nums">{window}</span>
                              <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted md:pt-2.5">
                                <span className="tabular-nums">{t("places", { booked: slot.booked, capacity: slot.capacity })}</span>
                                {full ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-surface px-2 py-0.5 text-xs font-semibold text-warning">
                                    <CircleSlash className="size-3.5 shrink-0" aria-hidden="true" />
                                    {t("full")}
                                  </span>
                                ) : null}
                              </span>
                              <SlotRowActions
                                slotId={slot.id}
                                capacity={slot.capacity}
                                booked={slot.booked}
                                label={{ window, area: areaName(slot.areaId) }}
                                setSlotCapacity={setSlotCapacity}
                                deleteSlot={deleteSlot}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </section>
              </li>
            ))}
          </ol>
        )}
      </section>
    </ClientMessages>
  );
}
