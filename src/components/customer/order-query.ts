import { parseBookingQuery, type BookingQuery } from "./booking-query";

// The address of the order page (T9b): /pesan?layanan=<service id>&area=<area id>&starts=<ISO start of
// the window>, so a reload or a shared link opens the same order. The landing page's service cards
// link here with the service only, "Pesan" on /services with the area's earliest free window too.
// The old booking address (/book?service=&area=&starts=, T9) is sent here with the same choice.
// Whatever the address says is only a suggestion: the page checks it against the catalog and the free
// windows, and the order actions check every field again (src/lib/validation/booking.ts).

type SearchParams = Record<string, string | string[] | undefined>;

export type OrderQuery = BookingQuery;

/** The field names in the address, in the order they are written. */
const fields = [
  ["serviceId", "layanan"],
  ["areaId", "area"],
  ["startsAt", "starts"],
] as const;

/** The order page's address for what is chosen so far ("/pesan?layanan=..."; Link adds /en). */
export function orderHref(query: OrderQuery): string {
  const params = new URLSearchParams();
  for (const [key, name] of fields) {
    const value = query[key];
    if (value) params.set(name, value);
  }
  const text = params.toString();
  return text ? `/pesan?${text}` : "/pesan";
}

/** The service, area and window in the order page's address; anything unreadable is left out. */
export function parseOrderQuery(params: SearchParams): OrderQuery {
  // The same rules as the booking address, read from the order page's field names.
  return parseBookingQuery({ service: params.layanan, area: params.area, starts: params.starts });
}

/** The order page's address for an old booking address's query (/book?service=&area=&starts=). */
export function orderHrefFromBook(params: SearchParams): string {
  return orderHref(parseBookingQuery(params));
}

/** The page's query string with some choices changed (null removes one), the rest kept as it is. */
export function orderSearch(search: string, changes: { [Key in keyof OrderQuery]?: string | null }): string {
  const params = new URLSearchParams(search);
  for (const [key, name] of fields) {
    const value = changes[key];
    if (value === null) params.delete(name);
    else if (value !== undefined) params.set(name, value);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}
