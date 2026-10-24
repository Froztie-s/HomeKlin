// How long a service takes, split for the words on the customer pages: "± 2 jam", "± 1 jam 30 menit",
// "± 45 menit" (messages Service.duration* in src/messages). Services store whole minutes (T7).

export function splitDuration(totalMinutes: number): { hours: number; minutes: number } {
  const minutes = Math.max(0, Math.round(totalMinutes));
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
