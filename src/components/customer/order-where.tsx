"use client";

import { CalendarX2, ChevronDown, CircleAlert, MapPin, MapPinOff, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import { FieldError, orderInputClass } from "./booking-controls";
import { WindowPicker, type BookingDay } from "./booking-window-picker";
import type { OrderArea } from "./order-form";

type OrderWhereProps = {
  areas: OrderArea[];
  area: OrderArea;
  /** The area's free windows, without any taken while the page was open. */
  freeDays: BookingDay[];
  selected: { dayLabel: string; windowLabel: string } | null;
  startsAt: string | null;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onChooseArea: (areaId: string) => void;
  onChooseWindow: (startsAt: string) => void;
  disabled: boolean;
  areaError?: string;
  windowError?: string;
  /** The chosen window was just taken by someone else. */
  justTaken: boolean;
  /** Changes with every answer, so the same notice is announced again. */
  answers: number;
  /** The window in the address is gone ("Jumat, 6 November pukul 15.00 WIB sudah terisi..."). */
  takenNotice: string | null;
  lookAheadDays: number;
  windowAlert: RefObject<HTMLDivElement | null>;
};

const sectionTitle = "font-display text-lg font-semibold text-ink";

// Where and when (T9b): the service area first, because it decides which free windows exist, then the
// area's free arrival windows (the T9 picker, Jakarta time). Every area's windows came with the page,
// so a new area shows its own at once; one HomeKlin does not serve, or one with every window taken,
// says so here and the customer picks another area above.
export function OrderWhere({
  areas,
  area,
  freeDays,
  selected,
  startsAt,
  pickerOpen,
  onPickerOpenChange,
  onChooseArea,
  onChooseWindow,
  disabled,
  areaError,
  windowError,
  justTaken,
  answers,
  takenNotice,
  lookAheadDays,
  windowAlert,
}: OrderWhereProps) {
  const t = useTranslations("Booking");
  const tOrder = useTranslations("Order");

  let state: { icon: LucideIcon; title: string; body: string; retry?: boolean } | null = null;
  if (!area.served) state = { icon: MapPinOff, title: tOrder("unservedTitle", { area: area.name }), body: tOrder("unservedBody") };
  else if (area.days === null)
    state = { icon: CircleAlert, title: tOrder("slotsErrorTitle", { area: area.name }), body: tOrder("slotsErrorBody"), retry: true };
  else if (freeDays.length === 0 && !justTaken)
    state = {
      icon: CalendarX2,
      title: tOrder("fullTitle", { area: area.name }),
      body: tOrder("fullBody", { days: lookAheadDays }),
    };

  return (
    <section aria-labelledby="order-where-title" className="rounded-xl border border-border bg-surface p-4 shadow-card md:p-5">
      <h2 id="order-where-title" className={sectionTitle}>
        {tOrder("whereTitle")}
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        <label htmlFor="order-area" className="px-1 text-sm font-medium text-ink">
          {tOrder("areaLabel")}
        </label>
        <span className="relative flex">
          <MapPin className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-brand-700" aria-hidden="true" />
          <select
            id="order-area"
            name="areaId"
            value={area.id}
            onChange={(event) => onChooseArea(event.target.value)}
            aria-invalid={areaError ? true : undefined}
            aria-describedby={areaError ? "order-area-error" : undefined}
            className={`${orderInputClass} h-12 cursor-pointer appearance-none pr-11 pl-10 font-semibold`}
          >
            {areas.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
        </span>
        <FieldError id="order-area-error" message={areaError} />
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h3 id="booking-window-title" className="text-base font-semibold text-ink">
          {t("windowTitle")}
        </h3>

        {/* Always on the page, so a screen reader announces what is put into it. */}
        <div ref={windowAlert} role="alert" aria-atomic="true" tabIndex={-1} className="rounded-md outline-offset-4">
          {justTaken ? (
            <div key={answers} className="mt-3 flex items-start gap-3 rounded-md bg-warning-surface px-4 py-3 text-sm text-ink">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
              <div>
                <p className="font-semibold">{t("justTakenTitle")}</p>
                <p className="mt-1">{t("formErrors.slotUnavailable")}</p>
              </div>
            </div>
          ) : null}
        </div>
        {takenNotice && !state ? (
          <div className="mt-3 flex items-start gap-3 rounded-md bg-warning-surface px-4 py-3 text-sm text-ink">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <h4 className="font-semibold">{t("takenTitle")}</h4>
              <p className="mt-1">{takenNotice}</p>
            </div>
          </div>
        ) : null}

        {state ? (
          <div className="mt-3 flex items-start gap-3 rounded-md bg-surface-sunken px-4 py-3 text-sm text-ink">
            <state.icon className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden="true" />
            <div>
              <p className="font-semibold">{state.title}</p>
              <p className="mt-1 text-ink-muted">{state.body}</p>
              {state.retry ? (
                // A plain link on purpose: a full page load reads the windows again.
                <a
                  href=""
                  className="-mx-2 mt-1 inline-flex min-h-touch items-center rounded-full px-2 font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-800 active:bg-brand-100"
                >
                  {tOrder("retry")}
                </a>
              ) : null}
            </div>
            <input type="hidden" name="startsAt" value="" />
          </div>
        ) : (
          <WindowPicker
            areaName={area.name}
            days={freeDays}
            selected={selected}
            startsAt={startsAt}
            open={pickerOpen}
            onOpenChange={onPickerOpenChange}
            onChoose={onChooseWindow}
            disabled={disabled}
            error={windowError}
            servicesHref="/services"
            showBackLink={false}
          />
        )}
        {state ? <FieldError id="booking-window-error" message={windowError} /> : null}
      </div>
    </section>
  );
}
