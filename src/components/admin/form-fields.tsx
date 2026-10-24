"use client";

import { Check, ChevronDown, CircleAlert } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

// The back-office form controls that src/components/auth/form-controls.tsx does not have: a select, a
// multi-line text field, a checkbox and a value that cannot be changed. They look like its TextField
// (T3b app look: 16 px text so phones never zoom, a border-control edge, a danger edge and fill on an
// error) and tie their hint and error to the control with aria-describedby, so a screen reader reads
// the problem together with the field.

type Notes = { hint?: string; error?: string };

/** The ids under a field (hint, then error), for its aria-describedby. */
function notesFor(id: string, { hint, error }: Notes) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return { hintId, errorId, describedBy: [hintId, errorId].filter(Boolean).join(" ") || undefined };
}

function FieldNotes({ id, hint, error }: Notes & { id: string }) {
  const { hintId, errorId } = notesFor(id, { hint, error });
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

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="px-1 text-sm font-medium text-ink">
      {children}
    </label>
  );
}

const controlEdge =
  "border border-border-control bg-surface text-base text-ink transition-colors duration-150 ease-out-quart hover:border-brand-600 aria-invalid:border-danger aria-invalid:bg-danger-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken";

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className" | "children"> &
  Notes & {
    id: string;
    label: string;
    /** Shown while nothing is chosen; it cannot be chosen back. */
    placeholder: string;
    options: readonly { value: string; label: string }[];
  };

// A native select, so the keyboard, the phone's picker and screen readers work as people expect.
export function SelectField({ id, label, hint, error, placeholder, options, ...select }: SelectFieldProps) {
  const { describedBy } = notesFor(id, { hint, error });
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-12 w-full cursor-pointer appearance-none rounded-full pr-12 pl-5 ${controlEdge}`}
          {...select}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
      </div>
      <FieldNotes id={id} hint={hint} error={error} />
    </div>
  );
}

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className"> &
  Notes & { id: string; label: string };

export function TextAreaField({ id, label, hint, error, rows = 3, ...textarea }: TextAreaFieldProps) {
  const { describedBy } = notesFor(id, { hint, error });
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-28 w-full resize-y rounded-xl px-5 py-3 caret-brand-700 placeholder:text-ink-faint ${controlEdge}`}
        {...textarea}
      />
      <FieldNotes id={id} hint={hint} error={error} />
    </div>
  );
}

type CheckboxFieldProps = { id: string; name: string; label: string; hint?: string; defaultChecked: boolean };

// A 24 px box inside a label that is at least 44 px tall, so the whole line is the target.
export function CheckboxField({ id, name, label, hint, defaultChecked }: CheckboxFieldProps) {
  const { describedBy } = notesFor(id, { hint });
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="group flex min-h-touch w-fit cursor-pointer items-center gap-3 rounded-full py-1 pr-4 pl-1 transition-colors duration-150 ease-out-quart hover:bg-surface-sunken"
      >
        <span className="relative flex size-6 shrink-0 items-center justify-center">
          <input
            id={id}
            name={name}
            type="checkbox"
            defaultChecked={defaultChecked}
            aria-describedby={describedBy}
            className="peer size-6 cursor-pointer appearance-none rounded-sm border border-border-control bg-surface transition-colors duration-150 ease-out-quart group-hover:border-brand-600 checked:border-brand-600 checked:bg-brand-600"
          />
          <Check
            className="pointer-events-none absolute size-4 text-on-brand opacity-0 peer-checked:opacity-100"
            strokeWidth={3}
            aria-hidden="true"
          />
        </span>
        <span className="text-base font-medium text-ink">{label}</span>
      </label>
      <FieldNotes id={id} hint={hint} />
    </div>
  );
}

type FixedFieldProps = { id: string; label: string; value: string; hint: string };

/**
 * A value that cannot be changed (the id of a saved service): a read-only field, so it keeps its label
 * and a screen reader says it is read-only. It has no name, so it is not sent; the form carries the
 * value in a hidden field of its own.
 */
export function FixedField({ id, label, value, hint }: FixedFieldProps) {
  const { describedBy } = notesFor(id, { hint });
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="text"
        readOnly
        value={value}
        aria-describedby={describedBy}
        className="h-12 w-full cursor-default rounded-full border border-border bg-surface-sunken px-5 font-mono text-sm text-ink"
      />
      <FieldNotes id={id} hint={hint} />
    </div>
  );
}

type FormSectionProps = { legend: string; description?: string; children: ReactNode };

/**
 * A group of fields with its name, separated from the group above by a line. The legend floats, which
 * takes it out of the fieldset's border (where browsers draw a legend) and lets it sit like a heading.
 */
export function FormSection({ legend, description, children }: FormSectionProps) {
  return (
    <fieldset className="min-w-0 border-t border-border px-5 py-6 first-of-type:border-t-0 md:px-8">
      <legend className="float-left w-full font-display text-lg font-semibold text-ink">{legend}</legend>
      <div className={`clear-both flex flex-col gap-5 ${description ? "pt-1" : "pt-4"}`}>
        {description ? <p className="max-w-prose text-sm text-ink-muted">{description}</p> : null}
        {children}
      </div>
    </fieldset>
  );
}

/** A number that changes whenever the server answers, even with the same answer as before. */
export function useResultKey(state: unknown): number {
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
export function useFocusFirstError(state: { fieldErrors?: object } | null) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state?.fieldErrors || Object.keys(state.fieldErrors).length === 0) return;
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  return form;
}
