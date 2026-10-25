"use client";

import { useLocale, useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { sendLoginCode, verifyLoginCode, type AuthFormState } from "@/lib/auth/actions";
import { CodeEntry } from "./code-entry";
import { stepAfter, type CodeIntent, type CodeStep } from "./code-steps";
import { FormAlert, SubmitButton, TextField } from "./form-controls";

type LoginCodeFormProps = {
  /** The page to open after signing in (?next=), carried on in a hidden field. */
  next?: string;
};

type Answer = { intent: CodeIntent; state: AuthFormState } | null;

/** Which action each step's button calls. Both parse their input with Zod on the server. */
async function run(_previous: Answer, data: FormData): Promise<Answer> {
  const intent = data.get("intent") === "verify" ? "verify" : data.get("intent") === "resend" ? "resend" : "send";
  const state = intent === "verify" ? await verifyLoginCode(null, data) : await sendLoginCode(null, data);
  return { intent, state };
}

// Signing in by emailed code (T9b), the way customers sign in: the email, then "Kirim kode", then the
// 6-digit code from the email on the same page, then on to `next` or the role's home. The answer to
// "Kirim kode" is the same whether or not the email has an account (sendLoginCode never says), and the
// copy says so: "Jika ... terdaftar di HomeKlin, kami sudah mengirim kode". A wrong code stays on the
// code step with the problem under the field. The form is sent from onSubmit inside a transition, so
// React does not reset it after an answer and the email is kept for "Ganti email".
// Sources: node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md ("Event Handlers",
// "Showing a pending state") and https://react.dev/reference/react/useActionState
export function LoginCodeForm({ next }: LoginCodeFormProps) {
  const t = useTranslations("AuthLogin");
  const tAuth = useTranslations("Auth");
  const locale = useLocale();
  const [answer, dispatch, pending] = useActionState(run, null);
  const [step, setStep] = useState<CodeStep>("form");
  const [intent, setIntent] = useState<CodeIntent>("send");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState(0);
  const [sent, setSent] = useState(0);
  const [edits, setEdits] = useState(0);
  const form = useRef<HTMLFormElement>(null);

  // Each answer, handled once while rendering
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  const [seen, setSeen] = useState(answer);
  if (answer !== seen) {
    setSeen(answer);
    setAnswers(answers + 1);
    if (answer) {
      setStep(stepAfter(step, answer.intent, answer.state));
      if (answer.state?.codeSent && answer.intent !== "verify") setSent(sent + 1);
    }
  }

  const state = answer?.state ?? null;
  const fieldErrors = state?.fieldErrors ?? {};

  // Back on the email step with a problem in it, or after "Ganti email": the cursor goes to the email.
  useEffect(() => {
    if (step !== "form") return;
    if (edits > 0 || fieldErrors.email) form.current?.querySelector<HTMLElement>('input[name="email"]')?.focus();
  }, [step, edits, fieldErrors.email]);

  function send(chosen: CodeIntent) {
    if (!form.current) return;
    const data = new FormData(form.current);
    data.set("intent", chosen);
    setIntent(chosen);
    setEmail(String(data.get("email") ?? "").trim());
    startTransition(() => dispatch(data));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(step === "code" ? "verify" : "send");
  }

  const codeError = state?.formError === "codeInvalid" ? tAuth("errors.codeInvalid") : undefined;
  const formError = state?.formError && state.formError !== "codeInvalid" ? tAuth(`errors.${state.formError}`) : undefined;

  return (
    <form ref={form} action={dispatch} onSubmit={onSubmit} noValidate className="flex flex-col">
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {/* The email stays in the form on the code step: the code is checked for this email. */}
      <div hidden={step === "code"}>
        <TextField
          id="login-email"
          name="email"
          type="email"
          label={tAuth("fields.email")}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state?.values?.email}
          error={fieldErrors.email && tAuth(`errors.${fieldErrors.email}`)}
        />
      </div>

      {step === "code" ? (
        <CodeEntry
          id="login-code"
          title={t("codeTitle")}
          sentTo={t.rich("codeSentTo", { email, strong: (chunks) => <strong className="font-semibold text-ink">{chunks}</strong> })}
          error={codeError}
          submitLabel={t("verify")}
          pendingLabel={t("verifying")}
          pending={pending}
          resending={pending && intent === "resend"}
          sentCount={sent}
          answerKey={answers}
          resent={answer?.intent === "resend" && Boolean(state?.codeSent)}
          onResend={() => send("resend")}
          onChangeEmail={() => {
            setStep("form");
            setEdits(edits + 1);
          }}
        />
      ) : null}

      <FormAlert message={formError} tone="danger" resultKey={answers} />
      {step === "form" ? <SubmitButton pending={pending} label={t("submitCode")} pendingLabel={t("pendingCode")} /> : null}
    </form>
  );
}
