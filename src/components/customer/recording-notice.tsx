import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// A calm, plain box in the recording section (T15) in place of the player: the recording was deleted
// after 7 days, the job has none, or it could not be loaded. Used on the server and by the player.
export function RecordingNotice({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-surface-sunken px-4 py-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <p className="font-semibold text-ink">{title}</p>
        {children ? <div className="text-ink-muted">{children}</div> : null}
      </div>
    </div>
  );
}
