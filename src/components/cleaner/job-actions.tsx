"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { checkInState, type CheckInState } from "@/lib/jobs/check-in";
import { CheckInButton } from "./check-in-button";
import { CheckOutForm } from "./check-out-form";
import { FinishedNoteLine, FinishedNotesProvider } from "./finished-notes";
import { StatePill, useNow, type JobTimesOnly } from "./job-state";
import type { CleanerStream } from "./stream-control-state";
import { StreamControl } from "./stream-control";

export type JobActionsJob = JobTimesOnly & { id: string };

/** Times already written in Jakarta time on the server ("12.45"), so the browser formats nothing. */
export type JobActionTimes = {
  opensAt: string;
  endsAt: string;
  checkedInAt: string | null;
  completedAt: string | null;
};

type JobActionsProps = {
  job: JobActionsJob;
  times: JobActionTimes;
  /** The server's clock when the page was rendered, so the first render matches the HTML. */
  renderedAt: string;
  /** The stream's state on the server (my_stream_status) when the page was rendered; null when unknown. */
  stream: CleanerStream | null;
};

// What the cleaner does on a job's page (/cleaner/jobs/HK-1042; D4, mocks Cleaner-Job and Cleaner-Live;
// T18, T22): the state first, then the one thing to do now. The state follows the clock (checkInState,
// the rule the database enforces too), so a page left open shows the Check-in button once check-in
// opens, 15 minutes before the window, and hides it once the window has closed. The state line is a live
// region: what changes in it is announced. A job in progress has its live stream controls
// (./stream-control.tsx) above Check-out; a finished job says how check-out went on this visit.
export function JobActions({ job, times, renderedAt, stream }: JobActionsProps) {
  const t = useTranslations("CleanerJobActions");
  const now = useNow(renderedAt);
  const state = checkInState(job, new Date(now));

  // After a check-in here, the Check-in button is gone: the focus goes to Check-out.
  const [checkedInHere, setCheckedInHere] = useState(false);
  const checkOutRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (checkedInHere && state === "checkedIn") checkOutRef.current?.focus();
  }, [checkedInHere, state]);

  return (
    <FinishedNotesProvider>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <StatePill state={state} />
          <p role="status" className="text-sm text-ink-muted empty:hidden">
            <StateLine state={state} times={times} />
          </p>
        </div>
        {state === "open" ? (
          <div className="flex flex-col gap-3">
            <CheckInButton orderId={job.id} onCheckedIn={() => setCheckedInHere(true)} />
            {/* The next step in one quiet line, not a full-size disabled button (2026-11-20, UX audit item 11). */}
            <p className="text-center text-sm text-ink-muted">{t("checkOutLocked")}</p>
          </div>
        ) : null}
        {state === "checkedIn" ? <StreamControl orderId={job.id} serverStream={stream} /> : null}
        {state === "checkedIn" ? <CheckOutForm orderId={job.id} buttonRef={checkOutRef} /> : null}
        {state === "completed" ? <FinishedNoteLine orderId={job.id} /> : null}
      </div>
    </FinishedNotesProvider>
  );
}

function StateLine({ state, times }: { state: CheckInState; times: JobActionTimes }) {
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
