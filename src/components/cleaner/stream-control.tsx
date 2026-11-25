"use client";

import {
  CircleAlert,
  CircleStop,
  LoaderCircle,
  Radio,
  RotateCw,
  Video,
  Signal,
  SignalLow,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { setStreamStatus, startStream } from "@/lib/stream/actions";
import {
  isStreamIntent,
  simulationChoices,
  streamAfter,
  type CleanerStream,
  type StreamControlError,
  type StreamIntent,
} from "./stream-control-state";
import { readStream, rememberStream, useRememberedStream } from "./stream-memory";

type ControlAnswer = { note: "stopped" | null; error: StreamControlError | null } | null;

// The state as a word with an icon on its own tint, never colour alone (markdown/design.md, Cleaner app).
const chips: Record<Exclude<CleanerStream, "off">, { Icon: LucideIcon; tone: string }> = {
  active: { Icon: Signal, tone: "bg-success-surface text-success" },
  weak: { Icon: SignalLow, tone: "bg-warning-surface text-warning" },
  disconnected: { Icon: WifiOff, tone: "bg-danger-surface text-danger" },
};

const simulationIcons: Record<Exclude<CleanerStream, "off">, LucideIcon> = { weak: SignalLow, disconnected: WifiOff, active: RotateCw };

// Outlined pills (markdown/design.md, Buttons): a 1.5 px forest edge on white, 44 px tall.
const secondary =
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-full bg-card px-4 text-sm font-semibold text-ink inset-ring-[1.5px] inset-ring-outline transition-[background-color,transform] duration-150 ease-out-quart hover:bg-sunken active:scale-[0.98] active:bg-lime-wash motion-reduce:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:active:scale-100";

const spinner = "shrink-0 animate-spin motion-reduce:animate-none";

// The live stream of a job in progress, on its page (T22; D4, mock Cleaner-Live). "Mulai siaran" asks
// the server to start the stream (startStream checks the cleaner, the check-in and the customer's
// consent); from then on the page shows LIVE and the state in words: Aktif, Sinyal lemah or Terputus.
// It starts from the server's state (my_stream_status, `serverStream`), so a reloaded page, another tab
// or another phone shows the stream as it is. The phone's camera is not used while the stream source is
// the clip library (docs/adr/0002), so in place of the mock's camera preview a frame says the stream is
// running. Two "Simulasi" buttons and "Sambungkan ulang siaran" report a weak or lost signal to the
// server (setStreamStatus), so the customer's view can show those states; "Hentikan siaran" ends the
// stream, and check-out ends it too.
export function StreamControl({ orderId, serverStream }: { orderId: string; serverStream: CleanerStream | null }) {
  const t = useTranslations("CleanerStream");
  const stream = useRememberedStream(orderId, serverStream);
  const [asked, setAsked] = useState<StreamIntent | null>(null);
  const focusNext = useRef<"live" | "off" | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const [answer, act, pending] = useActionState(async (_previous: ControlAnswer, form: FormData): Promise<ControlAnswer> => {
    const intent = form.get("intent");
    if (!isStreamIntent(intent)) return { note: null, error: "unavailable" };
    const result = intent === "start" ? await startStream(null, form) : await setStreamStatus(null, form);
    const before = readStream(orderId) ?? serverStream ?? "off";
    const outcome = streamAfter(before, intent, result);
    if (outcome.stream !== before) focusNext.current = outcome.stream === "off" ? "off" : "live";
    rememberStream(orderId, outcome.stream);
    return { note: outcome.note, error: outcome.error };
  }, null);

  // After starting or stopping, the button pressed is gone: the focus moves to what replaced it.
  useEffect(() => {
    if (focusNext.current === "live") statusRef.current?.focus();
    if (focusNext.current === "off") startRef.current?.focus();
    focusNext.current = null;
  }, [stream]);

  function run(intent: StreamIntent) {
    if (pending) return;
    setAsked(intent);
    const form = new FormData();
    form.set("orderId", orderId);
    form.set("intent", intent);
    if (intent !== "start") form.set("status", intent);
    startTransition(() => act(form));
  }

  const titleId = `stream-${orderId}-title`;
  const errorId = `stream-${orderId}-error`;
  const error = !pending ? answer?.error : null;
  const busy = (intent: StreamIntent) => pending && asked === intent;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
          <Video className="size-5 shrink-0 text-primary" aria-hidden="true" />
          {t("title")}
        </h2>
        {stream !== "off" ? <OnAirBadge label={t("live")} /> : null}
      </div>

      {stream === "off" ? (
        <>
          <p className="text-sm text-ink-muted">{t("intro")}</p>
          <div role="status" className="empty:hidden">
            {answer?.note === "stopped" && !pending ? (
              <p className="flex items-start gap-2 text-sm font-medium text-ink">
                <CircleStop className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{t("stopped")}</span>
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="flex min-h-44 flex-col items-center justify-center gap-2.5 rounded-md bg-frame px-6 py-6 text-center">
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-card text-primary">
              <Radio className="size-6" />
            </span>
            <p className="text-sm font-semibold text-ink">{t("runningTitle")}</p>
            <p className="max-w-prose text-sm text-ink-muted">{t("runningBody")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <StatusChip stream={stream} label={t("statusLabel")} word={t(`status.${stream}`)} chipRef={statusRef} />
            {stream === "active" ? <span className="text-sm text-ink-muted">{t("watching")}</span> : null}
          </div>
        </>
      )}

      <div id={errorId} role="alert" aria-atomic="true" className="empty:hidden">
        {error ? (
          <p className="flex items-start gap-2.5 rounded-sm bg-danger-surface px-3 py-2.5 text-sm font-medium text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{t(`errors.${error}`)}</span>
          </p>
        ) : null}
      </div>

      {stream === "off" ? (
        <button
          ref={startRef}
          type="button"
          onClick={() => run("start")}
          aria-disabled={pending || undefined}
          aria-describedby={error ? errorId : undefined}
          className={`inline-flex min-h-13 w-full items-center justify-center gap-2.5 rounded-full bg-lime px-6 text-base font-semibold text-on-lime transition-[filter,transform] duration-150 ease-out-quart ${
            pending ? "cursor-progress brightness-95" : "hover:brightness-95 active:scale-[0.98] active:brightness-90 motion-reduce:active:scale-100"
          }`}
        >
          {busy("start") ? (
            <LoaderCircle className={`size-5 ${spinner}`} aria-hidden="true" />
          ) : (
            <Video className="size-5 shrink-0" aria-hidden="true" />
          )}
          {busy("start") ? t("starting") : t("start")}
        </button>
      ) : (
        <>
          <div role="group" aria-labelledby={`${titleId}-simulate`} className="flex flex-col gap-2">
            <p id={`${titleId}-simulate`} className="text-sm font-medium text-ink-muted">
              {t("simulateTitle")}
            </p>
            <div className="flex flex-wrap gap-2">
              {simulationChoices(stream).map(({ status, current }) => {
                const Icon = busy(status) ? LoaderCircle : simulationIcons[status];
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      if (!current) run(status);
                    }}
                    aria-pressed={status === "active" ? undefined : current}
                    aria-disabled={pending || current || undefined}
                    className={`${secondary} ${current ? "bg-lime-wash aria-disabled:opacity-100" : ""}`}
                  >
                    <Icon className={`size-4 ${busy(status) ? spinner : "shrink-0"}`} aria-hidden="true" />
                    {t(`simulate.${status}`)}
                  </button>
                );
              })}
            </div>
          </div>
          {/* A quiet text button, apart from the full-width "Check-out" under it, so one is not pressed
              for the other in a hurry (2026-11-20, UX audit item 5). */}
          <button
            type="button"
            onClick={() => run("ended")}
            aria-disabled={pending || undefined}
            aria-describedby={error ? errorId : undefined}
            className="inline-flex min-h-touch w-fit items-center gap-1.5 self-center rounded-full px-3 text-sm font-medium text-ink-muted underline decoration-1 underline-offset-4 transition-colors duration-150 ease-out-quart hover:text-danger hover:decoration-2 active:bg-danger-surface aria-disabled:cursor-progress"
          >
            {busy("ended") ? (
              <LoaderCircle className={`size-4 ${spinner}`} aria-hidden="true" />
            ) : (
              <CircleStop className="size-4 shrink-0 text-danger" aria-hidden="true" />
            )}
            {busy("ended") ? t("saving") : t("stop")}
          </button>
        </>
      )}
    </section>
  );
}

/** "LIVE" with a breathing dot: the cleaner's own sign that the stream is on. The dot is still under reduced motion. */
function OnAirBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-live-surface px-2.5 py-1 text-xs font-bold tracking-wide text-live">
      <span aria-hidden="true" className="size-2 animate-breathe rounded-full bg-live-dot motion-reduce:animate-none" />
      {label}
    </span>
  );
}

function StatusChip({
  stream,
  label,
  word,
  chipRef,
}: {
  stream: Exclude<CleanerStream, "off">;
  label: string;
  word: string;
  chipRef: React.RefObject<HTMLParagraphElement | null>;
}) {
  const { Icon, tone } = chips[stream];
  return (
    <p
      ref={chipRef}
      tabIndex={-1}
      role="status"
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold outline-offset-2 ${tone}`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{label} </span>
      {word}
    </p>
  );
}
