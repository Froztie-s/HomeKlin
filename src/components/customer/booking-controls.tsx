"use client";

import { Check, CircleAlert } from "lucide-react";

// Small pieces of the booking form (T9), in the T3b customer look (markdown/design.md, Forms).

/** A field's problem, under it, tied to it with aria-describedby by the caller. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 px-1 text-sm font-medium text-danger">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

type ConsentSwitchProps = {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
};

// The streaming consent (markdown/SPEC.md: the consent toggle must be on at booking). A real checkbox
// named `consent`, so the form sends "on" only when it is ticked, announced as a switch. The whole row
// is the label, a full 44 px target; the track is 28 px with a knob that slides and shows a tick when
// on, so the state never depends on colour alone.
export function ConsentSwitch({ id, label, checked, onChange, error }: ConsentSwitchProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="group relative -mx-2 flex min-h-touch cursor-pointer items-start gap-3 rounded-md px-2 py-2 transition-colors duration-150 ease-out-quart hover:bg-surface-sunken"
      >
        <input
          id={id}
          type="checkbox"
          role="switch"
          name="consent"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="peer absolute inset-0 z-10 size-full cursor-pointer appearance-none rounded-md opacity-0"
        />
        <span
          aria-hidden="true"
          className="relative mt-px inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border-control bg-surface-sunken transition-colors duration-150 ease-out-quart group-hover:border-brand-600 peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-aria-invalid:border-danger"
        >
          <span
            className={`absolute left-0.5 flex size-5.5 items-center justify-center rounded-full bg-surface shadow-card transition-transform duration-150 ease-out-quart ${checked ? "translate-x-5" : ""}`}
          >
            <Check
              className={`size-3.5 text-brand-700 transition-opacity duration-150 ${checked ? "opacity-100" : "opacity-0"}`}
              strokeWidth={3}
            />
          </span>
        </span>
        <span className="pt-0.5 text-sm font-medium text-ink">{label}</span>
      </label>
      <FieldError id={errorId} message={error} />
    </div>
  );
}
