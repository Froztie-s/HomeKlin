import { parseOrderQuery, serviceStepHref } from "./order-query";

// The booking flow's focused layout (2026-11-17): while the customer is in one of the three steps,
// the app's navigation steps aside for one minimal header with "Kembali" (src/components/shell/
// booking-header.tsx). These rules say which step an address is, remember how the customer came into
// the flow (src/components/shell/flow-entry-tracker.tsx) and where "Kembali" goes from each step.
// Addresses are written without the language prefix (next-intl's usePathname), with their query.

export type FlowStep = 1 | 2 | 3;

const stepPaths: Record<string, FlowStep> = {
  "/services": 1,
  "/pesan": 2,
  "/orders/pay": 3,
};

/** The step an address is (1 service and time, 2 details, 3 payment), or null outside the flow. */
export function bookingStepOf(href: string): FlowStep | null {
  const path = href.split(/[?#]/)[0];
  const trimmed = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return stepPaths[trimmed] ?? null;
}

/**
 * How the customer came into the flow: the page before the first step they opened (null when the flow
 * was the first page of this visit), and how many times they moved inside the flow since.
 */
export type FlowMemory = { exit: string | null; moves: number };

export const emptyFlowMemory: FlowMemory = { exit: null, moves: 0 };

/** The customer home: step 1's way out when the flow was opened from outside the site. */
export const flowFallback = "/home";

/** The memory after a move from `from` (null on the first page of the visit) to `to`. */
export function nextFlowMemory(memory: FlowMemory, from: string | null, to: string): FlowMemory {
  if (bookingStepOf(to) === null) return emptyFlowMemory;
  if (from === null) return emptyFlowMemory;
  if (bookingStepOf(from) === null) return { exit: from, moves: 0 };
  return { exit: memory.exit, moves: memory.moves + 1 };
}

export type BackAction = { kind: "history" } | { kind: "push"; href: string };

/**
 * Where "Kembali" goes. Step 2: step 1 with the choice in the address (the typed fields are kept in
 * the tab, ./order-draft.ts). Step 3: the customer home, where the placed order waits with its payment
 * (since 2026-11-20 /orders is the history; the orders still to come are on /home), because the order
 * is placed by then and step 2 would book it again. Step 1: one step back in the browser when the customer came straight
 * from another page of the site, that page again after moving inside the flow (going back in the
 * browser would only return to a step), and the customer home when the flow was opened from outside.
 */
export function bookingBack(step: FlowStep, search: string, memory: FlowMemory): BackAction {
  if (step === 3) return { kind: "push", href: "/home" };
  if (step === 2) {
    const params = Object.fromEntries(new URLSearchParams(search));
    return { kind: "push", href: serviceStepHref(parseOrderQuery(params)) };
  }
  if (memory.exit === null) return { kind: "push", href: flowFallback };
  return memory.moves === 0 ? { kind: "history" } : { kind: "push", href: memory.exit };
}
