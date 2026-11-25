"use client";

import { ArrowRight, CircleAlert, CalendarX2, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, use, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BookingBar } from "./booking-bar";
import { flowAccentButton, flowCard, flowCardTitle, flowInput } from "./flow-styles";
import { TimeChip } from "./time-chip";

// Step 1 of ordering (D5, mocks Main and Phone-Services): choose a service, then a free time in the
// area, with the summary beside them. The choice is one GET form to the order page (/pesan?layanan=
// &area=&starts=): its fields sit in the service cards and the time chips, tied to the form in the
// summary by the `form` attribute, so the page's filter form (area, search, type) stays its own form.
// The address is only a suggestion: /pesan checks every value again, and so does booking.
// The windows of each service came with the page (B12: only agencies offering that service), so a new
// service shows its own times at once; a full window stays visible as "15.00-17.00, penuh" and cannot
// be chosen (the same chip as step 2, ./time-chip.tsx). Times are Jakarta time, written by the server.
// Since the booking-flow fixes (2026-11-16) "Pesan sekarang" is never disabled: pressed without a
// service, it says so next to the services and puts the cursor on the first one. "Ubah" on step 2
// comes back here with the service, area and time in the address (?layanan=&area=&starts=).
// On phones the times sit under the whole list of services, so a service tapped there scrolls the page
// on to "Jam kosong" (2026-11-20, UX audit item 6). Only a tap or click does: arrowing through the
// radio group with the keyboard, or a screen reader, keeps its place.

export type StepWindow = { startsAt: string; start: string; end: string; isFull: boolean };
export type StepDay = {
  date: string;
  /** "Besok, Senin 16 November": the chips' group and the summary. */
  label: string;
  /** "Besok, Sen 16 Nov": the day select and the phone bar. */
  short: string;
  windows: StepWindow[];
  hasFree: boolean;
};
export type StepService = { id: string; name: string; price: string; duration: string };

type StepState = {
  formId: string;
  serviceId: string;
  setServiceId: (id: string) => void;
  startsAt: string | null;
  setStartsAt: (startsAt: string | null) => void;
  /** Counts the presses of "Pesan sekarang" without a service, so the message is announced each time. */
  missing: number;
  setMissing: (count: number) => void;
};

const StepContext = createContext<StepState | null>(null);

function useStep(): StepState {
  const state = use(StepContext);
  if (!state) throw new Error("A step 1 field must sit inside ServiceStepProvider.");
  return state;
}

type ProviderProps = {
  formId: string;
  initialServiceId: string;
  /** The time in the address (back from step 2 with "Ubah"); kept only when it is free for the service. */
  initialStartsAt?: string;
  /** Each service's windows (key ""), or null when they could not be read. */
  windows: Record<string, StepDay[] | null>;
  children: ReactNode;
};

const isFreeFor = (days: StepDay[] | null | undefined, startsAt: string | null | undefined) =>
  Boolean(startsAt) && (days ?? []).some((day) => day.windows.some((window) => window.startsAt === startsAt && !window.isFull));

export function ServiceStepProvider({ formId, initialServiceId, initialStartsAt, windows, children }: ProviderProps) {
  const [serviceId, setServiceIdState] = useState(initialServiceId);
  const [startsAt, setStartsAt] = useState<string | null>(() =>
    initialServiceId && isFreeFor(windows[initialServiceId], initialStartsAt) ? (initialStartsAt ?? null) : null,
  );
  const [missing, setMissing] = useState(0);

  // A new service keeps the chosen time only when that service has it free too.
  function setServiceId(id: string) {
    setServiceIdState(id);
    if (!isFreeFor(windows[id], startsAt)) setStartsAt(null);
  }

  return (
    <StepContext value={{ formId, serviceId, setServiceId, startsAt, setStartsAt, missing, setMissing }}>{children}</StepContext>
  );
}

/** The id of the message beside the services when "Pesan sekarang" was pressed without one. */
const missingId = "layanan-belum-dipilih";

/**
 * The service cards as one radio group, named by the list's heading. Pressed "Pesan sekarang" without
 * a service, the group says so under the heading and is described by that message.
 */
