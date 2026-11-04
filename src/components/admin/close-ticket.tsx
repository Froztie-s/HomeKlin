"use client";

import { CircleAlert, LoaderCircle, Lock } from "lucide-react";
import { useActionState, useState } from "react";
import { closeTicket, type SupportFormState } from "@/lib/support/actions";

type CloseTicketProps = {
  ticketId: string;
  labels: { button: string; question: string; confirm: string; cancel: string; pending: string; error: string };
};

const outline =
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-full border border-border-control bg-surface px-4 text-sm font-semibold text-ink transition-[background-color,border-color,transform] duration-150 ease-out-quart hover:border-brand-600 hover:bg-surface-sunken active:scale-[0.98] active:bg-brand-50";

// "Tutup tiket" on the admin's chat (T21). Closing cannot be undone and ends the customer's chat, so it
// asks once more in place before closeTicket runs; the server checks the admin role again. Once the
// ticket is closed the chat hides this control and the customer's send box goes away (Realtime).
export function CloseTicket({ ticketId, labels }: CloseTicketProps) {
  const [state, formAction, pending] = useActionState<SupportFormState, FormData>(closeTicket, null);
  const [asking, setAsking] = useState(false);
  const failed = Boolean(state?.formError) && !pending;

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={`${outline} w-fit`}>
        <Lock className="size-4 shrink-0" aria-hidden="true" />
        {labels.button}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md bg-surface-sunken p-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <p className="text-sm font-medium text-ink">{labels.question}</p>
      <div role="alert" aria-atomic="true">
        {failed ? (
          <p className="flex items-start gap-1.5 text-sm font-medium text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{labels.error}</span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          autoFocus
          className={`inline-flex min-h-touch items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-on-brand transition-[background-color,transform] duration-150 ease-out-quart ${
            pending ? "cursor-progress bg-brand-700" : "bg-brand-600 hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800"
          }`}
        >
          {pending ? <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
          {pending ? labels.pending : labels.confirm}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setAsking(false)}
          className={`${outline} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}
