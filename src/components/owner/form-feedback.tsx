import { CircleAlert, CircleCheck } from "lucide-react";

type FormFeedbackProps = {
  /** The refusal in words, or nothing. */
  error: string | null;
  /** Whether the field already shows `error` under itself; then the alert only announces it. */
  errorShownAtField: boolean;
  /** What was saved, in words, or nothing. */
  done: string | null;
  /** Changes with every answer (useResultKey), so the same message twice is announced twice. */
  resultKey: number;
};

// The answer to an owner form (T29c), in two live regions that are always on the page: an alert for a
// refusal and a status for a saved change, each with an icon and words. A refusal about one field is
// shown under that field and only announced here, so it is not read or shown twice.
export function FormFeedback({ error, errorShownAtField, done, resultKey }: FormFeedbackProps) {
  return (
    // One block, so the two (usually empty) regions take one gap in the form, not two.
    <div className="-my-2.5 flex flex-col has-[p]:my-0">
      <div role="alert" aria-atomic="true">
        {error ? (
          errorShownAtField ? (
            <span key={resultKey} className="sr-only">
              {error}
            </span>
          ) : (
            <p key={resultKey} className="flex items-start gap-2.5 rounded-md bg-danger-surface px-4 py-3 text-sm font-medium text-danger">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )
        ) : null}
      </div>
      <div role="status" aria-atomic="true">
        {done ? (
          <p key={resultKey} className="flex items-start gap-2.5 rounded-md bg-success-surface px-4 py-3 text-sm font-medium text-success">
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{done}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
