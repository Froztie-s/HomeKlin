"use client";

import { ArrowRight, CircleAlert, LoaderCircle, MailCheck, PencilLine, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Seconds before another code may be asked for (Supabase refuses a new one sooner anyway). */
export const resendSeconds = 60;

type CodeEntryProps = {
  id: string;
  /** The heading's id, for the region around this step. */
  titleId?: string;
  title: string;
  /** "Kami mengirim kode 6 angka ke nama@domain.com." with the email in bold. */
  sentTo: ReactNode;
  /** The code field's problem, in words. */
  error?: string;
  submitLabel: string;
  pendingLabel: string;
  /** The form is waiting for the server (any of its buttons). */
  pending: boolean;
  /** The resend button is the one that is waiting. */
  resending: boolean;
  /** Changes every time a code is sent: restarts the resend countdown. */
  sentCount: number;
  /** Changes with every answer from the server: puts the cursor back in the code field. */
  answerKey: number;
  /** A new code was just sent from here. */
  resent: boolean;
  onResend: () => void;
  onChangeEmail: () => void;
  /** Shown under the buttons (the order's recap). */
  children?: ReactNode;
};

const linkButton =
  "inline-flex min-h-touch items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:bg-brand-50 hover:text-brand-800 active:bg-brand-100 disabled:cursor-not-allowed disabled:text-ink-muted disabled:hover:bg-transparent";

// The code step of the emailed-code forms (T9b): sign-in and the order page. It sits inside the form
// that sends it, so the code goes out with that form's other fields. One field for the six digits:
// inputmode="numeric" brings up the number pad, autocomplete="one-time-code" lets the phone offer the
// code from the email, and spaces are allowed (the server ignores them). "Kirim ulang kode" waits 60
// seconds after each code, with the seconds left in its label; "Ganti email" goes back to the first
// step with everything kept. The code itself is only ever checked on the server.
export function CodeEntry(props: CodeEntryProps) {
  const { id, titleId, title, sentTo, error, submitLabel, pendingLabel, pending, resending, sentCount, answerKey, resent } = props;
  const t = useTranslations("CodeEntry");
  const input = useRef<HTMLInputElement>(null);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  // On arriving at the step, and after each answer, the cursor goes to the code (selected, so a wrong
  // code is replaced by typing the next one).
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, [answerKey]);

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <MailCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={titleId} className="font-display text-lg font-semibold text-ink">
            {title}
          </h2>
          <p className="text-sm break-words text-ink-muted">{sentTo}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <label htmlFor={id} className="px-1 text-sm font-medium text-ink">
          {t("codeLabel")}
        </label>
        <input
          ref={input}
          id={id}
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          spellCheck={false}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          className="h-14 w-full max-w-60 rounded-md border border-border-control bg-surface px-4 font-display text-2xl font-semibold tracking-widest text-ink tabular-nums caret-brand-700 transition-colors duration-150 ease-out-quart hover:border-brand-600 aria-invalid:border-danger aria-invalid:bg-danger-surface"
        />
        <p id={hintId} className="px-1 text-sm text-ink-faint">
          {t("codeHint")}
        </p>
        {error ? (
          <p id={errorId} className="flex items-start gap-1.5 px-1 text-sm font-medium text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>

      <div role="status" aria-atomic="true">
        {resent ? (
          <p key={sentCount} className="mt-4 rounded-md bg-info-surface px-4 py-3 text-sm font-medium text-info">
            {t("resent")}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 text-base font-semibold text-on-brand transition-[background-color,transform] duration-150 ease-out-quart hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800 disabled:cursor-progress disabled:bg-brand-700 disabled:active:scale-100"
      >
        {pending && !resending ? <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden="true" /> : null}
        {pending && !resending ? pendingLabel : submitLabel}
        {pending ? null : <ArrowRight className="size-5 shrink-0" aria-hidden="true" />}
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <ResendButton key={sentCount} pending={pending} resending={resending} onResend={props.onResend} />
        <button type="button" onClick={props.onChangeEmail} disabled={pending} className={linkButton}>
          <PencilLine className="size-4 shrink-0" aria-hidden="true" />
          {t("changeEmail")}
        </button>
      </div>
      {props.children}
    </div>
  );
}

/** "Kirim ulang kode", disabled with the seconds left for a minute after each code (remounted per code). */
function ResendButton({ pending, resending, onResend }: { pending: boolean; resending: boolean; onResend: () => void }) {
  const t = useTranslations("CodeEntry");
  const [left, setLeft] = useState(resendSeconds);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setLeft((seconds) => {
        if (seconds <= 1) window.clearInterval(timer);
        return Math.max(0, seconds - 1);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const waiting = left > 0;
  return (
    <button type="button" onClick={onResend} disabled={waiting || pending} className={`${linkButton} tabular-nums`}>
      {resending ? (
        <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <RotateCw className="size-4 shrink-0" aria-hidden="true" />
      )}
      {waiting ? t("resendIn", { seconds: String(left) }) : t("resend")}
    </button>
  );
}
