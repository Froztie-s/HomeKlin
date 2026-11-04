import { ChevronRight, CircleAlert } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { jakartaDayOf } from "@/components/customer/booking-query";
import { getSlotLabels } from "@/components/customer/slot-labels";
import { Link } from "@/i18n/navigation";
import type { InboxTicket } from "@/lib/support/support";

// The latest open tickets on the admin dashboard (T24): the customer's question, who asked, how many
// messages, when the last one came, and "Mendesak" for an urgent one (a word with an icon, never colour
// alone). Each row opens the ticket in the inbox (/admin/tickets?ticket=<id>), where admin replies.
export async function OpenTickets({ tickets, now }: { tickets: readonly InboxTicket[]; now: Date }) {
  const locale = await getLocale();
  const [t, labels] = await Promise.all([getTranslations("AdminDashboardPage"), getSlotLabels(locale)]);

  function lastActivity(iso: string) {
    const day = jakartaDayOf(iso, now);
    return day.relative === "today"
      ? t("lastToday", { time: labels.time(iso) })
      : t("lastDay", { day: labels.day({ date: day.date, relative: null }), time: labels.time(iso) });
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Link
            href={`/admin/tickets?ticket=${ticket.id}`}
            className="group flex items-center gap-4 px-4 py-3.5 transition-colors duration-150 ease-out-quart hover:bg-canvas active:bg-brand-50"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                {ticket.urgency === "urgent" ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-surface px-2.5 py-0.5 text-xs font-semibold text-warning">
                    <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                    {t("urgent")}
                  </span>
                ) : null}
                <span className="line-clamp-2 min-w-0 text-sm font-semibold text-ink">{ticket.question}</span>
              </span>
              <span className="flex flex-wrap gap-x-2 text-xs text-ink-muted">
                <span>{ticket.customerName ?? t("customerFallback")}</span>
                <span aria-hidden="true">·</span>
                <span>{t("messageCount", { count: ticket.messageCount })}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{lastActivity(ticket.lastMessageAt)}</span>
              </span>
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-ink-faint transition-transform duration-150 ease-out-quart group-hover:translate-x-0.5 group-hover:text-brand-700"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
