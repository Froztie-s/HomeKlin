"use client";

import { CircleAlert, CirclePause, CirclePlay, LoaderCircle, UserMinus } from "lucide-react";

// Icons by name: a component cannot be passed from the server page to this client component.
const icons = { suspend: CirclePause, reactivate: CirclePlay, remove: UserMinus };
import { useActionState, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { OwnerActionState, OwnerFailureKey } from "@/lib/owner/actions";

type ConfirmActionProps = {
  /** One of the owner's Server Actions (src/lib/owner/actions.ts). */
  action: (previous: OwnerActionState, formData: FormData) => Promise<OwnerActionState>;
  /** What the form posts, e.g. { agencyId, status }. */
  fields: Record<string, string>;
  icon: keyof typeof icons;
  /** "danger" for a change that takes something away (suspend, remove); "default" otherwise. */
  tone: "danger" | "default";
  labels: {
    /** The visible word ("Tangguhkan"). */
    button: string;
    /** The button's full name, starting with the visible word ("Tangguhkan Kilau Teratai", WCAG 2.5.3). */
    buttonLabel: string;
    question: string;
    /** What the change does, said before it happens. */
    body: string;
    confirm: string;
    pending: string;
    cancel: string;
    /** Announced once the change is saved: the new state in words ("Kilau Teratai ditangguhkan."). */
    done: string;
  };
  errors: Record<OwnerFailureKey, string>;
};

const outline =
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-full border border-border-control bg-surface px-4 text-sm font-semibold whitespace-nowrap text-ink transition-[background-color,border-color,transform] duration-150 ease-out-quart hover:border-brand-600 hover:bg-surface-sunken active:scale-[0.98] active:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60";

const confirmTones = {
  danger: "bg-danger hover:bg-danger/90",
  default: "bg-brand-600 hover:bg-brand-700 active:bg-brand-800",
};

// A change the owner makes from a list (T29c: suspend or reactivate a partner, remove an admin). It
// asks once more in place, saying what the change does, before the action runs; the server checks the
// owner role again. Cancel or a saved change closes the question and puts focus back on the button.
// Sources: https://react.dev/reference/react/useActionState and
// https://react.dev/reference/react/useState#storing-information-from-previous-renders
export function ConfirmAction({ action, fields, icon, tone, labels, errors }: ConfirmActionProps) {
  const Icon = icons[icon];
  const [state, formAction, pending] = useActionState(action, null);
  const [asking, setAsking] = useState(false);
  const [seen, setSeen] = useState(state);
  const button = useRef<HTMLButtonElement>(null);

  // A saved change closes the question (React's pattern for reacting to a new value during render)...
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setAsking(false);
  }
  // ...and, once the button is back, focus returns to it.
  useEffect(() => {
    if (state?.ok) button.current?.focus();
  }, [state]);

  function cancel() {
    flushSync(() => setAsking(false));
    button.current?.focus();
  }

  const failure = state?.formError && !pending ? errors[state.formError] : null;

  return (
    // relative: the hidden status line stays inside the table's scrolling box.
    <div className="relative flex flex-col items-end gap-2">
      {asking ? (
        <form action={formAction} className="flex w-64 flex-col gap-3 rounded-md bg-surface-sunken p-3 text-left">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <p className="text-sm font-semibold text-ink">{labels.question}</p>
          <p className="text-sm text-ink-muted">{labels.body}</p>
          <div role="alert" aria-atomic="true">
            {failure ? (
              <p className="flex items-start gap-1.5 text-sm font-medium text-danger">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{failure}</span>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              autoFocus
              className={`inline-flex min-h-touch items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-on-brand transition-[background-color,transform] duration-150 ease-out-quart active:scale-[0.98] disabled:cursor-progress ${confirmTones[tone]}`}
            >
              {pending ? <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
              {pending ? labels.pending : labels.confirm}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={cancel}
              className={outline}
            >
              {labels.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button ref={button} type="button" aria-label={labels.buttonLabel} onClick={() => setAsking(true)} className={outline}>
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {labels.button}
        </button>
      )}
      <p role="status" className="sr-only">
        {state?.ok && !pending ? labels.done : ""}
      </p>
    </div>
  );
}
