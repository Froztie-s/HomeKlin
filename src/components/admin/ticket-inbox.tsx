import { MessageSquareText } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { TicketStatusPill, UrgentPill } from "@/components/support/ticket-pills";
import { Link } from "@/i18n/navigation";
import type { InboxTicket } from "@/lib/support/support";

type TicketInboxProps = {
  tickets: InboxTicket[];
  /** The ticket open beside the list, marked as current. */
  selectedId: string | null;
};

// Admin's ticket inbox (T21), in the order the inbox function gives: tickets waiting for HomeKlin
// first, urgent before normal, oldest first; then answered and closed ones. Each row shows who asked,
// how long ago, the question, its urgency and status in words, and how many messages the chat has;
// the whole row opens the chat beside the list (/admin/tickets?ticket=<id>).
export async function TicketInbox({ tickets, selectedId }: TicketInboxProps) {
  const [t, tChat, format] = await Promise.all([
    getTranslations("AdminTicketsPage"),
    getTranslations("SupportChat"),
    getFormatter(),
  ]);
  const now = new Date();

  return (
    <ul
      aria-label={t("listLabel")}
      className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface"
    >
      {tickets.map((ticket) => {
        const current = ticket.id === selectedId;
        return (
          <li key={ticket.id}>
            <Link
              href={`/admin/tickets?ticket=${ticket.id}`}
              aria-current={current ? "true" : undefined}
              className={`flex flex-col gap-2 border-l-4 px-4 py-3 transition-colors duration-150 ease-out-quart ${
                current
                  ? "border-l-brand-600 bg-brand-50"
                  : "border-l-transparent hover:bg-surface-sunken active:bg-brand-50"
              }`}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-semibold text-ink">
                  {ticket.customerName || t("customerFallback")}
                </span>
                <time dateTime={ticket.createdAt} className="shrink-0 text-xs text-ink-muted tabular-nums">
                  {format.relativeTime(new Date(ticket.createdAt), now)}
                </time>
              </span>
              <span className="line-clamp-2 text-sm break-words text-ink">{ticket.question}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                {ticket.urgency === "urgent" ? <UrgentPill label={tChat("urgent")} /> : null}
                <TicketStatusPill status={ticket.status} label={tChat(`status.${ticket.status}`)} />
                <span className="inline-flex items-center gap-1 text-xs text-ink-muted tabular-nums">
                  <MessageSquareText className="size-3.5 shrink-0" aria-hidden="true" />
                  {t("messageCount", { count: ticket.messageCount })}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
