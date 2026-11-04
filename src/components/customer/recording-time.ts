import type { CustomerOrder } from "@/lib/booking/orders";

// What a finished job's details say about its recording (T15): which state the section shows, and how
// long the recording is still kept, in words such as "6 hari 23 jam lagi". Pure, so the server page and
// the countdown in the browser (./recording-countdown.tsx) say the same thing.

/** none: the job is not done yet. available: it can be replayed. expired: deleted after 7 days. */
export type RecordingState = "none" | "available" | "expired" | "unavailable";

export function recordingState(
  order: Pick<CustomerOrder, "status" | "completedAt" | "recordingId" | "recordingExpiresAt" | "recordingDeleted">,
  now: number,
): RecordingState {
  if (order.status !== "paid" || !order.completedAt) return "none";
  if (!order.recordingId) return "unavailable";
  if (order.recordingDeleted || !order.recordingExpiresAt || Date.parse(order.recordingExpiresAt) <= now) return "expired";
  return "available";
}

export type TimeLeft =
  | { unit: "days"; days: number; hours: number }
  | { unit: "hours"; hours: number; minutes: number }
  | { unit: "minutes"; minutes: number }
  | { unit: "ended" };

const minutesPerHour = 60;
const minutesPerDay = 24 * minutesPerHour;

/**
 * The time left until expiry, in the two largest units. A started minute counts as a whole one, so the
 * last seconds still read "1 menit lagi" and nothing reads "0" before the recording is gone.
 */
export function recordingTimeLeft(expiresAt: string, now: number): TimeLeft {
  const milliseconds = Date.parse(expiresAt) - now;
  if (!(milliseconds > 0)) return { unit: "ended" };
  const minutes = Math.ceil(milliseconds / 60_000);
  if (minutes >= minutesPerDay) {
    return { unit: "days", days: Math.floor(minutes / minutesPerDay), hours: Math.floor((minutes % minutesPerDay) / minutesPerHour) };
  }
  if (minutes >= minutesPerHour) {
    return { unit: "hours", hours: Math.floor(minutes / minutesPerHour), minutes: minutes % minutesPerHour };
  }
  return { unit: "minutes", minutes };
}

/** The Recording message for the time left, with its values (each message uses only its own). */
export function timeLeftMessage(left: TimeLeft): {
  key: "left.days" | "left.hours" | "left.minutes" | "left.ended";
  values: { days: number; hours: number; minutes: number };
} {
  const values = { days: 0, hours: 0, minutes: 0 };
  switch (left.unit) {
    case "days":
      return { key: "left.days", values: { ...values, days: left.days, hours: left.hours } };
    case "hours":
      return { key: "left.hours", values: { ...values, hours: left.hours, minutes: left.minutes } };
    case "minutes":
      return { key: "left.minutes", values: { ...values, minutes: left.minutes } };
    case "ended":
      return { key: "left.ended", values };
  }
}
