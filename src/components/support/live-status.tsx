import { LoaderCircle, WifiOff } from "lucide-react";
import type { LiveState } from "./use-realtime";

type LiveStatusProps = {
  state: LiveState;
  labels: {
    connected: string;
    /** A short line after "Tersambung", e.g. "Pesan baru muncul otomatis." */
    connectedHint?: string;
    connecting: string;
    offline: string;
    /** The reload link shown with `offline`. */
    reload: string;
  };
};

// Whether new messages or tickets arrive on their own (T20, T21): a calm breathing dot with words while
// connected, a spinner while connecting, and an honest note with a reload link when the connection is
// down. Never colour alone. The status region is always on the page, so a dropped connection is
// announced.
export function LiveStatus({ state, labels }: LiveStatusProps) {
  return (
    <div role="status" className="flex min-h-touch flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
      {state === "connected" ? (
        <>
          <span className="inline-flex items-center gap-2 rounded-full bg-live-surface px-3 py-1 text-xs font-semibold text-live">
            <span aria-hidden="true" className="size-2 animate-breathe rounded-full bg-live-dot" />
            {labels.connected}
          </span>
          {labels.connectedHint ? <span>{labels.connectedHint}</span> : null}
        </>
      ) : state === "connecting" ? (
        <span className="inline-flex items-center gap-2">
          <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          {labels.connecting}
        </span>
      ) : (
        <>
          <span className="inline-flex items-start gap-2 font-medium text-warning">
            <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{labels.offline}</span>
          </span>
          {/* A plain link on purpose: a full page load reads everything again. */}
          <a
            href=""
            className="inline-flex min-h-touch items-center rounded-full px-3 font-semibold text-brand-700 underline-offset-2 transition-colors duration-150 ease-out-quart hover:text-brand-800 hover:underline active:text-ink"
          >
            {labels.reload}
          </a>
        </>
      )}
    </div>
  );
}
