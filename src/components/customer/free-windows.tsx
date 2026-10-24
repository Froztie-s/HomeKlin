import { CalendarClock, CalendarX2, ChevronDown, CircleAlert, LoaderCircle } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { listFreeSlots, type FreeSlot } from "@/lib/catalog/catalog";
import { formatJakartaDay, formatJakartaTime, groupSlotsByJakartaDay, type SlotDay } from "@/lib/catalog/slots-days";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// The free arrival windows of the chosen area on /services: the earliest one up front, every one of
// the next two weeks one tap away (a native <details>, so it opens without JavaScript), grouped by day
// and written in Jakarta time whatever the browser's time zone (the server writes them).
// Free slots change with every booking (T9), so they are read at request time, never cached
// (connection() keeps them out of every prerender), behind the <Suspense> of the page with
// FreeWindowsSkeleton as the fallback. The windows are combined over everyone serving the area: the
// customer sees times, never who provides them (markdown/PRODUCT.md principle 6).

/** How far ahead the page looks for free windows. */
export const freeWindowDays = 14;

export async function FreeWindows({ areaId, areaName }: { areaId: string; areaName: string }) {
  await connection();
  const [t, locale] = await Promise.all([getTranslations("FreeWindows"), getLocale()]);
  const now = new Date();

  const dayLabel = (day: SlotDay) => {
    const parts = formatJakartaDay(day.date, locale);
    if (day.relative === "today") return t("today", parts);
    if (day.relative === "tomorrow") return t("tomorrow", parts);
    return t("day", parts);
  };
  const windowLabel = (slot: FreeSlot) =>
    t("window", { start: formatJakartaTime(slot.startsAt, locale), end: formatJakartaTime(slot.endsAt, locale) });

  let slots: FreeSlot[];
  try {
    slots = await listFreeSlots(createSupabasePublicClient(), areaId, { days: freeWindowDays, now });
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return (
      <p role="alert" className="flex items-start gap-2 text-sm text-danger">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{t("errorBody")}</span>
      </p>
    );
  }

  const days = groupSlotsByJakartaDay(slots, now);
  if (days.length === 0) {
    return (
      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <CalendarX2 className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
        <span>{t("fullBody", { area: areaName, days: freeWindowDays })}</span>
      </p>
    );
  }

  const [first] = days;
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <CalendarClock className="size-5" aria-hidden="true" />
        </span>
        <p className="flex min-w-0 flex-col">
          <span className="text-xs font-medium text-ink-faint">{t("nearest")}</span>
          <span className="text-base font-semibold text-ink">{dayLabel(first)}</span>
          <span className="text-sm text-ink-muted tabular-nums">
            {t("inJakartaTime", { time: windowLabel(first.windows[0]) })}
          </span>
        </p>
      </div>

      <details className="group/days mt-2">
        <summary className="-ml-3 inline-flex min-h-touch cursor-pointer list-none items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:bg-brand-50 hover:text-brand-800 active:bg-brand-100 [&::-webkit-details-marker]:hidden">
          <ChevronDown
            className="size-4 shrink-0 transition-transform duration-150 group-open/days:rotate-180"
            aria-hidden="true"
          />
          {t("showAll")}
        </summary>
        <ol className="mt-3 grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {days.map((day) => (
            <li key={day.date}>
              <h3 className="text-sm font-semibold text-ink">{dayLabel(day)}</h3>
              <ul className="mt-2 grid grid-cols-2 gap-2">
                {day.windows.map((slot) => (
                  <li
                    key={slot.startsAt}
                    className="rounded-md bg-surface-sunken px-3 py-2 text-center text-sm text-ink tabular-nums"
                  >
                    {windowLabel(slot)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-ink-faint">{t("timeNote")}</p>
      </details>
    </div>
  );
}

/** The windows' place while they load: the same height as the earliest-window line and its toggle. */
export function FreeWindowsSkeleton({ label }: { label: string }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="size-10 shrink-0 rounded-full bg-surface-sunken" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
          <span className="h-3.5 w-20 rounded-full bg-surface-sunken" aria-hidden="true" />
          <p role="status" className="flex items-center gap-2 text-sm text-ink-faint">
            <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            {label}
          </p>
          <span className="h-4 w-28 rounded-full bg-surface-sunken" aria-hidden="true" />
        </div>
      </div>
      <span className="mt-2 block h-11 w-48 max-w-full" aria-hidden="true" />
    </div>
  );
}
