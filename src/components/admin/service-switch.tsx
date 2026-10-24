"use client";

import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, type MouseEvent } from "react";
import { setServiceActive } from "@/lib/catalog/admin-actions";

type ServiceSwitchProps = {
  id: string;
  /** The service's name, for the switch's accessible name and the announcement. */
  name: string;
  isActive: boolean;
};

// Shows a service in the customer catalog or takes it out, straight from the list (T7b). A switch,
// because the change takes effect at once, like a light switch: the form posts the state it asks for
// (not "toggle"), so sending it twice changes nothing more. While the server works, the switch shows
// the state it asked for with a spinner; the answer re-renders the list with the stored state, so a
// failed change falls back by itself and says why. The word beside it carries the state too, never
// the colour alone. It works before JavaScript loads (a plain form post).
// Sources: https://react.dev/reference/react/useActionState and
// https://www.w3.org/WAI/ARIA/apg/patterns/switch/
export function ServiceSwitch({ id, name, isActive }: ServiceSwitchProps) {
  const t = useTranslations("AdminServiceSwitch");
  const [state, formAction, pending] = useActionState(setServiceActive, null);
  const shown = pending ? !isActive : isActive;
  const errorId = `switch-${id}-error`;
  const failure = state && !state.ok ? t(`errors.${state.formError}`) : undefined;
  const done = state?.ok ? t(state.isActive ? "nowActive" : "nowInactive", { name }) : "";

  // Keeps focus on the switch while the request runs (a disabled button would drop it) and sends one
  // request per state.
  function holdWhilePending(event: MouseEvent<HTMLButtonElement>) {
    if (pending) event.preventDefault();
  }

  return (
    <form action={formAction} className="flex flex-col items-start">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          role="switch"
          aria-checked={shown}
          aria-label={t("label", { name })}
          aria-describedby={failure ? errorId : undefined}
          aria-disabled={pending || undefined}
          onClick={holdWhilePending}
          className="group inline-flex size-touch shrink-0 items-center justify-center rounded-full transition-transform duration-150 ease-out-quart active:scale-[0.96] aria-disabled:cursor-progress"
        >
          <span
            aria-hidden="true"
            className={`flex h-6 w-11 items-center rounded-full border p-0.5 transition-colors duration-150 ease-out-quart ${
              shown
                ? "border-brand-600 bg-brand-600 group-hover:border-brand-700 group-hover:bg-brand-700"
                : "border-border-control bg-surface-sunken group-hover:border-brand-600"
            }`}
          >
            <span
              className={`flex size-4.5 items-center justify-center rounded-full bg-surface shadow-card transition-transform duration-150 ease-out-quart ${
                shown ? "translate-x-5" : "translate-x-0"
              }`}
            >
              {pending ? (
                <LoaderCircle className="size-3 animate-spin text-ink-muted" />
              ) : shown ? (
                <Check className="size-3 text-brand-700" strokeWidth={3} />
              ) : null}
            </span>
          </span>
        </button>
        <span className={`text-sm font-medium ${shown ? "text-ink" : "text-ink-muted"}`}>
          {shown ? t("active") : t("inactive")}
        </span>
      </div>
      {/* Always on the page and empty until there is a problem, so a screen reader announces it. */}
      <p id={errorId} role="alert" className="max-w-56">
        {failure ? (
          <span className="mb-1 flex items-start gap-1.5 text-xs font-medium text-danger">
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {failure}
          </span>
        ) : null}
      </p>
      <p role="status" className="sr-only">
        {done}
      </p>
    </form>
  );
}
