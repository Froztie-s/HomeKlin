"use client";

import { CircleAlert, CircleCheck, Link2Off, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { revokeOrderLinks } from "@/lib/booking/email-actions";
import { flowQuietButton } from "./flow-styles";

// "Batalkan tautan email" on the signed-in order page (B14a, review H1): the order's customer cancels
// every private link in the order's emails, for example after forwarding one by mistake. No confirm
// step: nothing is lost, the next email carries a new link, and the answer says plainly what happened.
// revokeOrderLinks checks the signed-in customer and that the order is theirs. Since the UX audit
// (2026-11-18, item 5) it is a quiet text button under "Kirim ulang email", the card's one button.
// Source: node_modules/next/dist/docs/01-app/02-guides/forms.md ("Validation errors", "Pending states")
export function RevokeLinks({ orderId }: { orderId: string }) {
  const t = useTranslations("OrderEmails.revoke");
  const [state, action, pending] = useActionState(revokeOrderLinks, null);
  // Counts the presses, so the same answer twice is announced twice.
  const [presses, setPresses] = useState(0);

  return (
    <form action={action} onSubmit={() => setPresses((count) => count + 1)} className="flex flex-col gap-1">
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" disabled={pending} className={`${flowQuietButton} w-fit`}>
        {pending ? (
          <LoaderCircle className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Link2Off className="size-4 shrink-0" aria-hidden="true" />
        )}
        {pending ? t("pending") : t("submit")}
      </button>
      <div role="status" aria-atomic="true">
        {!pending && state?.ok ? (
          <p key={presses} className="flex items-start gap-2 text-sm font-medium text-success">
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t("done")}</span>
          </p>
        ) : null}
        {!pending && state?.formError ? (
          <p key={presses} className="flex items-start gap-2 text-sm font-medium text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t(`errors.${state.formError}`)}</span>
          </p>
        ) : null}
      </div>
    </form>
  );
}
