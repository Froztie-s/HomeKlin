"use client";

import { ArrowRight, CircleAlert, LoaderCircle, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useActionState, useId, type MouseEvent } from "react";
import { findOrder } from "@/lib/jobs/order-search-actions";

// Admin's order search (audit item 1): before it, the only way into an order's page was its number on
// a live monitor card, which lists today's jobs only. The field sits in the admin shell on the dark
// band, under the role card in the sidebar and at the top of the menu below 1024 px, so it is there on
// every admin page. It posts to a Server Action (src/lib/jobs/order-search-actions.ts), which checks
// the role, writes the number the way the database does and goes to /admin/orders/<number>; an input
// that cannot be an order number comes back as a message under the field, without leaving the page.
// It works as a plain post before the script has loaded. Each page starts with an empty field: the
// form is keyed by the address, so an old error does not follow admin to the next page.
// Sources: node_modules/next/dist/docs/01-app/02-guides/forms.md ("Validation errors", "Pending
// states") and https://react.dev/reference/react/useActionState
export function OrderSearch() {
  const pathname = usePathname();
  return <OrderSearchForm key={pathname} />;
}

function OrderSearchForm() {
  const t = useTranslations("AdminOrderSearch");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(findOrder, null);
  const inputId = useId();
  const errorId = useId();
  const error = state && !pending ? t(`errors.${state.error}`) : null;

  function holdWhilePending(event: MouseEvent<HTMLButtonElement>) {
    if (pending) event.preventDefault();
  }

  return (
    <form action={formAction} role="search" aria-labelledby={`${inputId}-label`} className="flex flex-col gap-1.5">
      <input type="hidden" name="locale" value={locale} />
      <label id={`${inputId}-label`} htmlFor={inputId} className="px-1 text-xs font-medium text-on-band-muted">
        {t("label")}
      </label>
      <div className="flex items-center gap-1.5">
        <span className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-on-band-muted" aria-hidden="true" />
          <input
            id={inputId}
            name="code"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={32}
            defaultValue={state?.value ?? ""}
            placeholder={t("placeholder")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="h-touch w-full rounded-full bg-band-raised pr-3 pl-10 text-base text-on-band tabular-nums inset-ring-[1.5px] inset-ring-transparent transition-shadow duration-150 ease-out-quart placeholder:text-on-band-muted hover:inset-ring-on-band-muted/60 aria-invalid:inset-ring-danger-surface lg:text-sm"
          />
        </span>
        <button
          type="submit"
          aria-disabled={pending || undefined}
          onClick={holdWhilePending}
          // An outlined circle with the lime arrow (design.md: lime is a text colour on dark green), so the
          // shell's search does not compete with the page's own action.
          className="inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full text-lime inset-ring-[1.5px] inset-ring-on-band-muted/60 transition-[background-color,transform] duration-150 ease-out-quart hover:bg-band-raised active:scale-[0.96] active:bg-band-raised aria-disabled:cursor-progress aria-disabled:active:scale-100 motion-reduce:active:scale-100"
        >
          {pending ? (
            <LoaderCircle className="size-4.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <ArrowRight className="size-4.5" aria-hidden="true" />
          )}
          <span className="sr-only">{pending ? t("pending") : t("submit")}</span>
        </button>
      </div>
      <div role="alert" aria-atomic="true">
        {error ? (
          <p id={errorId} className="flex items-start gap-1.5 rounded-md bg-danger-surface px-3 py-2 text-xs font-medium text-danger">
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </form>
  );
}
