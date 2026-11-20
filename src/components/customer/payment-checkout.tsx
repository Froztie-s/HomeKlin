"use client";

import { CircleAlert, LoaderCircle, Lock, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { changePaymentMethod, payOrder, type PaymentFailureKey } from "@/lib/payment/actions";
import { isMidtransAddress, type Bank, type PaymentChoice, type PaymentDetails } from "@/lib/payment/methods";
import { BookingBar } from "./booking-bar";
import { parseCard, type CardFields } from "./card-input";
import { flowCard, flowOutlineButton, flowPrimaryButton } from "./flow-styles";
import { authenticateCard, getCardToken, type CardError } from "./midtrans-card";
import { PaymentMethods, type MethodKey } from "./payment-methods";
import { PaymentWaiting } from "./payment-waiting";

type Props = {
  orderId: string;
  /** What the server kept for the order's current attempt, or null while no method is charged. */
  details: PaymentDetails | null;
  /** Midtrans' public client key, for cards; null leaves the card option out. */
  clientKey: string | null;
  amountText: string;
  /** The order card's title, rows and total, written by the server. */
  summary: ReactNode;
  /** Under the button: the link to the order's page. */
  footer: ReactNode;
  /** Beside the order card: the note about the email. */
  note: ReactNode;
  /** The service's name, for the phone bar. */
  serviceName: string;
};

/** The id of the card's own "Bayar sekarang": while it is on screen, the phone bar steps aside. */
const submitId = "bayar-kirim";

const emptyCard: CardFields = { number: "", expiry: "", cvv: "" };

// Step 3 of ordering, the part that pays (mocks Customer-Payment and Phone-Payment): the customer
// chooses QRIS, a bank's virtual account or a card on HomeKlin's own page and presses "Bayar sekarang".
// The server charges that one method at Midtrans' Sandbox (payOrder checks the customer and charges
// the price stored on their own order); what Midtrans answers, an account number or a QR code, is
// shown on this page (PaymentWaiting) until Midtrans' signed notification marks the order paid, which
// the page notices by reading the order again. A card is swapped for a one-time token in the browser
// (midtrans-card.ts): the number never reaches HomeKlin. A card may need the bank's 3-D Secure page,
// shown in a frame over this one. On phones the button sits under the order card, far below the
// methods, so a bar with the service, the chosen method, the price and its own "Bayar sekarang" stays
// above the bottom navigation, as on steps 1 and 2 (./booking-bar.tsx; 2026-11-20, UX audit item 9).
export function PaymentCheckout({ orderId, details, clientKey, amountText, summary, footer, note, serviceName }: Props) {
  const t = useTranslations("PaymentChooser");
  const tp = useTranslations("Payment");
  const locale = useLocale();
  const router = useRouter();
  const [method, setMethod] = useState<MethodKey>("qris");
  const [bank, setBank] = useState<Bank>("bca");
  const [card, setCard] = useState<CardFields>(emptyCard);
  const [error, setError] = useState<string | null>(null);
  // Counts the presses, so the same refusal twice is announced twice.
  const [presses, setPresses] = useState(0);
  const [working, setWorking] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const busy = working || refreshing;

  const refresh = () => startRefresh(() => router.refresh());
  const failure = (key: PaymentFailureKey) => tp(`errors.${key}`);

  async function pay(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setPresses((count) => count + 1);
    setWorking(true);
    try {
      let choice: PaymentChoice;
      if (method === "card") {
        const data = parseCard(card);
        if (!data || !clientKey) return setError(t("errors.cardFields"));
        try {
          choice = { method: "card", tokenId: await getCardToken(clientKey, data) };
        } catch (cause) {
          return setError(t(cause instanceof Error && (cause.message as CardError) === "card_invalid" ? "errors.cardInvalid" : "errors.cardUnavailable"));
        }
        // The number is no longer needed, here or anywhere: only the token goes on.
        setCard(emptyCard);
      } else {
        choice = method === "qris" ? { method: "qris" } : { method: "bank", bank };
      }

      const result = await payOrder({ orderId, locale, choice });
      if (!result.ok) return setError(failure(result.error));
      if (result.declined) setError(t("errors.cardDeclined"));
      if (result.authenticateUrl && isMidtransAddress(result.authenticateUrl)) {
        // Not awaited: the form is free again while the bank's page is open, and its end only refreshes.
        void authenticateCard(result.authenticateUrl, setFrame).then((outcome) => {
          setFrame(null);
          if (outcome === "failure") setError(t("errors.cardNotVerified"));
          refresh();
        });
      }
      refresh();
    } finally {
      setWorking(false);
    }
  }

  async function change() {
    if (busy) return;
    setError(null);
    setWorking(true);
    try {
      const result = await changePaymentMethod({ orderId });
      if (!result.ok) return setError(failure(result.error));
      setFrame(null);
      refresh();
    } finally {
      setWorking(false);
    }
  }

  const alert = (
    <div role="alert" aria-atomic="true">
      {error ? (
        <p key={presses} className="flex items-start gap-2.5 rounded-sm bg-danger-surface px-4 py-3 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );

  const methodLabel =
    method === "bank" ? `${t("methods.bank.title")} ${t(`banks.${bank}`)}` : t(`methods.${method}.title`);

  const payButton = (compact: boolean) => (
    <button
      id={compact ? undefined : submitId}
      type="submit"
      disabled={busy}
      className={`${flowPrimaryButton} ${compact ? "min-h-12 w-auto shrink-0 px-4 text-sm" : ""} ${
        busy ? "cursor-progress disabled:bg-primary-container disabled:text-on-primary" : ""
      }`}
    >
      {busy ? (
        <LoaderCircle className="size-5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <Lock className="size-4.5 shrink-0" aria-hidden="true" />
      )}
      {busy ? t("pending") : tp("submit")}
    </button>
  );

  return (
    <form onSubmit={pay} noValidate className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-6">
      <div className="flex min-w-0 flex-col gap-3">
        {alert}
        {details ? (
          <PaymentWaiting details={details} amountText={amountText} changing={busy} onChange={change} />
        ) : (
          <PaymentMethods
            method={method}
            onMethod={setMethod}
            bank={bank}
            onBank={setBank}
            card={card}
            onCard={setCard}
            cardAvailable={clientKey !== null}
            disabled={busy}
          />
        )}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
        <div className={flowCard}>
          {summary}
          {details ? null : (
            <div className="mt-5">{payButton(false)}</div>
          )}
          {footer}
        </div>
        {note}
      </aside>

      {/* Inside the form, so its button submits the same choice. Off once a method is charged. */}
      <BookingBar
        watchId={submitId}
        title={serviceName}
        detail={methodLabel}
        price={amountText}
        action={payButton(true)}
        off={details !== null || frame !== null}
      />

      {frame ? (
        <div role="dialog" aria-modal="true" aria-label={t("threeDs.title")} className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
          <div className="flex h-[min(40rem,92dvh)] w-full max-w-md flex-col overflow-hidden rounded-lg bg-card">
            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <p className="font-semibold text-ink">{t("threeDs.title")}</p>
              <button
                type="button"
                onClick={() => {
                  setFrame(null);
                  refresh();
                }}
                className={`${flowOutlineButton} px-4`}
              >
                <X className="size-4" aria-hidden="true" />
                {t("threeDs.close")}
              </button>
            </div>
            <iframe src={frame} title={t("threeDs.title")} className="min-h-0 w-full flex-1 border-0 bg-white" />
          </div>
        </div>
      ) : null}
    </form>
  );
}
