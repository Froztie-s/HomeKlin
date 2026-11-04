import { CircleCheck, Hourglass, Lock, TriangleAlert, type LucideIcon } from "lucide-react";
import type { TicketStatus } from "@/lib/support/support";

// A ticket's status and its urgency (T20, T21), always as a word with an icon, never by colour alone.
// No hooks, so the server lists and the client chat use the same pills; the words come from the
// caller (SupportChat.status.* and SupportChat.urgent).

const pill = "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold";

const statusStyles: Record<TicketStatus, { Icon: LucideIcon; tone: string }> = {
  open: { Icon: Hourglass, tone: "bg-warning-surface text-warning" },
  answered: { Icon: CircleCheck, tone: "bg-success-surface text-success" },
  closed: { Icon: Lock, tone: "bg-surface-sunken text-ink-muted" },
};

export function TicketStatusPill({ status, label }: { status: TicketStatus; label: string }) {
  const { Icon, tone } = statusStyles[status];
  return (
    <span className={`${pill} ${tone}`}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Shown for an urgent ticket only; a normal one needs no mark. */
export function UrgentPill({ label }: { label: string }) {
  return (
    <span className={`${pill} bg-danger-surface text-danger`}>
      <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
