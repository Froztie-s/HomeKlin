import { ChevronRight, CircleAlert, MessagesSquare } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";
import type { Ticket } from "@/lib/support/support";
import { TicketStatusPill, UrgentPill } from "./ticket-pills";

// The signed-in customer's own tickets on /support (T20), latest activity first, each with its status
// in words. The whole row opens its chat (/support?ticket=<id>). Read with the customer's own session
// (listMyTickets), so row-level security returns their tickets and nobody else's.
export async function MyTickets({ tickets }: { tickets: Ticket[] | null }) {
  const [t, tChat, format] = await Promise.all([
    getTranslations("SupportPage"),
    getTranslations("SupportChat"),
    getFormatter(),
  ]);
  const now = new Date();

  return (
    <section aria-labelledby="pertanyaan-saya" className="flex flex-col gap-3">
      <h2 id="pertanyaan-saya" className="font-display text-lg font-semibold text-ink">
        {t("tickets.title")}
      </h2>
      {tickets === null ? (
        <EmptyState icon={CircleAlert} title={t("tickets.errorTitle")}>
          {t("tickets.errorBody")}
        </EmptyState>
      ) : tickets.length === 0 ? (
        <EmptyState icon={MessagesSquare} title={t("tickets.emptyTitle")}>
          {t("tickets.emptyBody")}
        </EmptyState>
      ) : (
        <ul aria-labelledby="pertanyaan-saya" className="flex flex-col gap-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/support?ticket=${ticket.id}`}
                className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors duration-150 ease-out-quart hover:border-border-control active:bg-surface-sunken"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="line-clamp-2 text-base font-semibold break-words text-ink">{ticket.question}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <TicketStatusPill status={ticket.status} label={tChat(`status.${ticket.status}`)} />
                    {ticket.urgency === "urgent" ? <UrgentPill label={tChat("urgent")} /> : null}
                  </span>
                  <time dateTime={ticket.lastMessageAt} className="text-sm text-ink-muted">
                    {t("tickets.updated", { time: format.relativeTime(new Date(ticket.lastMessageAt), now) })}
                  </time>
                </span>
                <ChevronRight
                  className="mt-0.5 size-5 shrink-0 text-ink-muted transition-colors duration-150 ease-out-quart group-hover:text-ink"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
