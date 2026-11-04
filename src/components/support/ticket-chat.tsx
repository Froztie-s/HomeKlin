"use client";

import { CircleAlert, Headset, LoaderCircle, Lock, SendHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { postTicketMessage, type SupportFormState } from "@/lib/support/actions";
import type { TicketMessage, TicketStatus, TicketUrgency } from "@/lib/support/support";
import { LiveStatus } from "./live-status";
import { mergeMessages, messageFromChange, statusFromChange } from "./ticket-messages";
import { TicketStatusPill, UrgentPill } from "./ticket-pills";
import { useRealtime, type Change, type ChangeFilter } from "./use-realtime";

type TicketChatProps = {
  /** Whose screen this is: the customer's chat on /support, or the admin's on /admin/tickets. */
  viewer: "customer" | "admin";
  ticket: { id: string; status: TicketStatus; urgency: TicketUrgency; createdAt: string; orderId: string | null };
  /** The messages the server read, oldest first. */
  messages: TicketMessage[];
  /** Admin's view: the customer's name, shown on their messages. */
  customerName?: string;
  /** Admin's view: the close control, under the header. */
  actions?: ReactNode;
};

const jakarta = "Asia/Jakarta";
const timeFormats = new Map<string, Intl.DateTimeFormat>();

/** "4 Nov, 10.12" in Jakarta time, with the Indonesian conventions in both languages. */
function messageTime(iso: string, locale: string): string {
  let format = timeFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale === "en" ? "en-ID" : "id-ID", {
      timeZone: jakarta,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    timeFormats.set(locale, format);
  }
  return format.format(new Date(iso));
}

// One help chat (T20 for the customer, T21 for the admin). The server renders the messages it read;
// Supabase Realtime adds new ones and the ticket's status while the page is open, without a reload
// (row-level security sends each user only rows they may read). Each (re)join reads the server's list
// again, which covers anything sent while the connection was down; the two lists merge by id.
// Sending goes through postTicketMessage, which checks the user and the ticket on the server. The
// draft stays in the box if sending fails, and an empty message is stopped before it is sent.
export function TicketChat({ viewer, ticket, messages, customerName, actions }: TicketChatProps) {
  const t = useTranslations("SupportChat");
  const locale = useLocale();
  const router = useRouter();

  const [liveMessages, setLiveMessages] = useState<TicketMessage[]>([]);
  // A status from Realtime counts until the server's own status changes (a refresh brought it).
  const [liveStatus, setLiveStatus] = useState<{ value: TicketStatus; over: TicketStatus } | null>(null);
  const status = liveStatus && liveStatus.over === ticket.status ? liveStatus.value : ticket.status;
  const shown = mergeMessages(messages, liveMessages);

  const changes: ChangeFilter[] = [
    { event: "INSERT", table: "ticket_messages", filter: `ticket_id=eq.${ticket.id}` },
    { event: "UPDATE", table: "support_tickets", filter: `id=eq.${ticket.id}` },
  ];
  const live = useRealtime(`ticket:${ticket.id}`, changes, {
    onChange: (change: Change) => {
      if (change.table === "ticket_messages") {
        const message = messageFromChange(change.new, ticket.id);
        if (message) setLiveMessages((current) => [...current, message]);
      } else {
        const next = statusFromChange(change.new, ticket.id);
        if (next) setLiveStatus({ value: next, over: ticket.status });
      }
    },
    onJoin: () => router.refresh(),
  });

  // A new message scrolls into view; the first render does not move the page.
  const lastMessage = useRef<HTMLLIElement>(null);
  const seenCount = useRef(shown.length);
  useEffect(() => {
    if (shown.length > seenCount.current) lastMessage.current?.scrollIntoView({ block: "nearest" });
    seenCount.current = shown.length;
  }, [shown.length]);

  const titleId = `chat-${ticket.id}`;
  const ownSide = (message: TicketMessage) => (viewer === "admin" ? message.fromAdmin : !message.fromAdmin);
  const author = (message: TicketMessage) =>
    message.fromAdmin ? t("team") : viewer === "admin" ? customerName || t("customerFallback") : t("you");

  return (
    <section aria-labelledby={titleId} className="flex flex-col rounded-xl border border-border bg-surface shadow-card">
      <header className="flex flex-col gap-3 border-b border-border p-4 md:p-5">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="font-display text-lg font-semibold text-ink">
            {viewer === "admin" ? t("titleAdmin") : t("titleCustomer")}
          </h2>
          <p className="text-sm text-ink-muted">
            {viewer === "admin" && customerName ? <span className="font-semibold text-ink">{customerName} · </span> : null}
            <time dateTime={ticket.createdAt} suppressHydrationWarning>
              {t("opened", { time: messageTime(ticket.createdAt, locale) })}
            </time>
            {ticket.orderId ? <span> · {t("order", { reference: `#${ticket.orderId.slice(0, 8)}` })}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TicketStatusPill status={status} label={t(`status.${status}`)} />
          {ticket.urgency === "urgent" ? <UrgentPill label={t("urgent")} /> : null}
        </div>
        {status === "closed" ? null : (
          <LiveStatus
            state={live}
            labels={{
              connected: t("live.connected"),
              connectedHint: t("live.connectedHint"),
              connecting: t("live.connecting"),
              offline: t("live.offline"),
              reload: t("live.reload"),
            }}
          />
        )}
        {actions && status !== "closed" ? actions : null}
      </header>

      <ol aria-label={t("messagesLabel")} aria-live="polite" aria-relevant="additions" className="flex flex-col gap-3 p-4 md:p-5">
        {shown.map((message, index) => {
          const own = ownSide(message);
          return (
            <li
              key={message.id}
              ref={index === shown.length - 1 ? lastMessage : undefined}
              className={`flex max-w-[min(36rem,88%)] flex-col gap-1 rounded-xl px-4 py-3 ${
                own ? "self-end bg-brand-50 text-ink" : "self-start border border-border bg-surface-sunken text-ink"
              }`}
            >
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                  {message.fromAdmin ? <Headset className="size-3.5 shrink-0 text-brand-700" aria-hidden="true" /> : null}
                  {author(message)}
                </span>
                <time dateTime={message.createdAt} suppressHydrationWarning>
                  {messageTime(message.createdAt, locale)}
                </time>
              </p>
              <p className="text-base break-words whitespace-pre-wrap">{message.body}</p>
            </li>
          );
        })}
      </ol>

      <footer className="border-t border-border p-4 md:p-5">
        {status === "closed" ? (
          <p className="flex items-start gap-2.5 rounded-md bg-surface-sunken px-4 py-3 text-sm text-ink-muted">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{viewer === "admin" ? t("closedAdmin") : t("closedCustomer")}</span>
          </p>
        ) : (
          <Composer ticketId={ticket.id} viewer={viewer} />
        )}
      </footer>
    </section>
  );
}

function Composer({ ticketId, viewer }: { ticketId: string; viewer: "customer" | "admin" }) {
  const t = useTranslations("SupportChat");
  const [state, formAction, pending] = useActionState<SupportFormState, FormData>(postTicketMessage, null);
  const [body, setBody] = useState("");
  const [empty, setEmpty] = useState(false);
  // Counts the sends, so the same refusal twice is announced twice.
  const [sends, setSends] = useState(0);
  const field = useRef<HTMLTextAreaElement>(null);

  // A message the server took empties the box; a refusal keeps the draft.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setBody("");
  }

  const id = `message-${ticketId}`;
  const error = empty ? t("composer.empty") : state?.formError && !pending ? t(`errors.${state.formError}`) : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (body.trim() === "") {
      setEmpty(true);
      setSends((count) => count + 1);
      field.current?.focus();
      return;
    }
    setEmpty(false);
    setSends((count) => count + 1);
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  // Ctrl+Enter or Cmd+Enter sends; Enter alone starts a new line.
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <label htmlFor={id} className="px-1 text-sm font-medium text-ink">
        {viewer === "admin" ? t("composer.labelAdmin") : t("composer.labelCustomer")}
      </label>
      <textarea
        ref={field}
        id={id}
        name="body"
        rows={3}
        maxLength={2000}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          if (empty) setEmpty(false);
        }}
        onKeyDown={onKeyDown}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="min-h-24 w-full resize-y rounded-xl border border-border-control bg-surface px-4 py-3 text-base text-ink caret-brand-700 transition-colors duration-150 ease-out-quart hover:border-brand-600 aria-invalid:border-danger aria-invalid:bg-danger-surface"
      />
      <div role="alert" aria-atomic="true">
        {error ? (
          <p key={sends} id={`${id}-error`} className="flex items-start gap-1.5 px-1 text-sm font-medium text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex min-h-touch items-center justify-center gap-2 self-end rounded-full px-5 text-sm font-semibold transition-[background-color,transform] duration-150 ease-out-quart ${
          pending
            ? "cursor-progress bg-brand-700 text-on-brand"
            : "bg-brand-600 text-on-brand hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800"
        }`}
      >
        {pending ? (
          <LoaderCircle className="size-4.5 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <SendHorizontal className="size-4.5 shrink-0" aria-hidden="true" />
        )}
        {pending ? t("composer.pending") : viewer === "admin" ? t("composer.sendAdmin") : t("composer.sendCustomer")}
      </button>
    </form>
  );
}
