"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { authorize } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Escalating to a chat ticket (T20) and answering it (T21). Public POST endpoints, so each checks the
// role and parses its input; the database functions check the ticket's owner
// (supabase/migrations/20261104120000_support.sql). Refusals come back as message keys.

export type SupportFailureKey = "notAllowed" | "questionInvalid" | "messageInvalid" | "notFound" | "closed" | "unavailable";
export type SupportFormState = { ok?: true; formError?: SupportFailureKey } | null;

const refusals: Record<string, SupportFailureKey> = {
  not_customer: "notAllowed",
  not_admin: "notAllowed",
  question_invalid: "questionInvalid",
  message_invalid: "messageInvalid",
  order_not_found: "notFound",
  ticket_not_found: "notFound",
  ticket_closed: "closed",
};

const failure = (error: { message: string }): SupportFormState => ({ formError: refusals[error.message] ?? "unavailable" });

const value = (formData: FormData, name: string) => {
  const entry = formData.get(name);
  return entry === null || entry === "" ? undefined : entry;
};

const ticketInput = z.object({
  question: z.string().trim().min(5).max(1000),
  urgency: z.enum(["normal", "urgent"]).catch("normal"),
  orderId: z.uuid().optional(),
  locale: z.enum(routing.locales).catch(routing.defaultLocale),
});

const messageInput = z.object({ ticketId: z.uuid(), body: z.string().trim().min(1).max(2000) });

/** A customer turns their question into a ticket and lands on its chat. */
export async function openTicket(_previous: SupportFormState, formData: FormData): Promise<SupportFormState> {
  if (!(await authorize(["customer"]))) return { formError: "notAllowed" };
  const parsed = ticketInput.safeParse({
    question: value(formData, "question") ?? "",
    urgency: value(formData, "urgency"),
    orderId: value(formData, "orderId"),
    locale: value(formData, "locale"),
  });
  if (!parsed.success) return { formError: "questionInvalid" };

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { data, error } = await supabase.rpc("open_ticket", {
    p_question: parsed.data.question,
    p_urgency: parsed.data.urgency,
    p_order: parsed.data.orderId ?? null,
  });
  if (error) return failure(error);
  const prefix = parsed.data.locale === routing.defaultLocale ? "" : `/${parsed.data.locale}`;
  return redirect(`${prefix}/support?ticket=${String(data)}`);
}

/** A message on a ticket, by its customer or by an admin. */
export async function postTicketMessage(_previous: SupportFormState, formData: FormData): Promise<SupportFormState> {
  if (!(await authorize(["customer", "admin"]))) return { formError: "notAllowed" };
  const parsed = messageInput.safeParse({ ticketId: value(formData, "ticketId"), body: value(formData, "body") ?? "" });
  if (!parsed.success) return { formError: parsed.error.issues.some((issue) => issue.path[0] === "body") ? "messageInvalid" : "notFound" };

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.rpc("post_ticket_message", { p_ticket: parsed.data.ticketId, p_body: parsed.data.body });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

/** An admin closes a ticket. */
export async function closeTicket(_previous: SupportFormState, formData: FormData): Promise<SupportFormState> {
  if (!(await authorize(["admin"]))) return { formError: "notAllowed" };
  const parsed = z.object({ ticketId: z.uuid() }).safeParse({ ticketId: value(formData, "ticketId") });
  if (!parsed.success) return { formError: "notFound" };

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { error } = await supabase.rpc("close_ticket", { p_ticket: parsed.data.ticketId });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}
