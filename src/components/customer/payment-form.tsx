"use client";

import { ArrowRight, CircleAlert, LoaderCircle, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { startPayment } from "@/lib/payment/actions";

// "Bayar sekarang" on the order confirmation (T10). The form sends only the order's id and the page's
// language; startPayment checks the signed-in customer and reads the price from their own order on the
// server, then sends the browser to Midtrans' Sandbox payment page (a payment started before is opened
// again, not made twice). When it cannot, the reason appears in the alert above the button and the
// button works again. The button stays busy until the browser has left for Midtrans.
// Sources: node_modules/next/dist/docs/01-app/02-guides/forms.md ("Validation errors", "Pending
// states"), node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md (absolute
// URLs) and https://react.dev/reference/react/useActionState
export function PaymentForm({ orderId }: { orderId: string }) {
  const t = useTranslations("Payment");
  const locale = useLocale();
  const [state, action, pending] = useActionState(startPayment, null);
  // Counts the presses, so the same refusal twice is announced twice.
  const [presses, setPresses] = useState(0);
  const error = state?.formError;

  return (
    <form action={action} onSubmit={() => setPresses((count) => count + 1)} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="locale" value={locale} />
      <p className="flex items-start gap-2.5 text-sm text-ink-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
        <span>
          {t("secureNote")} <span className="font-medium text-ink">{t("sandboxNote")}</span>
        </span>
      </p>
      <div role="alert" aria-atomic="true">
        {error && !pending ? (
          <p
            key={presses}
            className="flex items-start gap-2.5 rounded-md bg-danger-surface px-4 py-3 text-sm font-medium text-danger"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t(`errors.${error}`)}</span>
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-[background-color,color,transform] duration-150 ease-out-quart ${
          pending
            ? "cursor-progress bg-brand-700 text-on-brand"
            : "bg-brand-600 text-on-brand hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800"
        }`}
      >
        {pending ? <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden="true" /> : null}
        {pending ? t("pending") : t("submit")}
        {pending ? null : <ArrowRight className="size-5 shrink-0" aria-hidden="true" />}
      </button>
    </form>
  );
}
