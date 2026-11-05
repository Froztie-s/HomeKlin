"use client";

import { ChevronDown, LoaderCircle, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useId, useState, type FormEvent } from "react";
import { useResultKey } from "@/components/admin/form-fields";
import { Link } from "@/i18n/navigation";
import { assignCleaner, type JobFailureKey } from "@/lib/jobs/actions";
import { ActionFeedback } from "./action-feedback";
import { primaryButton, rowControl } from "./styles";

type AssignCleanerProps = {
  orderId: string;
  /** The agency's own cleaners, by name. */
  cleaners: readonly { id: string; fullName: string }[];
  /** Who is assigned now, if anyone. */
  cleanerId: string | null;
};

type State = { formError?: JobFailureKey; assigned?: string } | null;

const shownErrors = ["notAllowed", "notFound", "cleanerNotFound", "started"] as const;
type ShownError = (typeof shownErrors)[number] | "unavailable";
const shown = (key: JobFailureKey): ShownError => (shownErrors as readonly string[]).includes(key) ? (key as ShownError) : "unavailable";

// "Tugaskan" on a job that has not started (T28): one of the agency's own cleaners, chosen from a native
// select, and a button. assignCleaner (src/lib/jobs/actions.ts) checks the role, and the database checks
// that the job and the cleaner are this agency's and that nobody has checked in yet; a refusal comes back
// as words under the control. The choice is kept after an answer; the table then shows the new status.
export function AssignCleaner({ orderId, cleaners, cleanerId }: AssignCleanerProps) {
  const t = useTranslations("AgencyOrdersPage.assign");
  const id = useId();
  const [choice, setChoice] = useState(cleanerId ?? "");
  const [state, formAction, pending] = useActionState(async (previous: State, formData: FormData): Promise<State> => {
    void previous;
    const result = await assignCleaner(null, formData);
    if (!result?.ok) return { formError: result?.formError ?? "unavailable" };
    return { assigned: String(formData.get("cleanerId") ?? "") };
  }, null);
  const resultKey = useResultKey(state);

  if (cleaners.length === 0) {
    return (
      <span className="flex flex-col items-start gap-1 text-sm text-ink-muted">
        {t("noCleaners")}
        <Link href="/agency/cleaners" className="inline-flex min-h-touch items-center gap-1.5 font-semibold text-brand-700 underline-offset-4 hover:underline">
          <UserPlus className="size-4 shrink-0" aria-hidden="true" />
          {t("addCleaners")}
        </Link>
      </span>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const assignedName = state?.assigned ? cleaners.find((cleaner) => cleaner.id === state.assigned)?.fullName : undefined;

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-1.5">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${id}-cleaner`} className="sr-only">
          {t("label")}
        </label>
        <span className="relative min-w-0 flex-1 basis-40">
          <select
            id={`${id}-cleaner`}
            name="cleanerId"
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            aria-invalid={state?.formError ? true : undefined}
            className={`${rowControl} w-full cursor-pointer appearance-none pr-10 text-sm`}
          >
            <option value="" disabled>
              {t("placeholder")}
            </option>
            {cleaners.map((cleaner) => (
              <option key={cleaner.id} value={cleaner.id}>
                {cleaner.fullName}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
        </span>
        <button type="submit" aria-disabled={pending || undefined} className={primaryButton}>
          {pending ? <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
          {pending ? t("pending") : t("submit")}
        </button>
      </div>
      <ActionFeedback
        error={state?.formError ? t(`errors.${shown(state.formError)}`) : undefined}
        done={assignedName && !pending ? t("done", { name: assignedName }) : undefined}
        resultKey={resultKey}
        size="compact"
      />
    </form>
  );
}
