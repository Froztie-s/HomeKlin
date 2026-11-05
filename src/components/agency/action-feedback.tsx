"use client";

import { CircleAlert, CircleCheck } from "lucide-react";

type ActionFeedbackProps = {
  /** The refusal, in words, or nothing. */
  error?: string;
  /** What was done, in words, or nothing. */
  done?: string;
  /** Changes with every answer from the server, so the same message said twice is announced twice. */
  resultKey: number;
  /** compact: under a list row; roomy: under a form. */
  size?: "compact" | "roomy";
};

const sizes = {
  compact: "gap-1.5 text-xs",
  roomy: "gap-2.5 rounded-md px-4 py-3 text-sm",
};

// The answer to a back-office action (T27, T28): a refusal in an alert region, a success in a status
// region. Both regions are always on the page and empty until there is something to say, so a screen
// reader announces what is put into them. Icon and words, never colour alone.
export function ActionFeedback({ error, done, resultKey, size = "roomy" }: ActionFeedbackProps) {
  const box = sizes[size];
  const tone = (surface: string) => (size === "roomy" ? surface : "");
  // While there is nothing to say, the regions stay on the page but out of the flow (sr-only is
  // absolutely positioned), so they add no height and no gap to the form around them.
  return (
    <div className={error || done ? undefined : "sr-only"}>
      <div role="alert" aria-atomic="true">
        {error ? (
          <p key={resultKey} className={`flex items-start font-medium text-danger ${box} ${tone("bg-danger-surface")}`}>
            <CircleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
      <div role="status" aria-atomic="true">
        {done && !error ? (
          <p key={resultKey} className={`flex items-start font-medium text-success ${box} ${tone("bg-success-surface")}`}>
            <CircleCheck className="mt-px size-4 shrink-0" aria-hidden="true" />
            <span>{done}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
