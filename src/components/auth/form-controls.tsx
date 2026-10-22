"use client";

import { CircleAlert, Eye, EyeOff, Info, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import type { AuthFormState } from "@/lib/auth/actions";

// The pieces of the sign-in and sign-up forms (T3b app look: pill inputs on 16 px text, so phones
// never zoom in; an evergreen submit button). Errors come from the server (src/lib/auth/actions.ts),
// in the visitor's language, and are tied to their field: aria-invalid plus aria-describedby, so a
// screen reader reads the problem together with the field.

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
  id: string;
  label: string;
  /** Shown under the field at all times, e.g. the password rule. */
  hint?: string;
  /** The problem to fix, in words; the field is marked invalid while there is one. */
  error?: string;
};

const inputClass =
  "h-12 w-full rounded-full border border-border-control bg-surface px-5 text-base text-ink caret-brand-700 transition-colors duration-150 ease-out-quart placeholder:text-ink-faint hover:border-brand-600 aria-invalid:border-danger aria-invalid:bg-danger-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken";

/** The ids under a field (hint, then error), for its aria-describedby. */
function notesFor(id: string, hint?: string, error?: string) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return { hintId, errorId, describedBy };
}

function FieldNotes({ hint, hintId, error, errorId }: { hint?: string; hintId?: string; error?: string; errorId?: string }) {
  return (
    <>
      {hint ? (
        <p id={hintId} className="px-1 text-sm text-ink-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 px-1 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </>
  );
}

export function TextField({ id, label, hint, error, ...input }: FieldProps) {
  const notes = notesFor(id, hint, error);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="px-1 text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={notes.describedBy}
        className={inputClass}
        {...input}
      />
      <FieldNotes hint={hint} error={error} {...notes} />
    </div>
  );
}

type PasswordFieldProps = Omit<FieldProps, "type"> & {
  /** The show-password button's name. It stays the same; aria-pressed says whether the password shows. */
  showLabel: string;
};

// On a phone a mistyped password is the most common reason a sign-in fails, so the password can be
// shown. The button sits inside the pill, a full 44 px target, and never submits the form.
export function PasswordField({ id, label, hint, error, showLabel, ...input }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const notes = notesFor(id, hint, error);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="px-1 text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={notes.describedBy}
          className={`${inputClass} pr-14`}
          {...input}
        />
        <button
          type="button"
          aria-label={showLabel}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((shown) => !shown)}
          className="absolute top-1/2 right-0.5 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-surface-sunken hover:text-ink active:bg-brand-100"
        >
          {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
        </button>
      </div>
      <FieldNotes hint={hint} error={error} {...notes} />
    </div>
  );
}

type SubmitButtonProps = {
  pending: boolean;
  label: string;
  /** Said while the server works ("Sedang masuk…"), next to a spinner. */
  pendingLabel: string;
};

// Disabled while the request runs, so a double tap sends one request.
export function SubmitButton({ pending, label, pendingLabel }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 text-base font-semibold text-on-brand transition-[background-color,transform] duration-150 ease-out-quart hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800 disabled:cursor-progress disabled:bg-brand-700 disabled:active:scale-100"
    >
      {pending ? <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingLabel : label}
    </button>
  );
}

type FormAlertProps = {
  /** The form-level message, or nothing. */
  message?: string;
  /** danger for a failed attempt; info for news that is not a mistake ("check your inbox"). */
  tone: "danger" | "info";
  /** Changes with every answer from the server (useResultKey). */
  resultKey: number;
};

const alertTones = {
  danger: { box: "bg-danger-surface text-danger", Icon: CircleAlert },
  info: { box: "bg-info-surface text-info", Icon: Info },
};

// The form's own message in a live region that is always on the page, so a screen reader announces
// what is put into it. The message is drawn anew for every answer (its key), so the same mistake made
// twice is announced twice instead of looking as if nothing happened.
export function FormAlert({ message, tone, resultKey }: FormAlertProps) {
  const { box, Icon } = alertTones[tone];
  return (
    <div role="alert" aria-atomic="true">
      {message ? (
        <p key={resultKey} className={`mt-6 flex items-start gap-2.5 rounded-md px-4 py-3 text-sm font-medium ${box}`}>
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}

/** A number that changes whenever the server answers, even with the same answer as before. */
export function useResultKey(state: AuthFormState): number {
  // Storing what the last render saw is React's documented way to react to a changed value during
  // rendering: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [seen, setSeen] = useState(state);
  const [count, setCount] = useState(0);
  if (state !== seen) {
    setSeen(state);
    setCount(count + 1);
  }
  return count;
}

/** After an answer with field errors, puts the cursor in the first field to fix. */
export function useFocusFirstError(state: AuthFormState) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state?.fieldErrors || Object.keys(state.fieldErrors).length === 0) return;
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  return form;
}
