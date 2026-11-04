"use client";

import { ArrowRight, ChevronDown, CircleAlert, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { openTicket, type SupportFormState } from "@/lib/support/actions";

type TicketFormProps = {
  /** The search words, carried over as the question. */
  initialQuestion: string;
  /** The customer's own orders, newest first, for "Pesanan terkait". */
  orders: { id: string; label: string }[];
};

const minLength = 5;
const maxLength = 1000;

// "Hubungi admin" for a signed-in customer (T20): the question (carried over from the search), how
// urgent it is, and optionally which of their orders it is about. openTicket checks the customer, the
// question and that the order is theirs on the server, makes the ticket and sends the browser to its
// chat (/support?ticket=<id>). A question that is too short is stopped here first, with words; the
// draft stays if the server refuses.
// Sources: node_modules/next/dist/docs/01-app/02-guides/forms.md ("Validation errors", "Pending states")
export function TicketForm({ initialQuestion, orders }: TicketFormProps) {
  const t = useTranslations("SupportTicketForm");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<SupportFormState, FormData>(openTicket, null);
  const [question, setQuestion] = useState(initialQuestion.slice(0, maxLength));
  const [tooShort, setTooShort] = useState(false);
  // Counts the sends, so the same refusal twice is announced twice.
  const [sends, setSends] = useState(0);
  const field = useRef<HTMLTextAreaElement>(null);

  const serverError = state?.formError && !pending ? t(`errors.${state.formError}`) : null;
  const questionError = tooShort ? t("tooShort") : state?.formError === "questionInvalid" && !pending ? serverError : null;
  const formError = questionError ? null : serverError;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setSends((count) => count + 1);
    if (question.trim().length < minLength) {
      setTooShort(true);
      field.current?.focus();
      return;
    }
    setTooShort(false);
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  const radio =
    "flex min-h-touch cursor-pointer items-start gap-3 rounded-md border border-border-control bg-surface px-4 py-3 transition-colors duration-150 ease-out-quart hover:border-brand-600 has-checked:border-brand-600 has-checked:bg-brand-50 active:bg-brand-50";

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />

      <div className="flex flex-col gap-2">
        <label htmlFor="pertanyaan-admin" className="px-1 text-sm font-medium text-ink">
          {t("question")}
        </label>
        <textarea
          ref={field}
          id="pertanyaan-admin"
          name="question"
          rows={4}
          maxLength={maxLength}
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value);
            if (tooShort) setTooShort(false);
          }}
          aria-invalid={questionError ? true : undefined}
          aria-describedby={questionError ? "pertanyaan-admin-hint pertanyaan-admin-error" : "pertanyaan-admin-hint"}
          className="min-h-28 w-full resize-y rounded-xl border border-border-control bg-surface px-4 py-3 text-base text-ink caret-brand-700 transition-colors duration-150 ease-out-quart hover:border-brand-600 aria-invalid:border-danger aria-invalid:bg-danger-surface"
        />
        <p id="pertanyaan-admin-hint" className="px-1 text-sm text-ink-faint">
          {t("questionHint")}
        </p>
        {questionError ? (
          <p key={sends} id="pertanyaan-admin-error" role="alert" className="flex items-start gap-1.5 px-1 text-sm font-medium text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{questionError}</span>
          </p>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 px-1 text-sm font-medium text-ink">{t("urgency.legend")}</legend>
        <label className={radio}>
          <input type="radio" name="urgency" value="normal" defaultChecked className="mt-0.5 size-5 shrink-0 accent-brand-600" />
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-semibold text-ink">{t("urgency.normal")}</span>
            <span className="text-sm text-ink-muted">{t("urgency.normalHint")}</span>
          </span>
        </label>
        <label className={radio}>
          <input type="radio" name="urgency" value="urgent" className="mt-0.5 size-5 shrink-0 accent-brand-600" />
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-semibold text-ink">{t("urgency.urgent")}</span>
            <span className="text-sm text-ink-muted">{t("urgency.urgentHint")}</span>
          </span>
        </label>
      </fieldset>

      {orders.length > 0 ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="pesanan-terkait" className="px-1 text-sm font-medium text-ink">
            {t("order.label")}
          </label>
          <div className="relative">
            <select
              id="pesanan-terkait"
              name="orderId"
              defaultValue=""
              className="h-12 w-full cursor-pointer appearance-none truncate rounded-full border border-border-control bg-surface pr-12 pl-5 text-base text-ink transition-colors duration-150 ease-out-quart hover:border-brand-600"
            >
              <option value="">{t("order.none")}</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
          </div>
        </div>
      ) : null}

      <div role="alert" aria-atomic="true">
        {formError ? (
          <p key={sends} className="flex items-start gap-2.5 rounded-md bg-danger-surface px-4 py-3 text-sm font-medium text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-[background-color,transform] duration-150 ease-out-quart sm:w-fit ${
          pending
            ? "cursor-progress bg-brand-700 text-on-brand"
            : "bg-brand-600 text-on-brand hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800"
        }`}
      >
        {pending ? <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden="true" /> : null}
        {pending ? t("pending") : t("submit")}
        {pending ? null : <ArrowRight className="size-5 shrink-0" aria-hidden="true" />}
      </button>
    </form>
  );
}
