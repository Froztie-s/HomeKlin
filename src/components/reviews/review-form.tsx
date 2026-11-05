"use client";

import { CircleAlert, LoaderCircle, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { TextAreaField, useResultKey } from "@/components/admin/form-fields";
import { submitReview } from "@/lib/reviews/actions";
import { ratingValues } from "./rating";

type ReviewFormProps = {
  orderId: string;
  /** The Petugas HomeKlin who did the job; without one there is no cleaner rating. */
  cleanerName: string | null;
};

const maxComment = 500;

// The review of a finished job (T30): 1 to 5 stars for the HomeKlin service (needed) and for the
// Petugas HomeKlin (optional), and an optional comment. The stars are a real radio group (arrow keys,
// screen readers, a 44 px target per star) drawn as stars, with the choice also in words. A missing
// service rating is said here before anything is sent; submitReview checks the customer, the job and
// the ratings again on the server. Once saved, the page shows the review instead of this form (the
// action refreshes the page). What was chosen stays if the server refuses it.
export function ReviewForm({ orderId, cleanerName }: ReviewFormProps) {
  const t = useTranslations("Reviews");
  const [state, formAction, pending] = useActionState(submitReview, null);
  const [missing, setMissing] = useState(false);
  const [sends, setSends] = useState(0);
  const resultKey = useResultKey(state) + sends;
  const firstStar = useRef<HTMLInputElement>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    if (!data.get("serviceRating")) {
      setMissing(true);
      setSends((count) => count + 1);
      firstStar.current?.focus();
      return;
    }
    setMissing(false);
    startTransition(() => formAction(data));
  }

  const error = missing ? t("missingService") : state?.formError && !pending ? t(`errors.${state.formError}`) : null;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="orderId" value={orderId} />
      <StarGroup
        name="serviceRating"
        label={t("serviceGroup")}
        firstRef={firstStar}
        invalid={missing}
        onChoose={() => setMissing(false)}
      />
      {cleanerName ? (
        <StarGroup name="cleanerRating" label={t("cleanerLabel")} accessibleLabel={t("cleanerGroup", { name: cleanerName })} detail={cleanerName} />
      ) : null}
      <TextAreaField id={`ulasan-${orderId}`} name="comment" label={t("comment")} hint={t("commentHint")} maxLength={maxComment} rows={3} />
      <div role="alert" aria-atomic="true">
        {error ? (
          <p key={resultKey} className="flex items-start gap-2.5 rounded-md bg-danger-surface px-4 py-3 text-sm font-medium text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-6 text-sm font-semibold text-on-brand transition-[background-color,transform] duration-150 ease-out-quart hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800 disabled:cursor-progress disabled:bg-brand-700 disabled:active:scale-100 sm:w-fit"
      >
        {pending ? <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
        {pending ? t("pending") : t("submit")}
      </button>
    </form>
  );
}

type StarGroupProps = {
  name: "serviceRating" | "cleanerRating";
  /** The visible name of the group. */
  label: string;
  /** The group's name for screen readers when it says more than the visible one. */
  accessibleLabel?: string;
  /** A second line under the name (the cleaner's name). */
  detail?: string;
  firstRef?: React.Ref<HTMLInputElement>;
  invalid?: boolean;
  onChoose?: () => void;
};

function StarGroup({ name, label, accessibleLabel, detail, firstRef, invalid = false, onChoose }: StarGroupProps) {
  const t = useTranslations("Reviews");
  const [value, setValue] = useState(0);
  const labelId = `${name}-label`;

  return (
    <div
      role="radiogroup"
      aria-labelledby={accessibleLabel ? undefined : labelId}
      aria-label={accessibleLabel}
      aria-invalid={invalid || undefined}
      className="flex flex-col gap-1.5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 px-1">
        <p id={labelId} className="text-sm font-medium text-ink">
          {label}
          {detail ? <span className="font-normal text-ink-muted"> · {detail}</span> : null}
        </p>
        <p aria-hidden="true" className={`text-sm tabular-nums ${value ? "font-semibold text-ink" : "text-ink-faint"}`}>
          {value ? t("chosen", { count: value }) : t("notChosen")}
        </p>
      </div>
      <div className={`-ml-1 flex w-fit rounded-full ${invalid ? "bg-danger-surface ring-1 ring-danger" : ""}`}>
        {ratingValues.map((star) => (
          <label
            key={star}
            className="group relative inline-flex size-touch cursor-pointer items-center justify-center rounded-full transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-[-2px] has-focus-visible:outline-focus"
          >
            <input
              ref={star === 1 ? firstRef : undefined}
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => {
                setValue(star);
                onChoose?.();
              }}
              // Invisible but covering the whole star, so a tap or click lands on the radio itself.
              className="absolute inset-0 size-full cursor-pointer appearance-none rounded-full opacity-0 focus-visible:outline-none"
            />
            <span className="sr-only">{t("stars", { count: star })}</span>
            <Star
              aria-hidden="true"
              strokeWidth={1.75}
              className={`size-7 transition-colors duration-150 ease-out-quart ${
                star <= value ? "fill-rating text-rating" : "fill-none text-border-control group-hover:text-rating"
              }`}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
