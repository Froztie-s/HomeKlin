import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, visitorClient } from "./test-project";
import { createWorld, hours, type World } from "./world";

// Customer support (T19-T21, supabase/migrations/20261104120000_support.sql) against the real test
// project: anyone searches the FAQ in both languages; a customer escalates a question into a ticket;
// the customer and admins chat on it; a customer never sees another customer's tickets or messages,
// also not through Realtime; the admin inbox puts waiting, urgent, old tickets first.

let world: World;
const faqIds: string[] = [];
let publishedId = "";

beforeAll(async () => {
  world = await createWorld("t19");
  const { data, error } = await adminClient()
    .from("faq_entries")
    .insert([
      {
        question_id: `Bagaimana uji ${world.prefix} bekerja?`,
        question_en: `How does test ${world.prefix} work?`,
        answer_id: "Jawaban uji dalam bahasa Indonesia.",
        answer_en: "A test answer in English.",
        keywords: `zebrakata-${world.prefix}`,
        is_published: true,
      },
      {
        question_id: `Pertanyaan tersembunyi ${world.prefix}`,
        question_en: `Hidden question ${world.prefix}`,
        answer_id: "Tidak diterbitkan.",
        answer_en: "Not published.",
        keywords: "",
        is_published: false,
      },
    ])
    .select("id, is_published");
  if (error) throw new Error(`Could not add the test FAQ entries: ${error.message}`);
  faqIds.push(...(data ?? []).map((row) => row.id));
  publishedId = (data ?? []).find((row) => row.is_published)?.id ?? "";
}, 180_000);

afterAll(async () => {
  await adminClient().from("faq_entries").delete().in("id", faqIds);
  await world.cleanup();
}, 120_000);

const open = (question = "Petugas belum datang, bagaimana?", urgency = "normal", order: string | null = null) =>
  world.users.customer.client.rpc("open_ticket", { p_question: question, p_urgency: urgency, p_order: order });

describe("the FAQ", { timeout: 30_000 }, () => {
  it("finds a published entry by a word in either language or a keyword, for a visitor", async () => {
    for (const query of [`uji ${world.prefix}`, `test ${world.prefix}`, `zebrakata-${world.prefix}`, "jawaban uji dalam"]) {
      const { data, error } = await visitorClient().rpc("search_faq", { p_query: query });
      expect(error).toBeNull();
      expect((data ?? []).some((row: { id: string }) => row.id === publishedId), query).toBe(true);
    }
  });

  it("never shows an unpublished entry, and matches % and _ literally", async () => {
    const { data } = await visitorClient().rpc("search_faq", { p_query: `tersembunyi ${world.prefix}` });
    expect(data).toEqual([]);
    const wildcard = await visitorClient().rpc("search_faq", { p_query: "%" });
    expect(wildcard.data).toEqual([]);
  });

  it("lets only admins change it", async () => {
    const entry = { question_id: "Pertanyaan baru?", question_en: "A new question?", answer_id: "Jawaban.", answer_en: "Answer." };
    for (const client of [visitorClient(), world.users.customer.client, world.users.agencyA.client]) {
      expect((await client.from("faq_entries").insert(entry)).error).not.toBeNull();
    }
    const { data, error } = await world.users.admin.client.from("faq_entries").insert(entry).select("id").single();
    expect(error).toBeNull();
    faqIds.push(data?.id);
  });
});

