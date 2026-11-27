"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useState, type FormEvent } from "react";
import { signUp, type AuthFormState } from "@/lib/auth/actions";
import { FormAlert, PasswordField, SubmitButton, TextField, useFocusFirstError, useResultKey } from "./form-controls";
import { SignupCodeStep } from "./signup-code-step";

type SignupFormProps = {
  /** The page to open after signing up (?next=), carried on in a hidden field. */
  next?: string;
};

// Create a customer account (T5, back on 2026-11-20: ordering now needs an account, the user's
// decision). Every sign-up is a customer; the database ignores any role sent with it, and staff
// accounts are made by HomeKlin. The signUp Server Action checks the input with Zod. With "Confirm
// email" off it signs the new customer in at once and opens /home or `next` (for example the order they
// were about to place). With it on (user decision 2026-11-27) Supabase emails a 6-digit code instead and
// answers `codeSent`: this form then shows the code step (signup-code-step.tsx) in place of the fields,
// and name and email are kept for "Ganti email". The password is never sent back to the page. It is kept
// in this component's memory while the code step shows, and goes along with the code (a hidden field of the
// code step), so that the person who types the code decides the password (ship review C1, 2026-11-27: for an
// address that already has an unconfirmed account Supabase keeps the first password). Without JavaScript
// there is nothing to keep; the server then gives the account a random password and the customer signs in
// by code.
// The look is the sign-in card's (forest), the same pattern as the password form.
// Sources: node_modules/next/dist/docs/01-app/02-guides/forms.md and
// https://react.dev/reference/react/useActionState
export function SignupForm({ next }: SignupFormProps) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(signUp, null);
  // The answer whose code step the visitor left with "Ganti email"; the next answer is a new one.
  const [left, setLeft] = useState<AuthFormState>(null);
  // The password typed on this step, for the code step. Memory only: never stored, never sent back.
  const [typedPassword, setTypedPassword] = useState("");
  const form = useFocusFirstError(state);
  const resultKey = useResultKey(state);
  const errors = state?.fieldErrors ?? {};
  const formError = state?.formError;

  // Back from the code step: the cursor goes to the email, to fix it.
  useEffect(() => {
    if (left) form.current?.querySelector<HTMLElement>('input[name="email"]')?.focus();
  }, [left, form]);

  function rememberPassword(event: FormEvent<HTMLFormElement>) {
    const typed = new FormData(event.currentTarget).get("password");
    setTypedPassword(typeof typed === "string" ? typed : "");
  }

  if (state?.codeSent && state !== left) {
    return (
      <SignupCodeStep
        email={(state.values?.email ?? "").trim()}
        password={typedPassword}
        next={next}
        onChangeEmail={() => setLeft(state)}
      />
    );
  }

  return (
    <form ref={form} action={formAction} onSubmit={rememberPassword} noValidate className="flex flex-col">
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="flex flex-col gap-4">
        <TextField
          id="signup-name"
          name="fullName"
          type="text"
          look="forest"
          label={t("fields.fullName")}
          autoComplete="name"
          required
          defaultValue={state?.values?.fullName}
          error={errors.fullName && t(`errors.${errors.fullName}`)}
        />
        <TextField
          id="signup-email"
          name="email"
          type="email"
          look="forest"
          label={t("fields.email")}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state?.values?.email}
          error={errors.email && t(`errors.${errors.email}`)}
        />
        <PasswordField
          id="signup-password"
          name="password"
          look="forest"
          label={t("fields.password")}
          hint={t("fields.passwordHint")}
          showLabel={t("fields.showPassword")}
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          required
          error={errors.password && t(`errors.${errors.password}`)}
        />
      </div>
      <FormAlert message={formError && t(`errors.${formError}`)} tone="danger" resultKey={resultKey} />
      <SubmitButton tone="forest" pending={pending} label={t("signup.submit")} pendingLabel={t("signup.pending")} />
    </form>
  );
}
