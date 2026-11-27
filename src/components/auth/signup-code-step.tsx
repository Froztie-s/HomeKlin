"use client";

import { useLocale, useTranslations } from "next-intl";
import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { confirmSignUp, resendSignUpCode } from "@/lib/auth/actions";
import { CodeEntry } from "./code-entry";
import { FormAlert, useResultKey } from "./form-controls";

type SignupCodeStepProps = {
  /** The address the code was sent to, as the visitor typed it on the sign-up step. */
  email: string;
  /** The password typed on the sign-up step (browser memory), sent with the code; empty without JavaScript. */
  password: string;
  /** The page to open after confirming (?next=), carried on in a hidden field. */
  next?: string;
  /** "Ganti email": back to the sign-up step, with name and email kept. */
  onChangeEmail: () => void;
};

// The second step of signing up when "Confirm email" is on (user decision 2026-11-27): Supabase made
// the account and emailed a 6-digit code, and this step takes it. It is a form of its own, posted to
// confirmSignUp (a Server Action, so it also posts before JavaScript loads), and carries only the
// email and, with JavaScript, the password typed on the first step (confirmSignUp sets it once the code is
// right, so the person who types the code decides the password; it is never shown or sent back). With JavaScript the form is sent from onSubmit inside a transition, so React
// does not reset it after a wrong code and the digits stay to be corrected (the same as the sign-in
// code form). "Kirim ulang kode" calls resendSignUpCode, which sends the confirmation email again;
// the countdown before it can be used again is CodeEntry's.
// Sources: node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md ("Event Handlers",
// "Showing a pending state") and https://react.dev/reference/react/useActionState
export function SignupCodeStep({ email, password, next, onChangeEmail }: SignupCodeStepProps) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [confirmState, confirmAction, confirming] = useActionState(confirmSignUp, null);
  const [resendState, resendAction, resending] = useActionState(resendSignUpCode, null);
  const confirmKey = useResultKey(confirmState);
  const resendKey = useResultKey(resendState);
  const form = useRef<HTMLFormElement>(null);
  const [latest, setLatest] = useState<"confirm" | "resend" | null>(null);
  const [sent, setSent] = useState(0);

  // Each answer, handled once while rendering
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  const [seenConfirm, setSeenConfirm] = useState(confirmState);
  if (confirmState !== seenConfirm) {
    setSeenConfirm(confirmState);
    setLatest("confirm");
  }
  const [seenResend, setSeenResend] = useState(resendState);
  if (resendState !== seenResend) {
    setSeenResend(resendState);
    setLatest("resend");
    if (resendState?.codeSent && !resendState.formError) setSent(sent + 1);
  }

  // What the visitor sees is the most recent answer, from the code check or from "send again".
  const state = latest === "resend" ? resendState : confirmState;
  const emailProblem = state?.fieldErrors?.email;
  const codeError = state?.formError === "codeInvalid" ? t("errors.codeInvalid") : undefined;
  const alert =
    state?.formError && state.formError !== "codeInvalid"
      ? t(`errors.${state.formError}`)
      : emailProblem
        ? t(`errors.${emailProblem}`)
        : undefined;
  const resent = latest === "resend" && Boolean(state?.codeSent) && !state?.formError;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = form.current;
    if (current) startTransition(() => confirmAction(new FormData(current)));
  }

  function onResend() {
    const data = new FormData();
    data.set("locale", locale);
    data.set("email", email);
    startTransition(() => resendAction(data));
  }

  return (
    <form ref={form} action={confirmAction} onSubmit={onSubmit} noValidate className="flex flex-col">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="email" value={email} />
      {password ? <input type="hidden" name="password" value={password} /> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <CodeEntry
        id="signup-code"
        title={t("signup.codeTitle")}
        sentTo={t.rich("signup.codeSentTo", { email, strong: (chunks) => <strong className="font-semibold text-ink">{chunks}</strong> })}
        error={codeError}
        submitLabel={t("signup.verify")}
        pendingLabel={t("signup.verifying")}
        pending={confirming || resending}
        resending={resending}
        sentCount={sent}
        answerKey={confirmKey + resendKey}
        resent={resent}
        onResend={onResend}
        onChangeEmail={onChangeEmail}
      />
      <FormAlert message={alert} tone="danger" resultKey={confirmKey + resendKey} />
    </form>
  );
}
