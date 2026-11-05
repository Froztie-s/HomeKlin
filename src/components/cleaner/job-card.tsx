"use client";

import { CircleCheck, CircleAlert, Clock, MapPin, MapPinCheck, TimerOff, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { checkInState, type CheckInState } from "@/lib/jobs/check-in";
import { CheckInButton } from "./check-in-button";
import { CheckOutForm } from "./check-out-form";
import { FinishedNoteLine } from "./finished-notes";
import { StreamControl } from "./stream-control";

export type JobCardJob = {
  id: string;
  startsAt: string;
  endsAt: string;
  checkedInAt: string | null;
  completedAt: string | null;
};

/** Times already written in Jakarta time on the server ("12.45"), so the browser formats nothing. */
export type JobCardTimes = {
  opensAt: string;
  endsAt: string;
  checkedInAt: string | null;
  completedAt: string | null;
};

type JobCardProps = {
  job: JobCardJob;
  times: JobCardTimes;
  /** The server's clock when the page was rendered, so the first render matches the HTML. */
  renderedAt: string;
  /** The service, window, address and customer, rendered on the server. */
  children: ReactNode;
};

// The state as a word with an icon, never colour alone (markdown/PRODUCT.md, Accessibility).
const pills: Record<CheckInState, { Icon: LucideIcon; tone: string }> = {
  early: { Icon: Clock, tone: "bg-surface-sunken text-ink-muted" },
  open: { Icon: MapPin, tone: "bg-info-surface text-info" },
  late: { Icon: TimerOff, tone: "bg-warning-surface text-warning" },
  checkedIn: { Icon: MapPinCheck, tone: "bg-live-surface text-live" },
  completed: { Icon: CircleCheck, tone: "bg-success-surface text-success" },
};

// One of the cleaner's jobs on /cleaner (T17, T18): its state first, then the job, then the one thing
// to do now. The state follows the clock (checkInState, the rule the database enforces too), so a page
// left open shows the Check-in button once check-in opens, 15 minutes before the window, and hides it
// once the window has closed. The state line is a live region: what changes in it is announced.
// A job in progress also has its live stream controls (T22, ./stream-control.tsx) above Check-out.
export function JobCard({ job, times, renderedAt, children }: JobCardProps) {
  const t = useTranslations("CleanerJobActions");
  const now = useNow(renderedAt);
  const state = checkInState(job, new Date(now));
  const { Icon, tone } = pills[state];

  // After a check-in on this card, the Check-in button is gone: the focus goes to Check-out.
  const [checkedInHere, setCheckedInHere] = useState(false);
  const checkOutRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (checkedInHere && state === "checkedIn") checkOutRef.current?.focus();
  }, [checkedInHere, state]);

  return (
    <article
      aria-labelledby={`job-${job.id}-title`}
      className="flex h-full flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-card md:p-5"
    >
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${tone}`}>
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {t(`status.${state}`)}
      </span>
      {children}
      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
        <p role="status" className="text-sm text-ink-muted empty:hidden">
          <StateLine state={state} times={times} />
        </p>
        {state === "open" ? <CheckInButton orderId={job.id} onCheckedIn={() => setCheckedInHere(true)} /> : null}
        {state === "checkedIn" ? <StreamControl orderId={job.id} /> : null}
        {state === "checkedIn" ? <CheckOutForm orderId={job.id} buttonRef={checkOutRef} /> : null}
        {state === "completed" ? <FinishedNoteLine orderId={job.id} /> : null}
      </div>
    </article>
  );
}

function StateLine({ state, times }: { state: CheckInState; times: JobCardTimes }) {
  const t = useTranslations("CleanerJobActions");
  switch (state) {
    case "early":
      return t("opensAt", { time: times.opensAt });
    case "open":
      return t("checkInNote");
    case "late":
      return (
        <span className="flex items-start gap-2 text-warning">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{t("lateBody", { time: times.endsAt })}</span>
        </span>
      );
    case "checkedIn":
      return (
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold text-ink">{times.checkedInAt ? t("checkedInAt", { time: times.checkedInAt }) : null}</span>
          <span>{t("checkOutNote")}</span>
        </span>
      );
    case "completed":
      return (
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold text-ink">{times.completedAt ? t("completedAt", { time: times.completedAt }) : null}</span>
          {times.checkedInAt ? <span>{t("checkedInAt", { time: times.checkedInAt })}</span> : null}
        </span>
      );
  }
}

/** The time now, from the server's render time at first, then from the browser every 20 seconds. */
function useNow(renderedAt: string): number {
  const [now, setNow] = useState(() => Date.parse(renderedAt));
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return now;
}
