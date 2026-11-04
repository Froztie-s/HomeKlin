"use client";

import { CircleAlert, LoaderCircle, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useState } from "react";
import { checkIn, type JobActionState } from "@/lib/jobs/actions";

type CheckInButtonProps = {
  orderId: string;
  /** Called once the server has recorded the check-in. */
  onCheckedIn: () => void;
};

type LocationProblem = "denied" | "unavailable";

// About 15 seconds for a fix: long enough for GPS outdoors, short enough to say what is wrong.
const locationOptions: PositionOptions = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 };

// The big Check-in button on a job whose window is open (T18). It asks the browser for the location,
// then sends it with the job's id to checkIn, which checks the cleaner, the job and the time window on
// the server (supabase/migrations/20261104090000_jobs.sql) and records the time and place. A refused or
// missing location says how to fix it and keeps the button; so does every refusal from the server.
// Busy while it locates and while the server records, without losing the focus.
// Sources: https://developer.mozilla.org/docs/Web/API/Geolocation/getCurrentPosition and
// https://react.dev/reference/react/useActionState (calling the action from a transition)
export function CheckInButton({ orderId, onCheckedIn }: CheckInButtonProps) {
  const t = useTranslations("CleanerJobActions");
  const [state, action, recording] = useActionState(checkIn, null);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<LocationProblem | null>(null);
  // The server's answer from before the latest press is not shown again.
  const [seen, setSeen] = useState<JobActionState>(null);
  const busy = locating || recording;
  const errorId = `check-in-${orderId}-error`;

  useEffect(() => {
    if (state?.ok) onCheckedIn();
  }, [state, onCheckedIn]);

  function start() {
    if (busy) return;
    setProblem(null);
    setSeen(state);
    if (!("geolocation" in navigator)) {
      setProblem("unavailable");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const form = new FormData();
        form.set("orderId", orderId);
        form.set("lat", String(position.coords.latitude));
        form.set("lng", String(position.coords.longitude));
        form.set("accuracy", String(position.coords.accuracy));
        startTransition(() => action(form));
      },
      (error) => {
        setLocating(false);
        setProblem(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      locationOptions,
    );
  }

  const serverError = state !== seen && !recording ? state?.formError : undefined;
  const message = problem ? t(`location.${problem}`) : serverError ? t(`errors.${serverError}`) : null;

  return (
    <div className="flex flex-col gap-3">
      <div id={errorId} role="alert" aria-atomic="true">
        {message ? (
          <p className="flex items-start gap-2.5 rounded-md bg-danger-surface px-3 py-2.5 text-sm font-medium text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{message}</span>
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={start}
        aria-disabled={busy || undefined}
        aria-describedby={message ? errorId : undefined}
        className={`inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full px-6 text-lg font-semibold transition-[background-color,transform] duration-150 ease-out-quart ${
          busy
            ? "cursor-progress bg-brand-700 text-on-brand"
            : "bg-brand-600 text-on-brand hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800"
        }`}
      >
        {busy ? (
          <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <MapPin className="size-5 shrink-0" aria-hidden="true" />
        )}
        {locating ? t("locating") : recording ? t("checkingIn") : t("checkIn")}
      </button>
    </div>
  );
}
