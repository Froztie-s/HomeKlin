"use client";

import { useSyncExternalStore } from "react";
import type { CleanerStream } from "./stream-control-state";

// Which stream this browser tab has running, per job (T22), so a reloaded job card still shows the
// stream as live. The server holds the truth (stream_sessions) but has no read for the cleaner yet, so
// the card remembers what the server last accepted from this tab. Session storage: it ends with the
// tab, and a blocked or missing storage just means the card starts as "off" (pressing Mulai siaran
// again resumes the same stream on the server). The server renders "off"; the browser then shows the
// remembered state.

const listeners = new Set<() => void>();
const keyOf = (orderId: string) => `homeklin.stream.${orderId}`;
const remembered: readonly string[] = ["active", "weak", "disconnected"];

export function readStream(orderId: string): CleanerStream {
  try {
    const value = window.sessionStorage.getItem(keyOf(orderId));
    return value && remembered.includes(value) ? (value as CleanerStream) : "off";
  } catch {
    return "off";
  }
}

export function rememberStream(orderId: string, stream: CleanerStream) {
  try {
    if (stream === "off") window.sessionStorage.removeItem(keyOf(orderId));
    else window.sessionStorage.setItem(keyOf(orderId), stream);
  } catch (error) {
    console.warn("[stream] could not remember the stream in this tab:", error);
  }
  for (const notify of listeners) notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRememberedStream(orderId: string): CleanerStream {
  return useSyncExternalStore(
    subscribe,
    () => readStream(orderId),
    () => "off",
  );
}
