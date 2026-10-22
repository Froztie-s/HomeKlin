"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { signOut } from "@/lib/auth/actions";

type SignOutButtonProps = {
  /** Layout only (width); the look is fixed. */
  className?: string;
};

// Signing out (T5): a form that posts to the signOut Server Action, which ends the session in this
// browser and opens the landing page in the same language (the hidden locale field: root params do not
// reach Server Actions). A real form, so it works before JavaScript loads.
// Source: node_modules/next/dist/docs/01-app/02-guides/forms.md ("Pending states", useFormStatus)
export function SignOutButton({ className = "" }: SignOutButtonProps) {
  const locale = useLocale();
  return (
    <form action={signOut} className={className}>
      <input type="hidden" name="locale" value={locale} />
      <SignOutSubmit />
    </form>
  );
}

function SignOutSubmit() {
  const t = useTranslations("SignOut");
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-full border border-border-control bg-surface px-5 text-sm font-semibold whitespace-nowrap text-ink transition-[background-color,transform] duration-150 ease-out-quart hover:bg-surface-sunken active:scale-[0.98] active:bg-brand-50 disabled:cursor-progress disabled:bg-surface-sunken disabled:text-ink-muted disabled:active:scale-100"
    >
      {pending ? (
        <LoaderCircle className="size-4.5 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="size-4.5 shrink-0" aria-hidden="true" />
      )}
      {pending ? t("pending") : t("submit")}
    </button>
  );
}
