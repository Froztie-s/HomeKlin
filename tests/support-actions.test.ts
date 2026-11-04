import { beforeEach, describe, expect, it, vi } from "vitest";
import { faqQuery } from "@/lib/support/support";

// The support actions (T20, T21; src/lib/support/actions.ts) with a stand-in Supabase client. The
// ticket rules live in the database (tests/integration/support.test.ts); here: the role checks, the
// input parsing and the refusal keys.

const ticketId = "0b8f3c1e-1111-4222-8333-944455556666";
const { rpc, redirectMock } = vi.hoisted(() => ({ rpc: vi.fn(), redirectMock: vi.fn() }));
let user: { role: string } | null = null;

vi.mock("@/lib/auth/dal", () => ({ authorize: async (roles: string[]) => (user && roles.includes(user.role) ? user : null) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", async (original) => ({ ...(await original<object>()), redirect: redirectMock }));

const { openTicket, postTicketMessage, closeTicket } = await import("@/lib/support/actions");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, entry] of Object.entries(values)) data.set(key, entry);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  user = { role: "customer" };
  rpc.mockResolvedValue({ data: ticketId, error: null });
});

describe("openTicket", () => {
  it("opens the ticket and goes to its chat, in the customer's language", async () => {
    await openTicket(null, form({ question: "  Petugas belum datang  ", urgency: "urgent", locale: "en" }));
    expect(rpc).toHaveBeenCalledWith("open_ticket", { p_question: "Petugas belum datang", p_urgency: "urgent", p_order: null });
    expect(redirectMock).toHaveBeenCalledWith(`/en/support?ticket=${ticketId}`);
  });

  it("refuses a too short question, and anyone but a customer", async () => {
    expect(await openTicket(null, form({ question: "abc" }))).toEqual({ formError: "questionInvalid" });
    user = { role: "admin" };
    expect(await openTicket(null, form({ question: "Pertanyaan admin" }))).toEqual({ formError: "notAllowed" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("postTicketMessage and closeTicket", () => {
  it("sends a message for the customer or an admin", async () => {
    expect(await postTicketMessage(null, form({ ticketId, body: "Halo" }))).toEqual({ ok: true });
    user = { role: "admin" };
    expect(await postTicketMessage(null, form({ ticketId, body: "Kami bantu" }))).toEqual({ ok: true });
    user = { role: "agency" };
    expect(await postTicketMessage(null, form({ ticketId, body: "Halo" }))).toEqual({ formError: "notAllowed" });
  });

  it("turns refusals into keys", async () => {
    expect(await postTicketMessage(null, form({ ticketId, body: "" }))).toEqual({ formError: "messageInvalid" });
    rpc.mockResolvedValue({ data: null, error: { message: "ticket_closed" } });
    expect(await postTicketMessage(null, form({ ticketId, body: "Halo" }))).toEqual({ formError: "closed" });
    rpc.mockResolvedValue({ data: null, error: { message: "ticket_not_found" } });
    expect(await postTicketMessage(null, form({ ticketId, body: "Halo" }))).toEqual({ formError: "notFound" });
  });

  it("closes only for admins", async () => {
    expect(await closeTicket(null, form({ ticketId }))).toEqual({ formError: "notAllowed" });
    user = { role: "admin" };
    expect(await closeTicket(null, form({ ticketId }))).toEqual({ ok: true });
  });
});

describe("faqQuery", () => {
  it("trims and caps the search words", () => {
    expect(faqQuery.parse("  bayar  ")).toBe("bayar");
    expect(faqQuery.parse(undefined)).toBe("");
    expect(faqQuery.parse("x".repeat(101))).toBe("");
  });
});