describe("tickets", { timeout: 30_000 }, () => {
  it("opens a ticket with the question as its first message, which only that customer and admins read", async () => {
    const { data: ticketId, error } = await open();
    expect(error).toBeNull();

    const own = await world.users.customer.client.from("support_tickets").select("id, status").eq("id", ticketId);
    expect(own.data).toEqual([{ id: ticketId, status: "open" }]);
    const messages = await world.users.customer.client.from("ticket_messages").select("body, from_admin").eq("ticket_id", ticketId);
    expect(messages.data).toEqual([{ body: "Petugas belum datang, bagaimana?", from_admin: false }]);

    for (const client of [world.users.otherCustomer.client, world.users.agencyA.client, world.users.cleanerA.client]) {
      expect((await client.from("support_tickets").select("id").eq("id", ticketId)).data).toEqual([]);
      expect((await client.from("ticket_messages").select("id").eq("ticket_id", ticketId)).data).toEqual([]);
    }
    expect((await visitorClient().from("support_tickets").select("id")).error?.code).toBe("42501");
    expect((await world.users.admin.client.from("support_tickets").select("id").eq("id", ticketId)).data).toHaveLength(1);
  });

  it("lets the admin answer and the customer reply, moving the status each time", async () => {
    const { data: ticketId } = await open("Bisa ganti jadwal besok?");
    expect((await world.users.admin.client.rpc("post_ticket_message", { p_ticket: ticketId, p_body: "Bisa, kami bantu." })).error).toBeNull();
    const status = async () => (await adminClient().from("support_tickets").select("status").eq("id", ticketId).single()).data?.status;
    expect(await status()).toBe("answered");
    expect((await world.users.customer.client.rpc("post_ticket_message", { p_ticket: ticketId, p_body: "Terima kasih." })).error).toBeNull();
    expect(await status()).toBe("open");

    const { data } = await world.users.customer.client.from("ticket_messages").select("from_admin").eq("ticket_id", ticketId).order("created_at");
    expect(data?.map((row) => row.from_admin)).toEqual([false, true, false]);
  });

  it("refuses another customer's ticket, a closed ticket and an empty message", async () => {
    const { data: ticketId } = await open("Pertanyaan untuk ditutup.");
    expect((await world.users.otherCustomer.client.rpc("post_ticket_message", { p_ticket: ticketId, p_body: "Halo" })).error?.message).toBe("ticket_not_found");
    expect((await world.users.customer.client.rpc("post_ticket_message", { p_ticket: ticketId, p_body: "   " })).error?.message).toBe("message_invalid");
    expect((await world.users.customer.client.rpc("close_ticket", { p_ticket: ticketId })).error?.code).toBe("42501");
    expect((await world.users.admin.client.rpc("close_ticket", { p_ticket: ticketId })).error).toBeNull();
    expect((await world.users.customer.client.rpc("post_ticket_message", { p_ticket: ticketId, p_body: "Masih ada?" })).error?.message).toBe("ticket_closed");
  });

  it("is opened only by customers, about their own orders", async () => {
    const theirs = await world.job({ startsAt: new Date(Date.now() + hours(30)), customer: world.users.otherCustomer });
    expect((await open("Tentang pesanan orang lain.", "normal", theirs)).error?.message).toBe("order_not_found");
    const mine = await world.job({ startsAt: new Date(Date.now() + hours(31)) });
    expect((await open("Tentang pesanan saya.", "urgent", mine)).error).toBeNull();
    expect((await open("abc")).error?.message).toBe("question_invalid");
    for (const client of [world.users.admin.client, world.users.agencyA.client]) {
      expect((await client.rpc("open_ticket", { p_question: "Pertanyaan staf." })).error?.code).toBe("42501");
    }
  });

  it("puts urgent and old waiting tickets first in admin's inbox, for admins only", async () => {
    const { data: normal } = await open("Pertanyaan biasa yang lama.");
    const { data: urgent } = await open("Pertanyaan mendesak yang baru.", "urgent");
    const { data, error } = await world.users.admin.client.rpc("admin_ticket_inbox");
    expect(error).toBeNull();
    const order = (data ?? []).map((row: { ticket_id: string }) => row.ticket_id);
    expect(order.indexOf(urgent)).toBeLessThan(order.indexOf(normal));
    const row = (data ?? []).find((entry: { ticket_id: string }) => entry.ticket_id === urgent);
    expect(row).toMatchObject({ customer_name: "Uji Pelanggan", urgency: "urgent", status: "open", message_count: 1 });
    for (const client of [world.users.customer.client, world.users.agencyA.client]) {
      expect((await client.rpc("admin_ticket_inbox")).error?.code).toBe("42501");
    }
  });

  it("delivers a new message through Realtime to the ticket's customer and not to another customer", async () => {
    const { data: ticketId } = await open("Pertanyaan untuk Realtime.");
    const received: Record<string, string[]> = { owner: [], other: [] };
    const subscribe = (client: typeof world.users.customer.client, key: "owner" | "other") =>
      new Promise<ReturnType<typeof client.channel>>((resolve) => {
        const channel = client
          .channel(`t19-${key}-${randomUUID()}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages" }, (payload) => {
            received[key].push((payload.new as { body: string }).body);
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") resolve(channel);
          });
      });
    for (const user of [world.users.customer, world.users.otherCustomer]) {
      const { data: session } = await user.client.auth.getSession();
      await user.client.realtime.setAuth(session.session?.access_token ?? null);
    }
    const channels = [await subscribe(world.users.customer.client, "owner"), await subscribe(world.users.otherCustomer.client, "other")];
    // Realtime starts delivering a moment after it confirms the subscription.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await world.users.admin.client.rpc("post_ticket_message", { p_ticket: ticketId, p_body: "Jawaban waktu nyata." });
    const deadline = Date.now() + 15_000;
    while (!received.owner.includes("Jawaban waktu nyata.") && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));

    expect(received.owner).toContain("Jawaban waktu nyata.");
    expect(received.other).not.toContain("Jawaban waktu nyata.");
    for (const channel of channels) await channel.unsubscribe();
  });
});
