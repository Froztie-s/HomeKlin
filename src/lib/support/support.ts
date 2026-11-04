import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// Customer support reads (T19-T21), through supabase/migrations/20261104120000_support.sql. The FAQ is
// public; tickets and messages are read with the signed-in user's own session, so row-level security
// returns a customer's own tickets and every ticket to an admin. The pages subscribe to the same
// tables with Supabase Realtime for new messages (src/lib/supabase/browser.ts).

export class SupportError extends Error {
  constructor(cause: { message: string }) {
    super(`Could not read support data: ${cause.message}`);
    this.name = "SupportError";
  }
}

export type FaqEntry = {
  id: string;
  question: { id: string; en: string };
  answer: { id: string; en: string };
};

type FaqRow = { id: string; question_id: string; question_en: string; answer_id: string; answer_en: string };

/** The search box's text: trimmed, at most 100 characters, empty for none. */
export const faqQuery = z.string().trim().max(100).catch("");

/** Published FAQ entries matching the words, or all of them for an empty search. */
export async function searchFaq(client: SupabaseClient, query: string): Promise<FaqEntry[]> {
  const { data, error } = await client.rpc("search_faq", { p_query: faqQuery.parse(query) });
  if (error) throw new SupportError(error);
  return (data as FaqRow[]).map((row) => ({
    id: row.id,
    question: { id: row.question_id, en: row.question_en },
    answer: { id: row.answer_id, en: row.answer_en },
  }));
}

export type TicketStatus = "open" | "answered" | "closed";
export type TicketUrgency = "normal" | "urgent";

export type Ticket = {
  id: string;
  orderId: string | null;
  question: string;
  urgency: TicketUrgency;
  status: TicketStatus;
  createdAt: string;
  lastMessageAt: string;
};

export type TicketMessage = { id: string; ticketId: string; fromAdmin: boolean; body: string; createdAt: string };

type TicketRow = {
  id: string;
  order_id: string | null;
  question: string;
  urgency: TicketUrgency;
  status: TicketStatus;
  created_at: string;
  last_message_at: string;
};

export function ticketFromRow(row: TicketRow): Ticket {
  return {
    id: row.id,
    orderId: row.order_id,
    question: row.question,
    urgency: row.urgency,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    lastMessageAt: new Date(row.last_message_at).toISOString(),
  };
}

export function messageFromRow(row: { id: string; ticket_id: string; from_admin: boolean; body: string; created_at: string }): TicketMessage {
  return { id: row.id, ticketId: row.ticket_id, fromAdmin: row.from_admin, body: row.body, createdAt: new Date(row.created_at).toISOString() };
}

const ticketColumns = "id, order_id, question, urgency, status, created_at, last_message_at";

/** The signed-in customer's tickets, latest activity first (row-level security keeps them their own). */
export async function listMyTickets(client: SupabaseClient): Promise<Ticket[]> {
  const { data, error } = await client.from("support_tickets").select(ticketColumns).order("last_message_at", { ascending: false });
  if (error) throw new SupportError(error);
  return (data as TicketRow[]).map(ticketFromRow);
}

/** One ticket with its messages, oldest first; null when this user may not read it. */
export async function getTicket(client: SupabaseClient, ticketId: string): Promise<{ ticket: Ticket; messages: TicketMessage[] } | null> {
  if (!z.uuid().safeParse(ticketId).success) return null;
  const [ticket, messages] = await Promise.all([
    client.from("support_tickets").select(ticketColumns).eq("id", ticketId).maybeSingle(),
    client.from("ticket_messages").select("id, ticket_id, from_admin, body, created_at").eq("ticket_id", ticketId).order("created_at"),
  ]);
  if (ticket.error) throw new SupportError(ticket.error);
  if (messages.error) throw new SupportError(messages.error);
  if (!ticket.data) return null;
  return { ticket: ticketFromRow(ticket.data as TicketRow), messages: (messages.data ?? []).map(messageFromRow) };
}

export type InboxTicket = Ticket & { customerName: string | null; messageCount: number };

/** Admin's inbox: waiting tickets first, urgent before normal, oldest first. */
export async function listInbox(client: SupabaseClient): Promise<InboxTicket[]> {
  const { data, error } = await client.rpc("admin_ticket_inbox");
  if (error) throw new SupportError(error);
  type Row = Omit<TicketRow, "id"> & { ticket_id: string; customer_name: string | null; message_count: number };
  return (data as Row[]).map((row) => ({
    ...ticketFromRow({ ...row, id: row.ticket_id }),
    customerName: row.customer_name,
    messageCount: Number(row.message_count),
  }));
}
