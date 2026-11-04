import { describe, expect, it } from "vitest";
import { parseSupportQuery } from "@/components/support/support-query";
import { mergeMessages, messageFromChange, statusFromChange } from "@/components/support/ticket-messages";

// The support screens (T19-T21). /support and /admin/tickets keep what is open in the address
// (?q=<search> and ?ticket=<id>), so a reload or a link opens the same thing; whatever it says is
// only a suggestion, checked again by the readers and the database. The chat merges the messages the
// server rendered with the ones Realtime delivers, by id, so a message never shows twice.

const ticketId = "3f9a6c1e-2b7d-4e8a-9c0f-1a2b3c4d5e6f";

describe("parseSupportQuery", () => {
  it("reads the search words, trimmed, and the ticket", () => {
    expect(parseSupportQuery({ q: "  rekaman  ", ticket: ` ${ticketId} ` })).toEqual({ query: "rekaman", ticketId });
  });

  it("takes the first value of a repeated parameter", () => {
    expect(parseSupportQuery({ q: ["bayar", "lain"], ticket: [ticketId, "x"] })).toEqual({ query: "bayar", ticketId });
  });

  it("has an empty search and no ticket when the address names none", () => {
    expect(parseSupportQuery({})).toEqual({ query: "", ticketId: null });
    expect(parseSupportQuery({ q: "   ", ticket: "" })).toEqual({ query: "", ticketId: null });
  });

  it("keeps a search of at most 100 characters, like the reader", () => {
    expect(parseSupportQuery({ q: "a".repeat(140) }).query).toBe("a".repeat(100));
  });

  it("keeps any named ticket, so a wrong one is shown as not found rather than ignored", () => {
    expect(parseSupportQuery({ ticket: "not-a-ticket" }).ticketId).toBe("not-a-ticket");
    expect(parseSupportQuery({ ticket: "x".repeat(80) }).ticketId).toBe("x".repeat(64));
  });
});

const message = (id: string, createdAt: string, body = id) => ({ id, ticketId, fromAdmin: false, body, createdAt });

describe("mergeMessages", () => {
  it("adds the live messages to the server's, oldest first, each once", () => {
    const server = [message("a", "2026-11-04T03:00:00.000Z"), message("b", "2026-11-04T03:05:00.000Z")];
    const live = [message("c", "2026-11-04T03:06:00.000Z"), message("b", "2026-11-04T03:05:00.000Z", "stale copy")];
    expect(mergeMessages(server, live).map(({ id, body }) => [id, body])).toEqual([
      ["a", "a"],
      ["b", "b"],
      ["c", "c"],
    ]);
  });

  it("orders by time even when Realtime delivers out of order", () => {
    const live = [message("late", "2026-11-04T03:09:00.000Z"), message("early", "2026-11-04T03:01:00.000Z")];
    expect(mergeMessages([], live).map(({ id }) => id)).toEqual(["early", "late"]);
  });
});

describe("messageFromChange", () => {
  const row = { id: "m1", ticket_id: ticketId, from_admin: true, body: "Halo", created_at: "2026-11-04 03:00:00+00", author_id: "x" };

  it("reads a new message row into the chat's shape", () => {
    expect(messageFromChange(row, ticketId)).toEqual({
      id: "m1",
      ticketId,
      fromAdmin: true,
      body: "Halo",
      createdAt: "2026-11-04T03:00:00.000Z",
    });
  });

  it("ignores a row of another ticket or a row that is not a message", () => {
    expect(messageFromChange({ ...row, ticket_id: "other" }, ticketId)).toBeNull();
    expect(messageFromChange({ ...row, body: 3 }, ticketId)).toBeNull();
    expect(messageFromChange({ ...row, created_at: "not a time" }, ticketId)).toBeNull();
    expect(messageFromChange(null, ticketId)).toBeNull();
  });
});

describe("statusFromChange", () => {
  it("reads a ticket's new status, and nothing from another ticket or an unknown status", () => {
    expect(statusFromChange({ id: ticketId, status: "closed" }, ticketId)).toBe("closed");
    expect(statusFromChange({ id: "other", status: "closed" }, ticketId)).toBeNull();
    expect(statusFromChange({ id: ticketId, status: "lost" }, ticketId)).toBeNull();
    expect(statusFromChange(undefined, ticketId)).toBeNull();
  });
});
