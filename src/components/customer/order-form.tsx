"use client";

import { ArrowRight, ChevronDown, CircleAlert, LoaderCircle, UserRoundCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CodeEntry } from "@/components/auth/code-entry";
import { bookService, placeOrder, sendOrderCode, type BookingFormState } from "@/lib/booking/actions";
import { ConsentSwitch, FieldError, OrderField, orderInputClass } from "./booking-controls";
import { OrderWhere } from "./order-where";
import type { BookingDay } from "./booking-window-picker";
import { orderSearch } from "./order-query";
import { intentFor, viewAfter, type OrderIntent, type OrderView } from "./order-steps";

/** An area as the order form shows it; days is null when its windows could not be read. */
export type OrderArea = { id: string; name: string; served: boolean; days: BookingDay[] | null };

type OrderFormProps = {
  services: { id: string; name: string; price: string }[];
  /** Each service at a glance, rendered on the server. */
  summaries: Record<string, ReactNode>;
  areas: OrderArea[];
  /** The service from the address, or null to make the customer choose one. */
  initialServiceId: string | null;
  /** The address named a service that cannot be ordered. */
  serviceUnknown: boolean;
  initialAreaId: string;
  /** The window from the address when it is still free; null makes the customer choose one. */
  initialStartsAt: string | null;
  /** Said when the window in the address is gone. */
  takenNotice: string | null;
  lookAheadDays: number;
  /** The signed-in customer (name, or email for an account without a name), or null for a guest. */
  customer: { name: string } | null;
};

type Answer = { intent: OrderIntent; state: BookingFormState } | null;

const actions = { send: sendOrderCode, resend: sendOrderCode, place: placeOrder, book: bookService } as const;

/** Calls the action of the button that sent the form; each one parses its input on the server. */
async function run(_previous: Answer, data: FormData): Promise<Answer> {
  const name = data.get("intent");
  const intent: OrderIntent = name === "resend" || name === "place" || name === "book" ? name : "send";
  return { intent, state: await actions[intent](null, data) };
}

const card = "rounded-xl border border-border bg-surface p-4 shadow-card md:p-5";
const sectionTitle = "font-display text-lg font-semibold text-ink";

