"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { signIn } from "@/lib/auth/actions";
import { FormAlert, PasswordField, SubmitButton, TextField, useFocusFirstError, useResultKey } from "./form-controls";

type LoginFormProps = {
  /** The page to open after signing in (?next=), carried on in a hidden field. */
  next?: string;
};

// Sign in with email and password (T5): staff, cleaners and the demo accounts. Customers sign in
// by emailed code (login-code-form.tsx, T9b); the sign-in page shows this form at /login?cara=sandi. The form posts to the signIn Server Action, which checks the
// input with Zod, signs in with Supabase and sends the user to their role's home or to `next`. It also
// works before JavaScript loads (a plain form post). Browser validation is off (noValidate) so that
// every message comes from the server, in the page's language.
// Sources: node_modules/next/dist/docs/01-app/02-guides/forms.md ("Validation errors", "Pending
// states") and https://react.dev/reference/react/useActionState
export function LoginForm({ next }: LoginFormProps) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(signIn, null);
  const form = useFocusFirstError(state);
  const resultKey = useResultKey(state);
  const errors = state?.fieldErrors ?? {};
  const formError = state?.formError;

  return (
    <form ref={form} action={formAction} noValidate className="flex flex-col">
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="flex flex-col gap-5">
        <TextField
          id="login-email"
          name="email"
          type="email"
          label={t("fields.email")}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state?.values?.email}
          error={errors.email && t(`errors.${errors.email}`)}
        />
        <PasswordField
          id="login-password"
          name="password"
          label={t("fields.password")}
          showLabel={t("fields.showPassword")}
          autoComplete="current-password"
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
      <SubmitButton pending={pending} label={t("login.submit")} pendingLabel={t("login.pending")} />
    </form>
  );
}
