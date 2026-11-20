import { checkInState } from "@/lib/jobs/check-in";
import type { StreamStatus } from "@/lib/stream/streams";
import type { CleanerStream } from "./stream-control-state";

// The cleaner pages' small rules (D4, after the mocks Cleaner-Home, Cleaner-Jobs, Cleaner-Job and
// Cleaner-Live). Pure, tested in tests/cleaner-ui.test.ts.

/**
 * A status pill's shape (job-state.tsx, and the list's "Berikutnya" and day pills). It lives in this
 * plain module because a value exported from a client module reaches server components as a reference.
 */
export const pillBase = "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold";

/** "+6281234567890" -> "0812 3456 7890", as people dial it; another country's number stays as stored. */
export function localPhone(phone: string | null): string | null {
  const value = phone?.trim();
  if (!value) return null;
  if (!value.startsWith("+62")) return value;
  const digits = `0${value.slice(3)}`;
  return digits.match(/.{1,4}/g)?.join(" ") ?? digits;
}

/**
 * The job page's "Buka di Maps" link (audit item 4): Google Maps' search URL for the address, which
 * opens the Maps app on a phone that has it. It is a plain link, so the address goes to Google only
 * when the cleaner taps it; the page loads nothing from Google. Null for no address (no link).
 * Source: https://developers.google.com/maps/documentation/urls/get-started ("Search action")
 */
export function mapsSearchUrl(address: string): string | null {
  const value = address.trim();
  return value ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}` : null;
}

/** The hours tile: one decimal at most, never negative. */
export function roundHours(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.round(hours * 10) / 10;
}

type TodayJob = { id: string; startsAt: string; endsAt: string; checkedInAt: string | null; completedAt: string | null };

/**
 * The job the list and the home put first: the first of today's jobs still to do (in progress, open or
 * later today). `now` is true when the cleaner has checked in to it: then it reads "Sekarang", never
 * "Berikutnya" (2026-11-20, UX audit item 10: a job in progress wore "Berikutnya").
 */
export function focusJob<T extends TodayJob>(today: readonly T[], now: Date): { job: T; now: boolean } | null {
  for (const job of today) {
    const state = checkInState(job, now);
    if (state === "checkedIn") return { job, now: true };
    if (state === "open" || state === "early") return { job, now: false };
  }
  return null;
}

/** The id of focusJob's job, or null. */
export function nextJobId(today: readonly TodayJob[], now: Date): string | null {
  return focusJob(today, now)?.job.id ?? null;
}

/** The live state the job page starts from, from my_stream_status: an ended stream, or none, is off. */
export function streamFromStatus(status: StreamStatus | null): CleanerStream {
  return status === "active" || status === "weak" || status === "disconnected" ? status : "off";
}
