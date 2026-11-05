import { CalendarClock, CircleAlert, ShieldCheck, VideoOff } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ClientMessages } from "@/i18n/client-messages";
import { recordingLink, RecordingLinkError, type RecordingLink } from "@/lib/recordings/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { jakartaDayOf } from "./booking-query";
import { RecordingCountdown } from "./recording-countdown";
import { RecordingNotice } from "./recording-notice";
import { RecordingPlayer } from "./recording-player";
import type { RecordingState } from "./recording-time";
import { getSlotLabels } from "./slot-labels";

// "Rekaman" on a finished job's details (T15, SPEC "Who can replay"). A recording still kept plays in
// the browser's own player, with until when it is kept and a countdown. The link to the private file
// is made here on the server, with the customer's own session asking the database first (recordingLink,
// src/lib/recordings/link.ts): another customer never gets one, and the link stops working within
// 10 minutes. It is made behind <Suspense>, so the rest of the order shows at once. A recording past its
// 7 days says it was deleted for privacy, with no player; a job without one says so.

type OrderRecordingProps = {
  recordingId: string | null;
  state: Exclude<RecordingState, "none">;
  /** The moment the page is rendered; the countdown starts from it. */
  now: Date;
};

export async function OrderRecording({ recordingId, state, now }: OrderRecordingProps) {
  const t = await getTranslations("Recording");
  return (
    <section id="recording" aria-labelledby="recording-title" className="flex scroll-mt-4 flex-col gap-3 border-t border-border p-5 md:p-6">
      <h3 id="recording-title" className="font-display text-lg font-semibold text-ink">
        {t("title")}
      </h3>
      {state === "available" && recordingId ? (
        <Suspense fallback={<ReplayLoading />}>
          <Replay recordingId={recordingId} now={now} />
        </Suspense>
      ) : state === "expired" ? (
        <ExpiredNotice />
      ) : (
        <NoRecordingNotice />
      )}
    </section>
  );
}

async function Replay({ recordingId, now }: { recordingId: string; now: Date }) {
  let link: RecordingLink;
  try {
    const viewer = await createSupabaseServerClient({ writeCookies: false });
    link = await recordingLink(viewer, createSupabaseServiceClient(), recordingId);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof RecordingLinkError && error.reason === "recording_expired") return <ExpiredNotice />;
    if (error instanceof RecordingLinkError && error.reason === "recording_not_found") return <NoRecordingNotice />;
    console.error("[recording] could not make the replay link:", error);
    return <ReplayUnavailable />;
  }

  const locale = await getLocale();
  const [t, labels] = await Promise.all([getTranslations("Recording"), getSlotLabels(locale)]);
  const until = link.availableUntil;
  // Always the weekday and date ("Rabu, 11 November"), never "Besok" in the middle of a sentence.
  const day = labels.day({ date: jakartaDayOf(until, now).date, relative: null });

  return (
    <ClientMessages namespaces={["Recording"]}>
      <RecordingPlayer recordingId={recordingId} src={link.url} />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
        <p className="flex items-start gap-2 text-sm text-ink">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
          <span>{t("availableUntil", { day, time: labels.time(until) })}</span>
        </p>
        <RecordingCountdown expiresAt={until} renderedAt={now.getTime()} />
      </div>
      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
        <span>{t("privacy")}</span>
      </p>
    </ClientMessages>
  );
}

async function ReplayLoading() {
  const t = await getTranslations("Recording");
  return (
    <div role="status" className="flex aspect-video w-full items-center justify-center rounded-md bg-surface-sunken">
      <span className="text-sm text-ink-muted">{t("loading")}</span>
    </div>
  );
}

async function ExpiredNotice() {
  const t = await getTranslations("Recording");
  return (
    <RecordingNotice icon={ShieldCheck} title={t("expiredTitle")}>
      {t("expiredBody")}
    </RecordingNotice>
  );
}

async function NoRecordingNotice() {
  const t = await getTranslations("Recording");
  return (
    <RecordingNotice icon={VideoOff} title={t("noneTitle")}>
      {t("noneBody")}
    </RecordingNotice>
  );
}

async function ReplayUnavailable() {
  const t = await getTranslations("Recording");
  return (
    <RecordingNotice icon={CircleAlert} title={t("errorBody")}>
      {/* A plain link on purpose: a full page load makes the link again. */}
      <a
        href=""
        className="mt-2 inline-flex min-h-touch items-center justify-center rounded-full border border-border-control bg-surface px-5 text-sm font-semibold text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50"
      >
        {t("retry")}
      </a>
    </RecordingNotice>
  );
}