export function ServiceRadioGroup({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  const t = useTranslations("ServiceStep");
  const { serviceId, missing } = useStep();
  const showMissing = missing > 0 && !serviceId;
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-describedby={showMissing ? missingId : undefined} className="mt-3">
      <div role="alert" aria-atomic="true">
        {showMissing ? (
          <p key={missing} id={missingId} className="mb-3 flex items-start gap-2 rounded-sm bg-danger-surface px-4 py-3 text-sm font-medium text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t("serviceMissing")}</span>
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** The id of the "Jam kosong" section, the target of the scroll after a service is tapped on a phone. */
const windowsSectionId = "pilih-jam";
const phoneQuery = "(max-width: 47.9375rem)";

/** On a phone, brings the times into view once the chosen card has rendered (smooth unless reduced motion). */
function scrollToWindows() {
  if (typeof window === "undefined" || !window.matchMedia(phoneQuery).matches) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() =>
    document.getElementById(windowsSectionId)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }),
  );
}

/**
 * The service card's radio: invisible over the whole card (the card is the target), named by the
 * card's heading and described by its price and duration. The card shows the choice with its fill,
 * its radio dot and a check, never by colour alone.
 */
export function ServiceRadio({ serviceId, labelledBy, describedBy }: { serviceId: string; labelledBy: string; describedBy: string }) {
  const { formId, serviceId: chosen, setServiceId } = useStep();
  // Set by a pointer press on the card, so only a tap or click (not the arrow keys) scrolls on.
  const pointer = useRef(false);
  return (
    <input
      type="radio"
      name="layanan"
      form={formId}
      value={serviceId}
      checked={chosen === serviceId}
      onPointerDown={() => {
        pointer.current = true;
      }}
      onKeyDown={() => {
        pointer.current = false;
      }}
      onChange={() => {
        setServiceId(serviceId);
        if (pointer.current) scrollToWindows();
        pointer.current = false;
      }}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="absolute inset-0 z-0 size-full cursor-pointer appearance-none rounded-lg opacity-0"
    />
  );
}

type WindowsProps = {
  windows: Record<string, StepDay[] | null>;
  services: StepService[];
  areaName: string;
  lookAheadDays: number;
};

/** "Jam kosong": the day as a native select, that day's times as chips. */
export function WindowChooser({ windows, services, areaName, lookAheadDays }: WindowsProps) {
  const t = useTranslations("ServiceStep");
  const { formId, serviceId, startsAt, setStartsAt } = useStep();
  const days = windows[serviceId] ?? (serviceId ? null : windows[""]);
  const service = services.find((candidate) => candidate.id === serviceId);
  const firstFree = days?.find((day) => day.hasFree) ?? days?.[0];
  // The chosen time's day opens first (back from step 2), otherwise the first day with a free time.
  const [chosenDate, setChosenDate] = useState<string | null>(
    () => days?.find((candidate) => candidate.windows.some((window) => window.startsAt === startsAt))?.date ?? null,
  );
  const day = days?.find((candidate) => candidate.date === chosenDate) ?? firstFree;

  return (
    <section id={windowsSectionId} aria-labelledby="jam-kosong" className={`${flowCard} scroll-mt-4`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="jam-kosong" className={flowCardTitle}>
            {t("windowsTitle", { area: areaName })}
          </h2>
          <p className="text-sm text-ink-muted">{service ? t("windowsLead", { duration: service.duration }) : t("windowsLeadNoService")}</p>
        </div>
        {days && days.length > 0 && day ? (
          <div className="flex shrink-0 flex-col gap-1.5 md:w-80">
            <label htmlFor="tanggal" className="text-xs font-medium text-ink-muted">
              {t("dayLabel")}
            </label>
            <span className="relative flex">
              <select
                id="tanggal"
                value={day.date}
                onChange={(event) => {
                  setChosenDate(event.target.value);
                  setStartsAt(null);
                }}
                className={`${flowInput} h-12 cursor-pointer appearance-none pr-11`}
              >
                {days.map((option) => (
                  <option key={option.date} value={option.date}>
                    {option.hasFree ? option.short : t("dayFull", { day: option.short })}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            </span>
          </div>
        ) : null}
      </div>

      {days === null ? (
        <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{t("windowsError")}</span>
        </p>
      ) : days.length === 0 || !day ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-ink-muted">
          <CalendarX2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{t("windowsEmpty", { area: areaName, days: lookAheadDays })}</span>
        </p>
      ) : (
        <fieldset className="mt-4 min-w-0">
          <legend className="sr-only">{t("chipsLegend", { day: day.label })}</legend>
          <div className="flex flex-wrap gap-2.5">
            {day.windows.map((window) => (
              <TimeChip
                key={window.startsAt}
                name="starts"
                form={formId}
                value={window.startsAt}
                start={window.start}
                end={window.end}
                full={window.isFull}
                checked={window.startsAt === startsAt}
                onChange={() => setStartsAt(window.startsAt)}
              />
            ))}
          </div>
          <p className="mt-3 text-sm text-ink-muted">{t("timeNote")}</p>
        </fieldset>
      )}
    </section>
  );
}

type SummaryProps = {
  action: string;
  areaId: string;
  areaName: string;
  services: StepService[];
  windows: Record<string, StepDay[] | null>;
  /** A signed-in customer needs no "no account needed". */
  signedIn: boolean;
};

const submitId = "pilih-layanan-kirim";

/** "Ringkasan": what is chosen so far, the full price and "Pesan sekarang" (the step's one form). */
export function StepSummary({ action, areaId, areaName, services, windows, signedIn }: SummaryProps) {
  const t = useTranslations("ServiceStep");
  const { formId, serviceId, startsAt, missing, setMissing } = useStep();
  const service = services.find((candidate) => candidate.id === serviceId);
  const day = (windows[serviceId] ?? []).find((candidate) => candidate.windows.some((window) => window.startsAt === startsAt));
  const window = day?.windows.find((candidate) => candidate.startsAt === startsAt);

  // Without a service there is nothing to order yet: say so by the services and go there.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (service) return;
    event.preventDefault();
    setMissing(missing + 1);
    const first =
      document.querySelector<HTMLInputElement>(`input[name="layanan"][form="${formId}"]:checked`) ??
      document.querySelector<HTMLInputElement>(`input[name="layanan"][form="${formId}"]`);
    first?.focus();
    first?.scrollIntoView({ block: "center" });
  }

  const button = (id: string | undefined, compact: boolean) => (
    <button
      id={id}
      type="submit"
      form={formId}
      aria-describedby={service ? "langkah-berikut" : "pilih-layanan-dulu"}
      className={`${flowAccentButton} ${compact ? "min-h-12 shrink-0 px-4 text-sm" : "mt-5 w-full"}`}
    >
      {t("submit")}
      {compact ? null : <ArrowRight className="size-5 shrink-0" aria-hidden="true" />}
    </button>
  );

  return (
    <>
      <form id={formId} method="get" action={action} onSubmit={onSubmit} aria-labelledby="ringkasan" className={`${flowCard} flex flex-col`}>
        <input type="hidden" name="area" value={areaId} />
        <h2 id="ringkasan" className={flowCardTitle}>
          {t("summaryTitle")}
        </h2>
        <dl className="mt-4 flex flex-col gap-3 border-b border-border pb-4 text-sm">
          <SummaryRow term={t("summaryService")}>{service?.name ?? <Missing>{t("summaryNoService")}</Missing>}</SummaryRow>
          <SummaryRow term={t("summaryArea")}>{areaName}</SummaryRow>
          <SummaryRow term={t("summarySchedule")}>
            {day && window ? (
              <>
                {day.label}
                <br />
                <span className="whitespace-nowrap">{t("summaryWindow", { start: window.start, end: window.end })}</span>
              </>
            ) : (
              <Missing>{t("summaryNoWindow")}</Missing>
            )}
          </SummaryRow>
        </dl>
        {/* One live region with its label, so a screen reader hears "Total Rp 85.000", not a bare price. */}
        <div aria-live="polite" aria-atomic="true" className="mt-4 flex items-baseline justify-between gap-4">
          <p className="text-base font-semibold text-ink">{t("total")}</p>
          <p className="font-display text-price font-semibold whitespace-nowrap text-ink tabular-nums">{service?.price ?? ""}</p>
        </div>
        <p className="mt-2 text-sm text-ink-muted">{t("totalNote")}</p>
        {button(submitId, false)}
        {service ? null : (
          <p id="pilih-layanan-dulu" className="mt-2 text-center text-sm text-ink-muted">
            {t("chooseServiceFirst")}
          </p>
        )}
        <p id="langkah-berikut" className="mt-3 text-sm text-ink-muted">
          {signedIn ? t("nextNoteSignedIn") : t("nextNote")}
        </p>
      </form>
      <BookingBar
        watchId={submitId}
        title={service?.name ?? t("barNoService")}
        price={service?.price}
        detail={day && window ? day.short : t("barNoTime")}
        time={day && window ? t("barWindow", { start: window.start, end: window.end }) : undefined}
        action={button(undefined, true)}
      />
    </>
  );
}

function SummaryRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-ink-muted">{term}</dt>
      <dd className="text-right font-semibold text-ink tabular-nums">{children}</dd>
    </div>
  );
}

function Missing({ children }: { children: ReactNode }) {
  return <span className="font-normal text-ink-muted">{children}</span>;
}