// The order form (T9b): one calm flow on one page, for guests and signed-in customers alike. The
// service, the area and its free arrival windows, the address, the phone number (the cleaner's contact
// on the day), the email for a guest, and the streaming consent; then "Kirim kode" for a guest
// (sendOrderCode emails a 6-digit code) or "Pesan sekarang" for a signed-in customer (bookService).
// The code step replaces the form on the same page; every field stays in the form, hidden, so
// "Pesan sekarang" there sends the whole order with the code (placeOrder), and "Ganti email" brings
// the form back as it was. When the code was right but the order failed (the window was taken in the
// meantime), the guest is signed in now: the form says what happened and finishes with bookService.
// Every choice is checked again on the server. The form is sent from onSubmit inside a transition,
// so React does not reset it after an answer. Sources:
// node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md ("Event Handlers"),
// node_modules/next/dist/docs/01-app/02-guides/forms.md ("Validation errors", "Pending states") and
// https://react.dev/reference/react/useActionState
export function OrderForm(props: OrderFormProps) {
  const { services, summaries, areas, customer } = props;
  const t = useTranslations("Booking");
  const tOrder = useTranslations("Order");
  const locale = useLocale();
  const [answer, dispatch, pending] = useActionState(run, null);
  const [serviceId, setServiceId] = useState(props.initialServiceId ?? "");
  const [areaId, setAreaId] = useState(props.initialAreaId);
  const [startsAt, setStartsAt] = useState(props.initialStartsAt);
  const [consent, setConsent] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(props.initialStartsAt === null);
  const [taken, setTaken] = useState<readonly string[]>([]);
  const [view, setView] = useState<OrderView>({ step: "form", signedIn: false });
  const [intent, setIntent] = useState<OrderIntent>("send");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState(0);
  const [sent, setSent] = useState(0);
  const [edits, setEdits] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const windowAlert = useRef<HTMLDivElement>(null);

  // A guest who typed the right code is signed in, whether the page knows it yet or not.
  const signedIn = view.signedIn || customer !== null;
  const current: OrderView = signedIn ? { step: "form", signedIn: true } : view;
  const state = answer?.state ?? null;

  // Each answer from the server, handled once while rendering
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  const [seen, setSeen] = useState(answer);
  if (answer !== seen) {
    setSeen(answer);
    setAnswers(answers + 1);
    if (answer) {
      setView(viewAfter(current, answer.intent, answer.state));
      if (answer.state?.codeSent && (answer.intent === "send" || answer.intent === "resend")) setSent(sent + 1);
      if (answer.state?.formError === "slotUnavailable" && startsAt) {
        setTaken([...taken, startsAt]);
        setStartsAt(null);
        setPickerOpen(true);
      }
      if (answer.state?.fieldErrors?.startsAt) setPickerOpen(true);
    }
  }

  // After an answer on the form: to the windows when the window was just taken, otherwise to the
  // first field to fix. (The code step puts the cursor in the code field itself.)
  // Once per answer: a change of step alone (such as "Ganti email") must not move the cursor here.
  const handled = useRef(0);
  const step = current.step;
  useEffect(() => {
    if (handled.current === answers) return;
    handled.current = answers;
    if (!state || step !== "form") return;
    if (state.formError === "slotUnavailable") windowAlert.current?.focus();
    else if (state.fieldErrors?.startsAt) form.current?.querySelector<HTMLElement>('input[name="startsAt"]')?.focus();
    else if (state.fieldErrors) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [answers, state, step]);

  // "Ganti email": back on the form, in the email field.
  useEffect(() => {
    if (edits > 0) form.current?.querySelector<HTMLElement>('input[name="email"]')?.focus();
  }, [edits]);

  const area = areas.find((candidate) => candidate.id === areaId) ?? areas[0];
  const freeDays = (area.days ?? [])
    .map((day) => ({ ...day, windows: day.windows.filter((window) => !taken.includes(window.startsAt)) }))
    .filter((day) => day.windows.length > 0);
  const selected = freeDays
    .flatMap((day) => day.windows.map((window) => ({ day, window })))
    .find(({ window }) => window.startsAt === startsAt);
  const justTaken = state?.formError === "slotUnavailable" && startsAt === null;
  const showTakenNotice =
    props.takenNotice !== null && areaId === props.initialAreaId && startsAt === null && !justTaken;
  const service = services.find((candidate) => candidate.id === serviceId);

  const errors = state?.fieldErrors ?? {};
  const errorOf = (field: keyof typeof errors) => {
    const key = errors[field];
    return key ? t(`errors.${key}`) : undefined;
  };
  const formErrorCount = Object.keys(errors).filter((field) => field !== "code").length;
  const formMessage =
    state?.formError && state.formError !== "slotUnavailable"
      ? t(`formErrors.${state.formError}`)
      : formErrorCount > 0
        ? t("errorSummary", { count: formErrorCount })
        : undefined;

  /** Keeps the choice in the address without a new request (Next.js syncs its router with it). */
  function remember(changes: Parameters<typeof orderSearch>[1]) {
    window.history.replaceState(null, "", `${window.location.pathname}${orderSearch(window.location.search, changes)}`);
  }

  function send(chosen: OrderIntent) {
    if (!form.current) return;
    const data = new FormData(form.current);
    data.set("intent", chosen);
    setIntent(chosen);
    if (!signedIn) setEmail(String(data.get("email") ?? "").trim());
    startTransition(() => dispatch(data));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(intentFor(current));
  }

  const submitBlocked = !consent;
  const recap = (
    <div className="border-b border-border pb-4">
      <p className="text-base font-semibold text-ink">{service?.name ?? tOrder("servicePlaceholder")}</p>
      <p className="mt-0.5 text-sm text-ink-muted tabular-nums">
        {selected ? `${selected.day.label}, ${t("windowValue", { window: selected.window.label })}` : t("noWindow")}
      </p>
      <p className="mt-0.5 text-sm text-ink-muted">{area.name}</p>
    </div>
  );
  const alert = (
    <div role="alert" aria-atomic="true">
      {formMessage ? (
        <p
          key={answers}
          className="mt-4 flex items-start gap-2.5 rounded-md bg-danger-surface px-4 py-3 text-sm font-medium text-danger"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{formMessage}</span>
        </p>
      ) : null}
    </div>
  );

  return (
    <form
      ref={form}
      action={dispatch}
      onSubmit={onSubmit}
      noValidate
      aria-label={t("formLabel")}
      className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start md:gap-6"
    >
      <input type="hidden" name="locale" value={locale} />

      {/* The order. On the code step it stays in the form, hidden, so the code is sent with it. */}
      <div hidden={current.step === "code"} className="md:col-start-1">
        <div className="flex flex-col gap-4">
          <section aria-labelledby="order-service-title" className={card}>
            <h2 id="order-service-title" className={sectionTitle}>
              {tOrder("serviceTitle")}
            </h2>
            {props.serviceUnknown && !serviceId ? (
              <p className="mt-3 flex items-start gap-3 rounded-md bg-warning-surface px-4 py-3 text-sm text-ink">
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
                <span>{tOrder("serviceUnknown")}</span>
              </p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2">
              <label htmlFor="order-service" className="px-1 text-sm font-medium text-ink">
                {tOrder("serviceLabel")}
              </label>
              <span className="relative flex">
                <select
                  id="order-service"
                  name="serviceId"
                  value={serviceId}
                  onChange={(event) => {
                    setServiceId(event.target.value);
                    remember({ serviceId: event.target.value || null });
                  }}
                  aria-invalid={errorOf("serviceId") ? true : undefined}
                  aria-describedby={errorOf("serviceId") ? "order-service-error" : undefined}
                  className={`${orderInputClass} h-12 cursor-pointer appearance-none pr-11 font-semibold`}
                >
                  {serviceId === "" ? (
                    <option value="" disabled>
                      {tOrder("servicePlaceholder")}
                    </option>
                  ) : null}
                  {services.map((option) => (
                    <option key={option.id} value={option.id}>
                      {`${option.name} · ${option.price}`}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
              </span>
              <FieldError id="order-service-error" message={errorOf("serviceId")} />
            </div>
            {serviceId && summaries[serviceId] ? <div className="mt-4 border-t border-border pt-4">{summaries[serviceId]}</div> : null}
          </section>

          <OrderWhere
            areas={areas}
            area={area}
            freeDays={freeDays}
            selected={selected ? { dayLabel: selected.day.label, windowLabel: selected.window.label } : null}
            startsAt={startsAt}
            pickerOpen={pickerOpen}
            onPickerOpenChange={setPickerOpen}
            onChooseArea={(next) => {
              setAreaId(next);
              setStartsAt(null);
              setPickerOpen(true);
              remember({ areaId: next, startsAt: null });
            }}
            onChooseWindow={(next) => {
              setStartsAt(next);
              remember({ startsAt: next });
            }}
            disabled={pending}
            areaError={errorOf("areaId")}
            windowError={errorOf("startsAt")}
            justTaken={justTaken}
            answers={answers}
            takenNotice={showTakenNotice ? props.takenNotice : null}
            lookAheadDays={props.lookAheadDays}
            windowAlert={windowAlert}
          />

          <section aria-labelledby="order-contact-title" className={card}>
            <h2 id="order-contact-title" className={sectionTitle}>
              {tOrder("contactTitle")}
            </h2>
            <div className="mt-3 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="booking-address" className="px-1 text-sm font-medium text-ink">
                  {t("addressLabel")}
                </label>
                <textarea
                  id="booking-address"
                  name="address"
                  rows={3}
                  autoComplete="street-address"
                  defaultValue={state?.values?.address ?? ""}
                  aria-invalid={errorOf("address") ? true : undefined}
                  aria-describedby={errorOf("address") ? "booking-address-hint booking-address-error" : "booking-address-hint"}
                  className={`${orderInputClass} resize-y py-3`}
                />
                <p id="booking-address-hint" className="px-1 text-sm text-ink-faint">
                  {t("addressHint")}
                </p>
                <FieldError id="booking-address-error" message={errorOf("address")} />
              </div>
              <OrderField
                id="order-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                label={tOrder("phoneLabel")}
                hint={tOrder("phoneHint")}
                error={errorOf("phone")}
              />
              {signedIn ? (
                <div className="flex items-start gap-3 rounded-md bg-surface-sunken px-4 py-3">
                  <UserRoundCheck className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden="true" />
                  <p className="flex min-w-0 flex-col text-sm">
                    <span className="text-ink-muted">{tOrder("signedInTitle")}</span>
                    <span className="font-semibold break-words text-ink">{customer?.name || email}</span>
                    <span className="mt-1 text-ink-muted">{tOrder("signedInNote")}</span>
                  </p>
                </div>
              ) : (
                <OrderField
                  id="order-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  label={tOrder("emailLabel")}
                  hint={tOrder("emailHint")}
                  error={errorOf("email")}
                />
              )}
            </div>
          </section>

          <section aria-labelledby="booking-stream-title" className={card}>
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
        </div>
      </div>

      {current.step === "code" ? (
        <section aria-labelledby="order-code-title" className={`${card} md:col-start-1 md:row-start-1`}>
          <CodeEntry
            id="order-code"
            titleId="order-code-title"
            title={tOrder("codeTitle")}
            sentTo={tOrder.rich("codeSentTo", {
              email,
              strong: (chunks) => <strong className="font-semibold text-ink">{chunks}</strong>,
            })}
            error={errorOf("code")}
            submitLabel={t("submit")}
            pendingLabel={t("pending")}
            pending={pending}
            resending={pending && intent === "resend"}
            sentCount={sent}
            answerKey={answers}
            resent={answer?.intent === "resend" && Boolean(state?.codeSent)}
            onResend={() => send("resend")}
            onChangeEmail={() => {
              setView({ step: "form", signedIn: false });
              setEdits(edits + 1);
            }}
          >
            {alert}
          </CodeEntry>
        </section>
      ) : null}

      <div className={`${card} md:sticky md:top-6 md:col-start-2 md:row-start-1`}>
        {current.step === "code" ? <h2 className="mb-3 text-sm font-medium text-ink-muted">{tOrder("recapTitle")}</h2> : null}
        {recap}
        {service ? (
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium text-ink-muted">{t("totalLabel")}</p>
            <p className="font-display text-2xl font-semibold whitespace-nowrap text-ink tabular-nums">{service.price}</p>
          </div>
        ) : null}
        <p className="mt-1 text-sm text-ink-faint">{t("totalNote")}</p>

        {current.step === "form" ? (
          <>
            {alert}
            <button
              type="submit"
              disabled={submitBlocked || pending}
              aria-describedby={submitBlocked ? "booking-submit-hint" : signedIn ? undefined : "order-send-note"}
              className={`mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-[background-color,color,transform] duration-150 ease-out-quart ${
                pending
                  ? "cursor-progress bg-brand-700 text-on-brand"
                  : "bg-brand-600 text-on-brand hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted disabled:active:scale-100"
              }`}
            >
              {pending ? <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden="true" /> : null}
              {signedIn ? (pending ? t("pending") : t("submit")) : pending ? tOrder("pendingSend") : tOrder("submitSend")}
              {pending ? null : <ArrowRight className="size-5 shrink-0" aria-hidden="true" />}
            </button>
            {submitBlocked ? (
              <p id="booking-submit-hint" className="mt-2 text-center text-sm text-ink-muted">
                {t("submitHint")}
              </p>
            ) : signedIn ? null : (
              <p id="order-send-note" className="mt-2 text-center text-sm text-ink-muted">
                {tOrder("sendNote")}
              </p>
            )}
          </>
        ) : null}
      </div>
    </form>
  );
}
