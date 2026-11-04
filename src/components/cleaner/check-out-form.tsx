"use client";

import { CircleAlert, LoaderCircle, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState, type RefObject } from "react";
import { checkOut, type JobActionState } from "@/lib/jobs/actions";
import { useRememberFinished } from "./finished-notes";

type CheckOutFormProps = {
  orderId: string;
  /** The Check-out button, so the card can move the focus to it right after check-in. */
  buttonRef: RefObject<HTMLButtonElement | null>;
};

const primary =
  "inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full px-6 text-lg font-semibold transition-[background-color,transform] duration-150 ease-out-quart";
const primaryIdle = "bg-brand-600 text-on-brand hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800";

// Check-out on a job in progress (T18), with a confirm step, because it cannot be undone: the job is
// recorded as finished and the server attaches its recording. Batal goes back to the button. The answer
// is remembered above the list (finished-notes.tsx), since the job then moves to "Baru selesai".
export function CheckOutForm({ orderId, buttonRef }: CheckOutFormProps) {
  const t = useTranslations("CleanerJobActions");
  const remember = useRememberFinished();
  const [confirming, setConfirming] = useState(false);
  const [presses, setPresses] = useState(0);
  const [state, action, pending] = useActionState(async (previous: JobActionState, form: FormData) => {
    const result = await checkOut(previous, form);
    if (result?.ok) remember(orderId, result.recordingMissing ? "recordingMissing" : "done");
    return result;
  }, null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  const baseId = `check-out-${orderId}`;
  const errorId = `${baseId}-error`;
  const error = !pending ? state?.formError : undefined;

  useEffect(() => {
    if (confirming) panelRef.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [confirming, buttonRef]);

  if (!confirming) {
    return (
      <button ref={buttonRef} type="button" onClick={() => setConfirming(true)} className={`${primary} ${primaryIdle}`}>
        <LogOut className="size-5 shrink-0" aria-hidden="true" />
        {t("checkOut")}
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="group"
      aria-labelledby={`${baseId}-title`}
      aria-describedby={`${baseId}-body`}
      className="flex flex-col gap-3 rounded-md bg-surface-sunken p-4 outline-offset-2"
    >
      <p id={`${baseId}-title`} className="font-display text-base font-semibold text-ink">
        {t("confirmTitle")}
      </p>
      <p id={`${baseId}-body`} className="text-sm text-ink-muted">
        {t("confirmBody")}
      </p>
      <div id={errorId} role="alert" aria-atomic="true">
        {error ? (
          <p key={presses} className="flex items-start gap-2.5 rounded-md bg-danger-surface px-3 py-2.5 text-sm font-medium text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t(`errors.${error}`)}</span>
          </p>
        ) : null}
      </div>
      <form
        action={action}
        onSubmit={(event) => {
          if (pending) event.preventDefault();
          else setPresses((count) => count + 1);
        }}
        className="flex flex-col-reverse gap-2 sm:flex-row"
      >
        <input type="hidden" name="orderId" value={orderId} />
        <button
          type="button"
          onClick={() => {
            if (pending) return;
            returnFocus.current = true;
            setConfirming(false);
          }}
          aria-disabled={pending || undefined}
          className="inline-flex min-h-touch items-center justify-center rounded-full border border-border-control bg-surface px-5 text-base font-semibold text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 sm:flex-1"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          aria-disabled={pending || undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${primary} sm:flex-1 ${pending ? "cursor-progress bg-brand-700 text-on-brand" : primaryIdle}`}
        >
          {pending ? <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden="true" /> : null}
          {pending ? t("checkingOut") : t("confirm")}
        </button>
      </form>
    </div>
  );
}
