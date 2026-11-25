"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { signUp } from "@/lib/auth/actions";
import { FormAlert, PasswordField, SubmitButton, TextField, useFocusFirstError, useResultKey } from "./form-controls";

type SignupFormProps = {
  /** The page to open after signing up (?next=), carried on in a hidden field. */
  next?: string;
};

// Create a customer account (T5, back on 2026-11-20: ordering now needs an account, the user's
// decision). Every sign-up is a customer; the database ignores any role sent with it, and staff
// accounts are made by HomeKlin. The signUp Server Action checks the input with Zod and signs the new
// customer in at once, then opens /home or `next` (for example the order they were about to place).
// The look is the sign-in card's (forest), the same pattern as the password form.
// Sources: node_modules/next/dist/docs/01-app/02-guides/forms.md and
// https://react.dev/reference/react/useActionState
export function SignupForm({ next }: SignupFormProps) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(signUp, null);
  const form = useFocusFirstError(state);
  const resultKey = useResultKey(state);
  const errors = state?.fieldErrors ?? {};
  const formError = state?.formError;

  return (
    <form ref={form} action={formAction} noValidate className="flex flex-col">
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
      <FormAlert
        message={formError && t(`errors.${formError}`)}
        tone={formError === "confirmEmail" ? "info" : "danger"}
        resultKey={resultKey}
      />
      <SubmitButton tone="forest" pending={pending} label={t("signup.submit")} pendingLabel={t("signup.pending")} />
    </form>
  );
}
