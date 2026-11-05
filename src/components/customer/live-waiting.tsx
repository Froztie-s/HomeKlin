"use client";

import { LogIn, Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { readStatusAnswer, statusPollMs, type StatusAnswer } from "./live-status";
import { RecordingNotice } from "./recording-notice";

// The live view of the customer's own job before there is a stream to watch (T23): the cleaner has not
// started it yet, or stopped it for a moment. About every 10 seconds it asks the API whether this
// viewer can watch now; once it can, the page renders again on the server, which makes the link.
export function LiveWaiting({ orderId }: { orderId: string }) {
  const t = useTranslations("LiveStream");
  const router = useRouter();
  const [signedOut, setSignedOut] = useState(false);

  const onAnswer = useEffectEvent((answer: StatusAnswer) => {
    if (answer.kind === "live") router.refresh();
    if (answer.kind === "signedOut") setSignedOut(true);
  });

  useEffect(() => {
    let stopped = false;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const response = await fetch(`/api/streams/${orderId}?status=1`, { cache: "no-store" });
        const body: unknown = await response.json().catch(() => null);
        if (!stopped) onAnswer(readStatusAnswer(response.status, body));
      } catch (error) {
        console.warn("[stream] could not check whether the stream has started:", error);
      }
    }, statusPollMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [orderId]);

  if (signedOut) {
    return (
      <RecordingNotice icon={LogIn} title={t("signedOutTitle")}>
        <p>{t("signedOutBody")}</p>
        <Link
          href="/login"
          className="mt-3 inline-flex min-h-touch items-center justify-center rounded-full border border-border-control bg-surface px-4 text-sm font-semibold text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50"
        >
          {t("signIn")}
        </Link>
      </RecordingNotice>
    );
  }

  return (
    <div role="status">
      <RecordingNotice icon={Radio} title={t("waitingTitle")}>
        {t("waitingBody")}
      </RecordingNotice>
    </div>
  );
}
