import type { Metadata } from "next";
import { ArrowLeft, MessageCircleOff, MessagesSquare, MousePointerClick } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CloseTicket } from "@/components/admin/close-ticket";
import { InboxLive } from "@/components/admin/inbox-live";
import { Notice } from "@/components/admin/notice";
import { TicketInbox } from "@/components/admin/ticket-inbox";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { parseSupportQuery } from "@/components/support/support-query";
import { TicketChat } from "@/components/support/ticket-chat";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClientMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTicket, listInbox, SupportError, type InboxTicket } from "@/lib/support/support";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminTicketsPage");
  return { title: t("title") };
}

type SearchParams = PageProps<"/[locale]/admin/tickets">["searchParams"];

// Admin's ticket inbox (T21), admins only (T5). The title is prerendered; the rest renders inside the
// page's own role check (a layout's check would not protect it) and is read with the admin's own
// session: the inbox through the admin-only inbox function, the chat through row-level security.
// On a desk the list and the open chat (/admin/tickets?ticket=<id>) sit side by side; below 1024 px
// one shows at a time, with a way back to the list. New tickets and messages arrive through Realtime.
export default function AdminTicketsPage({ searchParams }: PageProps<"/[locale]/admin/tickets">) {
  const t = useTranslations("AdminTicketsPage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["admin"]}>
          <AdminTicketsContent searchParams={searchParams} />
        </RoleGate>
      </Suspense>
    </>
  );
}

async function AdminTicketsContent({ searchParams }: { searchParams: SearchParams }) {
  const [t, params, supabase] = await Promise.all([
    getTranslations("AdminTicketsPage"),
    searchParams,
    createSupabaseServerClient({ writeCookies: false }),
  ]);
  const { ticketId } = parseSupportQuery(params);

  let inbox: InboxTicket[];
  let selected: Awaited<ReturnType<typeof getTicket>> = null;
  try {
    [inbox, selected] = await Promise.all([listInbox(supabase), ticketId ? getTicket(supabase, ticketId) : null]);
  } catch (error) {
    // Only a failed read becomes a message; anything else (such as Next.js' own signals) goes on.
    if (!(error instanceof SupportError)) throw error;
    console.error(error);
    return (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }

  const waiting = inbox.filter((ticket) => ticket.status === "open").length;
  const live = (
    <InboxLive
      labels={{
        connected: t("live.connected"),
        connecting: t("live.connecting"),
        offline: t("live.offline"),
        reload: t("live.reload"),
      }}
    />
  );

  if (inbox.length === 0 && !ticketId) {
    return (
      <>
        {live}
        <EmptyState icon={MessagesSquare} title={t("emptyTitle")}>
          {t("emptyBody")}
        </EmptyState>
      </>
    );
  }

  const customerName = selected ? inbox.find((ticket) => ticket.id === selected.ticket.id)?.customerName : undefined;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <p className="text-sm font-medium text-ink">{t("summary", { waiting })}</p>
        {live}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
        <div className={ticketId ? "hidden lg:block" : ""}>
          <TicketInbox tickets={inbox} selectedId={selected?.ticket.id ?? null} />
        </div>
        <div className={ticketId ? "flex flex-col gap-2" : "hidden lg:block"}>
          {ticketId ? (
            <Link
              href="/admin/tickets"
              className="inline-flex min-h-touch w-fit items-center gap-2 rounded-full pr-3 text-sm font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:text-brand-800 hover:underline active:text-ink lg:hidden"
            >
              <ArrowLeft className="size-4.5 shrink-0" aria-hidden="true" />
              {t("back")}
            </Link>
          ) : null}
          {!ticketId ? (
            <EmptyState icon={MousePointerClick} title={t("pickTitle")}>
              {t("pickBody")}
            </EmptyState>
          ) : !selected ? (
            <EmptyState icon={MessageCircleOff} title={t("notFoundTitle")}>
              {t("notFoundBody")}
            </EmptyState>
          ) : (
            <ClientMessages namespaces={["SupportChat"]}>
              <TicketChat
                key={selected.ticket.id}
                viewer="admin"
                ticket={{
                  id: selected.ticket.id,
                  status: selected.ticket.status,
                  urgency: selected.ticket.urgency,
                  createdAt: selected.ticket.createdAt,
                  orderId: selected.ticket.orderId,
                }}
                messages={selected.messages}
                customerName={customerName || t("customerFallback")}
                actions={
                  <CloseTicket
                    key={selected.ticket.id}
                    ticketId={selected.ticket.id}
                    labels={{
                      button: t("close.button"),
                      question: t("close.question"),
                      confirm: t("close.confirm"),
                      cancel: t("close.cancel"),
                      pending: t("close.pending"),
                      error: t("close.error"),
                    }}
                  />
                }
              />
            </ClientMessages>
          )}
        </div>
      </div>
    </>
  );
}
