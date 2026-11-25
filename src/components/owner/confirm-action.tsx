"use client";

import { CircleAlert, CirclePause, CirclePlay, LoaderCircle, TriangleAlert, UserMinus } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { dangerButton, primaryButton, quietButton, quietDangerButton, secondaryButton } from "@/components/agency/styles";
import type { OwnerActionState, OwnerFailureKey } from "@/lib/owner/actions";

// Icons by name: a component cannot be passed from the server page to this client component.
const icons = { suspend: CirclePause, reactivate: CirclePlay, remove: UserMinus };

type ConfirmActionProps = {
  /** One of the owner's Server Actions (src/lib/owner/actions.ts). */
  action: (previous: OwnerActionState, formData: FormData) => Promise<OwnerActionState>;
  /** What the form posts, e.g. { agencyId, status }. */
  fields: Record<string, string>;
  icon: keyof typeof icons;
  /** "danger" for a change that takes something away (suspend, remove); "default" otherwise. */
  tone: "danger" | "default";
  /**
   * "button" (default): an outlined pill. "quiet": a small text button without an edge, for a row
   * action that should not compete with the page's own (audit item 5, /owner/agencies).
   */
  trigger?: "button" | "quiet";
  /**
   * "inline": at the end of a table row; the question opens in a dialog over the page (2026-11-20, UX
   * audit: in the row it widened the table past the screen at 1280 px). "block": in a panel, in place,
   * full width.
   */
  layout?: "inline" | "block";
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

const confirmButtons = {
  danger: "inline-flex min-h-touch shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-danger px-5 text-sm font-semibold whitespace-nowrap text-on-primary transition-[background-color,transform] duration-150 ease-out-quart hover:bg-danger/90 active:scale-[0.98] aria-disabled:cursor-progress aria-disabled:active:scale-100",
  default: primaryButton,
};

const boxes = {
  danger: "inset-ring-[1.5px] inset-ring-danger",
  default: "inset-ring-[1.5px] inset-ring-border-control",
};

// A change the owner makes from a list (T29c: suspend or reactivate a partner, remove an admin; the
// mocks' look since D3). It asks once more in place, in a white box with a warning glyph that says
// what the change does, before the action runs; the server checks the owner role again. Cancel or a
// saved change closes the question and puts focus back on the button.
// Sources: https://react.dev/reference/react/useActionState and
// https://react.dev/reference/react/useState#storing-information-from-previous-renders
const triggers = {
  button: { danger: dangerButton, default: secondaryButton },
  quiet: { danger: quietDangerButton, default: quietButton },
};

export function ConfirmAction({ action, fields, icon, tone, trigger = "button", layout = "inline", labels, errors }: ConfirmActionProps) {
  const Icon = icons[icon];
  const [state, formAction, pending] = useActionState(action, null);
  const [asking, setAsking] = useState(false);
  const [seen, setSeen] = useState(state);
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const questionId = useId();
  const inline = layout === "inline";

  // The row's question is a modal dialog: opened as it appears, closed by unmounting it.
  useEffect(() => {
    if (asking && inline) dialog.current?.showModal();
  }, [asking, inline]);

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

  const question = (
        <form
          action={formAction}
          onSubmit={(event) => {
            if (pending) event.preventDefault();
          }}
          aria-labelledby={questionId}
          className={`flex flex-col gap-3 rounded-md bg-card text-left ${boxes[tone]} ${inline ? "w-full p-5" : "w-full max-w-2xl p-4"}`}
        >
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <p className="flex items-center gap-2.5">
            <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full ${tone === "danger" ? "bg-danger-surface text-danger" : "bg-lime-wash text-on-lime-wash"}`}>
              <TriangleAlert className="size-4" />
            </span>
            <span id={questionId} className="font-display text-base font-semibold text-ink">
              {labels.question}
            </span>
          </p>
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
            <button type="submit" aria-disabled={pending || undefined} autoFocus className={confirmButtons[tone]}>
              {pending ? <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" /> : <Icon className="size-4 shrink-0" aria-hidden="true" />}
              {pending ? labels.pending : labels.confirm}
            </button>
            <button type="button" disabled={pending} onClick={cancel} className={secondaryButton}>
              {labels.cancel}
            </button>
          </div>
        </form>
  );

  return (
    // relative: the hidden status line stays inside the table's scrolling box.
    <div className={`relative flex flex-col gap-2 ${inline ? "items-start sm:items-end" : "items-start"}`}>
      {asking && !inline ? (
        question
      ) : (
        <button
          ref={button}
          type="button"
          aria-label={labels.buttonLabel}
          onClick={() => setAsking(true)}
          // A quiet button in a row: its word lines up with the row's text (left below 640 px, right above).
          className={`${triggers[trigger][tone]} ${trigger === "quiet" && inline ? "max-sm:-ml-3 sm:-mr-3" : ""}`}
        >
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {labels.button}
        </button>
      )}
      {asking && inline ? (
        // Escape cancels like "Batal" (not while the change is being saved); focus goes back to the row's button.
        <dialog
          ref={dialog}
          aria-labelledby={questionId}
          onCancel={(event) => {
            event.preventDefault();
            if (!pending) cancel();
          }}
          className="m-auto w-[min(28rem,calc(100vw-2rem))] max-w-none bg-transparent p-0 backdrop:bg-ink/40"
        >
          {question}
        </dialog>
      ) : null}
      <p role="status" className="sr-only">
        {state?.ok && !pending ? labels.done : ""}
      </p>
    </div>
  );
}
