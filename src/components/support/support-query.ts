// The address of the help screens (T19-T21): /support?q=<search words> searches the FAQ, and
// /support?ticket=<id> (or /admin/tickets?ticket=<id>) opens one chat. Whatever the address says is
// only a suggestion: the FAQ reader trims and limits the words again, and the ticket reader returns
// nothing for an id the signed-in user may not read (src/lib/support/support.ts, row-level security).

type SearchParams = Record<string, string | string[] | undefined>;

export type SupportQuery = {
  /** The search words, trimmed; empty for none. At most 100 characters, like the reader. */
  query: string;
  /** The ticket the address names, as written (a wrong one is shown as not found), or null. */
  ticketId: string | null;
};

function first(value: string | string[] | undefined): string {
  const text = Array.isArray(value) ? value[0] : value;
  return typeof text === "string" ? text.trim() : "";
}

export function parseSupportQuery(params: SearchParams): SupportQuery {
  const ticket = first(params.ticket).slice(0, 64);
  return { query: first(params.q).slice(0, 100), ticketId: ticket === "" ? null : ticket };
}
