// A job checked in to but never checked out (2026-11-20, final review): the cleaner forgot "Check-out"
// or the phone died. Until now such a job read "Sedang berlangsung" for ever, with "Tonton langsung"
// days later. Once its window ended more than checkOutGraceHours ago it is no longer counted as under
// way anywhere: the customer, the agency and admin see "Belum check-out" (a problem to follow up), not
// a live job. The cleaner can still check out; nothing in the database changes. Pure, so every page and
// tests/overdue.test.ts agree.

/** How long after the window's end a job may still be under way (work running late). */
export const checkOutGraceHours = 3;

export function checkOutOverdue(
  job: { checkedInAt: string | null; completedAt: string | null; endsAt: string },
  now: Date,
): boolean {
  if (job.checkedInAt === null || job.completedAt !== null) return false;
  return Date.parse(job.endsAt) + checkOutGraceHours * 3_600_000 <= now.getTime();
}
