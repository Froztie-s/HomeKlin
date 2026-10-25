"use client";

import { CalendarClock, Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Link } from "@/i18n/navigation";
import { FieldError } from "./booking-controls";

/** One day of free windows, written on the server in Jakarta time. */
export type BookingDay = {
  /** YYYY-MM-DD in Jakarta. */
  date: string;
  /** "Senin, 9 November", "Besok, Jumat 6 November". */
  label: string;
  windows: { startsAt: string; label: string }[];
};

type WindowPickerProps = {
  areaName: string;
  /** The area's free windows, by day. */
  days: BookingDay[];
  /** The chosen window as it is written, or null when none is chosen. */
  selected: { dayLabel: string; windowLabel: string } | null;
  startsAt: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (startsAt: string) => void;
  disabled: boolean;
  error?: string;
  servicesHref: string;
  /** Offer the way back to the services (when the chosen window was taken). */
  showBackLink: boolean;
};

// The arrival window of a booking: the chosen one up front, in large type, and the area's other free
// windows one tap away ("Ganti jadwal"), by day, as radio buttons named `startsAt` (the value is the
// window's start exactly as the catalog gave it). The list stays in the form when it is closed, so the
// chosen window is always sent. Times are Jakarta time, written by the server.
export function WindowPicker({
  areaName,
  days,
  selected,
  startsAt,
  open,
  onOpenChange,
  onChoose,
  disabled,
  error,
  servicesHref,
  showBackLink,
}: WindowPickerProps) {
  const t = useTranslations("Booking");
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <>
      <div
        role="group"
        aria-labelledby="booking-window-title"
        aria-describedby="booking-window-note"
        className="mt-3 flex items-start gap-3"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <CalendarClock className="size-5" aria-hidden="true" />
        </span>
        {selected ? (
          <p className="flex min-w-0 flex-col">
            <span className="text-base font-semibold text-ink">{selected.dayLabel}</span>
            <span className="text-sm text-ink-muted tabular-nums">{t("windowValue", { window: selected.windowLabel })}</span>
          </p>
        ) : (
          <p className="flex min-w-0 flex-col">
            <span className="text-base font-semibold text-ink">{t("noWindow")}</span>
            <span className="text-sm text-ink-muted">{t("noWindowHint")}</span>
          </p>
        )}
      </div>
      <div className="mt-2">
        <FieldError id="booking-window-error" message={error} />
      </div>
      <p id="booking-window-note" className="mt-2 text-sm text-ink-faint">
        {t("arrivalNote")}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-x-2">
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls="booking-windows"
          onClick={() => onOpenChange(!open)}
          className="-ml-3 inline-flex min-h-touch items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:bg-brand-50 hover:text-brand-800 active:bg-brand-100"
        >
          <ChevronDown
            className={`size-4 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
          {t("changeWindow")}
        </button>
        {showBackLink ? (
          <Link
            href={servicesHref}
            className="inline-flex min-h-touch items-center rounded-full px-3 text-sm font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:bg-brand-50 hover:text-brand-800 active:bg-brand-100"
          >
            {t("backToServices")}
          </Link>
        ) : null}
      </div>

      <fieldset id="booking-windows" hidden={!open} disabled={disabled} className="mt-3 min-w-0">
        <legend className="sr-only">{t("windowsLegend", { area: areaName })}</legend>
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {days.map((day) => (
            <div key={day.date} role="group" aria-labelledby={`booking-day-${day.date}`}>
              <h3 id={`booking-day-${day.date}`} className="text-sm font-semibold text-ink">
                {day.label}
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {day.windows.map((window) => (
                  <label
                    key={window.startsAt}
                    className="relative flex min-h-touch cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-control bg-surface px-3 text-sm text-ink tabular-nums transition-colors duration-150 ease-out-quart hover:border-brand-600 hover:bg-brand-50 active:bg-brand-100 has-checked:border-brand-600 has-checked:bg-brand-600 has-checked:font-semibold has-checked:text-on-brand has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus has-disabled:cursor-not-allowed has-disabled:opacity-60"
                  >
                    <input
                      type="radio"
                      name="startsAt"
                      value={window.startsAt}
                      checked={window.startsAt === startsAt}
                      onChange={() => onChoose(window.startsAt)}
                      onClick={(event) => {
                        // A tap or a click picks and closes the long list, back on the choice; arrow
                        // keys (a click without a pointer, detail 0) only move the choice.
                        if (event.detail === 0) return;
                        onOpenChange(false);
                        toggle.current?.focus();
                      }}
                      aria-describedby={error ? "booking-window-error" : undefined}
                      className="peer absolute inset-0 z-10 size-full cursor-pointer appearance-none rounded-md opacity-0 disabled:cursor-not-allowed"
                    />
                    <Check className="hidden size-4 shrink-0 peer-checked:block" strokeWidth={2.5} aria-hidden="true" />
                    {window.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
    </>
  );
}
