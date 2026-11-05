import type { StreamActionState, StreamFailureKey } from "@/lib/stream/actions";

// The cleaner's stream controls on a job in progress (T22), as pure rules: what the card shows after
// each answer from the server (src/lib/stream/actions.ts), and which simulation buttons it offers.
// "off" is a job with no running stream: never started, stopped, or ended by the server.

export type CleanerStream = "off" | "active" | "weak" | "disconnected";
/** What the cleaner asked for: start the stream, report a state (simulated), or stop it. */
export type StreamIntent = "start" | "active" | "weak" | "disconnected" | "ended";
/** The server's refusals, plus a stream the server no longer has (stopped elsewhere, or by check-out). */
export type StreamControlError = StreamFailureKey | "streamGone";

export type StreamOutcome = { stream: CleanerStream; note: "stopped" | null; error: StreamControlError | null };

export const streamIntents: readonly StreamIntent[] = ["start", "active", "weak", "disconnected", "ended"];

export function isStreamIntent(value: unknown): value is StreamIntent {
  return typeof value === "string" && (streamIntents as readonly string[]).includes(value);
}

/** What the controls show after the server answered `intent`, starting from `current`. */
export function streamAfter(current: CleanerStream, intent: StreamIntent, result: StreamActionState): StreamOutcome {
  if (!result) return { stream: current, note: null, error: null };
  if (result.ok) {
    if (intent === "start") return { stream: "active", note: null, error: null };
    if (intent === "ended") return { stream: "off", note: "stopped", error: null };
    return { stream: intent, note: null, error: null };
  }
  const error = result.formError ?? "unavailable";
  // Reporting a state of a stream the server no longer has: it has ended, so the card offers to start again.
  if (error === "notFound" && intent !== "start") return { stream: "off", note: null, error: "streamGone" };
  return { stream: current, note: null, error };
}

export type SimulationChoice = { status: Exclude<CleanerStream, "off">; current: boolean };

/** The simulation buttons: weak signal and disconnected, plus reconnect when the signal is not normal. */
export function simulationChoices(stream: CleanerStream): SimulationChoice[] {
  if (stream === "off") return [];
  const choices: SimulationChoice[] = [
    { status: "weak", current: stream === "weak" },
    { status: "disconnected", current: stream === "disconnected" },
  ];
  if (stream !== "active") choices.push({ status: "active", current: false });
  return choices;
}
