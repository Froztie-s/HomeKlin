// When a cleaner may check in (T18): from 15 minutes before the arrival window opens until it closes.
// The database enforces it (check_in(), supabase/migrations/20261104090000_jobs.sql); the cleaner's
// page uses this copy to show the right button and say when check-in opens.

export const checkInLeadMinutes = 15;

export type CheckInState = "early" | "open" | "late" | "checkedIn" | "completed";

type JobTimes = { startsAt: string; endsAt: string; checkedInAt: string | null; completedAt: string | null };

export function checkInOpensAt(startsAt: string): string {
  return new Date(Date.parse(startsAt) - checkInLeadMinutes * 60_000).toISOString();
}

export function checkInState(job: JobTimes, now: Date): CheckInState {
  if (job.completedAt) return "completed";
  if (job.checkedInAt) return "checkedIn";
  if (now.getTime() < Date.parse(checkInOpensAt(job.startsAt))) return "early";
  if (now.getTime() > Date.parse(job.endsAt)) return "late";
  return "open";
}
