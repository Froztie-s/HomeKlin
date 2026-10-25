"use client";

import { ArrowRight, CircleAlert, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { bookService, type BookingFormState } from "@/lib/booking/actions";
import { searchWithStarts } from "./booking-query";
import { ConsentSwitch, FieldError } from "./booking-controls";
import { WindowPicker } from "./booking-window-picker";

/** One day of free windows, written on the server in Jakarta time. */
export type BookingDay = {
  /** YYYY-MM-DD in Jakarta. */
  date: string;
  /** "Senin, 9 November", "Besok, Jumat 6 November". */
  label: string;
  windows: { startsAt: string; label: string }[];
};

type BookingFormProps = {
  serviceId: string;
  /** The service's name in the page's language, repeated next to the button. */
  serviceName: string;
  areaId: string;
  areaName: string;
  days: BookingDay[];
  /** The window from the address when it is still free; null makes the customer choose one. */
  initialStartsAt: string | null;
  /** Said when the window in the address is gone ("Jumat, 6 November pukul 15.00 WIB sudah terisi..."). */
  takenNotice: string | null;
  /** Back to the services list of the area. */
  servicesHref: string;
  /** The full price, formatted ("Rp 85.000"). */
  price: string;
  /** The chosen service and area, rendered on the server. */
  summary: ReactNode;
};

const card = "rounded-xl border border-border bg-surface p-4 shadow-card md:p-5";
const sectionTitle = "font-display text-lg font-semibold text-ink";

// The booking form (T9): the service (summary, from the server), the arrival window, the address and
// the streaming consent, posted to bookService (src/lib/booking/actions.ts), which checks the role and
// every field on the server and either books (and opens the confirmation on /orders) or says what to
// fix: each field's problem next to it, the cursor in the first one, anything else in a live region.
// The submit button stays off until the consent is on, but that is only a hint; the server refuses a
// booking without it. When another customer takes the last place of the window first, the form says
// so where the windows are, takes that window off the list and opens the others; the address and the
// consent stay as they were. The chosen window also goes into the address (?starts=), so a reload
// keeps it. Sources: node_modules/next/dist/docs/01-app/02-guides/forms.md ("Validation errors",
// "Pending states"), https://react.dev/reference/react/useActionState and
// node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md ("Native History API")
export function BookingForm(props: BookingFormProps) {
  const { serviceId, serviceName, areaId, areaName, days, initialStartsAt, takenNotice, servicesHref, price, summary } =
    props;
  const t = useTranslations("Booking");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<BookingFormState, FormData>(bookService, null);
  const [startsAt, setStartsAt] = useState(initialStartsAt);
  const [consent, setConsent] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(initialStartsAt === null);
  const [taken, setTaken] = useState<readonly string[]>([]);
  const [answers, setAnswers] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const windowAlert = useRef<HTMLDivElement>(null);

  // Each answer from the server, handled once while rendering (React's way to adjust state to a new
  // value: https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    setAnswers(answers + 1);
    if (state?.formError === "slotUnavailable" && startsAt) {
      setTaken([...taken, startsAt]);
      setStartsAt(null);
      setPickerOpen(true);
    }
    if (state?.fieldErrors?.startsAt) setPickerOpen(true);
  }

  // After an answer: to the windows when the window was just taken, otherwise to the first field to
  // fix (the windows come first on the page, then the address, then the consent).
  useEffect(() => {
    if (state?.formError === "slotUnavailable") windowAlert.current?.focus();
    else if (state?.fieldErrors?.startsAt) form.current?.querySelector<HTMLElement>('input[name="startsAt"]')?.focus();
    else if (state?.fieldErrors) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  const freeDays = days
    .map((day) => ({ ...day, windows: day.windows.filter((window) => !taken.includes(window.startsAt)) }))
    .filter((day) => day.windows.length > 0);
  const selected = freeDays.flatMap((day) => day.windows.map((window) => ({ day, window }))).find(
    ({ window }) => window.startsAt === startsAt,
  );
  const justTaken = state?.formError === "slotUnavailable" && startsAt === null;
  const showTakenNotice = takenNotice !== null && startsAt === null && !justTaken;

  const errors = state?.fieldErrors ?? {};
  const errorOf = (field: keyof typeof errors) => {
    const key = errors[field];
    return key ? t(`errors.${key}`) : undefined;
  };
  // The hidden fields (service, area) have no place on screen, so their problems join the form's message.
  const hiddenFieldError = errorOf("serviceId") ?? errorOf("areaId");
  const errorCount = Object.keys(errors).length;
  const formMessage =
    state?.formError && state.formError !== "slotUnavailable"
      ? t(`formErrors.${state.formError}`)
      : (hiddenFieldError ?? (errorCount > 0 ? t("errorSummary", { count: errorCount }) : undefined));

  // React resets a form after its action (https://react.dev/reference/react-dom/components/form), which
  // would switch the consent off and empty the address after every refusal. Sending the form from
  // here, inside a transition, keeps what the customer entered; without JavaScript the form still
  // posts to the action.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  function choose(next: string) {
    setStartsAt(next);
    // Keeps the choice in the address without a new request (Next.js syncs its router with it).
    window.history.replaceState(null, "", `${window.location.pathname}${searchWithStarts(window.location.search, next)}`);
  }

  const addressError = errorOf("address");
  const submitBlocked = !consent;

  return (
    <form
      ref={form}
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      aria-label={t("formLabel")}
      className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start md:gap-6"
    >
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="areaId" value={areaId} />
      <input type="hidden" name="locale" value={locale} />

      <div className="md:col-start-1">{summary}</div>

      <section aria-labelledby="booking-window-title" className={`${card} md:col-start-1`}>
        <h2 id="booking-window-title" className={sectionTitle}>
          {t("windowTitle")}
        </h2>

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
        {showTakenNotice ? (
          <div className="mt-3 flex items-start gap-3 rounded-md bg-warning-surface px-4 py-3 text-sm text-ink">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <h3 className="font-semibold">{t("takenTitle")}</h3>
              <p className="mt-1">{takenNotice}</p>
            </div>
          </div>
        ) : null}

        <WindowPicker
          areaName={areaName}
          days={freeDays}
          selected={selected ? { dayLabel: selected.day.label, windowLabel: selected.window.label } : null}
          startsAt={startsAt}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onChoose={choose}
          disabled={pending}
          error={errorOf("startsAt")}
          servicesHref={servicesHref}
          showBackLink={showTakenNotice || justTaken}
        />
      </section>

      <section aria-labelledby="booking-address-title" className={`${card} md:col-start-1`}>
        <h2 id="booking-address-title" className={sectionTitle}>
          {t("addressTitle")}
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor="booking-address" className="px-1 text-sm font-medium text-ink">
            {t("addressLabel")}
          </label>
          <textarea
            id="booking-address"
            name="address"
            rows={3}
            autoComplete="street-address"
            defaultValue={state?.values?.address ?? ""}
            aria-invalid={addressError ? true : undefined}
            aria-describedby={addressError ? "booking-address-hint booking-address-error" : "booking-address-hint"}
            className="w-full resize-y rounded-md border border-border-control bg-surface px-4 py-3 text-base text-ink caret-brand-700 transition-colors duration-150 ease-out-quart hover:border-brand-600 aria-invalid:border-danger aria-invalid:bg-danger-surface"
          />
          <p id="booking-address-hint" className="px-1 text-sm text-ink-faint">
            {t("addressHint")}
          </p>
          <FieldError id="booking-address-error" message={addressError} />
        </div>
      </section>

      <section aria-labelledby="booking-stream-title" className={`${card} md:col-start-1`}>
        <h2 id="booking-stream-title" className={sectionTitle}>
          {t("streamTitle")}
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-ink-muted">
          {(["phone", "viewers", "recording"] as const).map((fact) => (
            <li key={fact} className="flex items-start gap-2.5">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
              <span>{t(`streamFacts.${fact}`)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-border pt-4">
          <ConsentSwitch
            id="booking-consent"
            label={t("consentLabel")}
            checked={consent}
            onChange={setConsent}
            error={errorOf("consent")}
          />
        </div>
      </section>

      <div className={`${card} md:sticky md:top-6 md:col-start-2 md:row-span-4 md:row-start-1`}>
        {/* What the button books, in one glance: the service and the chosen window. */}
        <div className="border-b border-border pb-4">
          <p className="text-base font-semibold text-ink">{serviceName}</p>
          <p className="mt-0.5 text-sm text-ink-muted tabular-nums">
            {selected
              ? `${selected.day.label}, ${t("windowValue", { window: selected.window.label })}`
              : t("noWindow")}
          </p>
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium text-ink-muted">{t("totalLabel")}</p>
          <p className="font-display text-2xl font-semibold whitespace-nowrap text-ink tabular-nums">{price}</p>
        </div>
        <p className="mt-1 text-sm text-ink-faint">{t("totalNote")}</p>

        <div role="alert" aria-atomic="true">
          {formMessage ? (
            <p key={answers} className="mt-4 flex items-start gap-2.5 rounded-md bg-danger-surface px-4 py-3 text-sm font-medium text-danger">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{formMessage}</span>
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={submitBlocked || pending}
          aria-describedby={submitBlocked ? "booking-submit-hint" : undefined}
          className={`mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-[background-color,color,transform] duration-150 ease-out-quart ${
            pending
              ? "cursor-progress bg-brand-700 text-on-brand"
              : "bg-brand-600 text-on-brand hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted disabled:active:scale-100"
          }`}
        >
          {pending ? <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden="true" /> : null}
          {pending ? t("pending") : t("submit")}
          {pending ? null : <ArrowRight className="size-5 shrink-0" aria-hidden="true" />}
        </button>
        {submitBlocked ? (
          <p id="booking-submit-hint" className="mt-2 text-center text-sm text-ink-muted">
            {t("submitHint")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
