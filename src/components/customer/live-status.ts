import type { CustomerOrder } from "@/lib/booking/orders";

// The customer's live view (T23), as pure rules: whether an order's job is in progress (the only time
// it can be watched), and how the viewer reads GET /api/streams/<order id> (src/app/api/streams):
// the status it polls with ?status=1, and the fresh link it asks for when the video fails.

export type LiveStatus = "active" | "weak" | "disconnected";

export type StatusAnswer =
  | { kind: "live"; status: LiveStatus }
  /** The stream ended, or this viewer may no longer watch it: the API answers both with 404. */
  | { kind: "gone" }
  | { kind: "signedOut" }
  /** A server problem or an answer that cannot be read: keep showing what is there. */
  | { kind: "unknown" };

/** About every 10 seconds, as agreed for the demo. */
export const statusPollMs = 10_000;

const liveStatuses: readonly string[] = ["active", "weak", "disconnected"];

function field(body: unknown, key: string): unknown {
  return body && typeof body === "object" && key in body ? (body as Record<string, unknown>)[key] : undefined;
}

export function readStatusAnswer(httpStatus: number, body: unknown): StatusAnswer {
  if (httpStatus === 401) return { kind: "signedOut" };
  if (httpStatus === 404) return { kind: "gone" };
  if (httpStatus !== 200) return { kind: "unknown" };
  const status = field(body, "status");
  if (status === "ended") return { kind: "gone" };
  if (typeof status === "string" && liveStatuses.includes(status)) return { kind: "live", status: status as LiveStatus };
  return { kind: "unknown" };
}

/** The video link in the API's answer, when the stream source sent one (http or https only). */
export function readVideoLink(body: unknown): string | null {
  const view = field(body, "view");
  if (field(view, "kind") !== "video") return null;
  const url = field(view, "url");
  if (typeof url !== "string") return null;
  try {
    const protocol = new URL(url).protocol;
    return protocol === "https:" || protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/** A paid job the cleaner has checked in to and not yet finished: the only time it can be watched. */
export function liveInProgress(order: Pick<CustomerOrder, "status" | "checkedInAt" | "completedAt">): boolean {
  return order.status === "paid" && order.checkedInAt !== null && order.completedAt === null;
}
