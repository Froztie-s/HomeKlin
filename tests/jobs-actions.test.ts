import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobProgress } from "@/lib/jobs/jobs";

// The job actions (T18 check-in and check-out, T28 assigning a cleaner; src/lib/jobs/actions.ts) with
// stand-in clients. The rules themselves live in the database and are tested against the test project
// in tests/integration/jobs.test.ts; here: the role check, the input parsing, the refusal keys, and that
// check-out attaches the recording without losing the completed job when that fails.

const orderId = "0b8f3c1e-1111-4222-8333-944455556666";
const cleanerId = "1c9f4d2f-2222-4333-8444-a55566667777";
const { rpc, attach, emailCleanerAssigned, emailRecordingReady } = vi.hoisted(() => ({
  rpc: vi.fn(),
  attach: vi.fn(),
  emailCleanerAssigned: vi.fn(),
  emailRecordingReady: vi.fn(),
}));
let user: { role: string } | null = null;

vi.mock("@/lib/auth/dal", () => ({ authorize: async (roles: string[]) => (user && roles.includes(user.role) ? user : null) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));
vi.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: () => ({}) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/recordings/attach", async (original) => ({
  ...(await original<typeof import("@/lib/recordings/attach")>()),
  attachRecording: attach,
}));

// B9: the emails these actions trigger (src/lib/email/order-emails.ts), replaced: nothing is sent.
vi.mock("@/lib/email/order-emails", () => ({ emailCleanerAssigned, emailRecordingReady }));

const { checkIn, checkOut, assignCleaner } = await import("@/lib/jobs/actions");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  user = { role: "cleaner" };
  rpc.mockResolvedValue({ data: "2026-11-10T03:00:00Z", error: null });
  attach.mockResolvedValue({ id: "r", filePath: `jobs/${orderId}.mp4`, expiresAt: "2026-11-17T03:00:00Z" });
});

describe("checkIn", () => {
  it("records the place the browser reported", async () => {
    expect(await checkIn(null, form({ orderId, lat: "-6.2444", lng: "106.8", accuracy: "12" }))).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("check_in", { p_order: orderId, p_lat: -6.2444, p_lng: 106.8, p_accuracy: 12 });
  });

  it("refuses without a location, and anyone but a cleaner", async () => {
    expect(await checkIn(null, form({ orderId }))).toEqual({ formError: "locationInvalid" });
    expect(await checkIn(null, form({ orderId, lat: "100", lng: "0" }))).toEqual({ formError: "locationInvalid" });
    user = { role: "customer" };
    expect(await checkIn(null, form({ orderId, lat: "-6", lng: "106" }))).toEqual({ formError: "notAllowed" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["too_early", "tooEarly"],
    ["too_late", "tooLate"],
    ["already_checked_in", "alreadyCheckedIn"],
    ["job_not_found", "notFound"],
    ["something else", "unavailable"],
  ])("turns %s into %s", async (message, key) => {
    rpc.mockResolvedValue({ data: null, error: { message } });
    expect(await checkIn(null, form({ orderId, lat: "-6", lng: "106" }))).toEqual({ formError: key });
  });
});

describe("checkOut", () => {
  it("completes the job and attaches its recording", async () => {
    expect(await checkOut(null, form({ orderId }))).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("check_out", { p_order: orderId });
    expect(attach).toHaveBeenCalledWith(expect.anything(), orderId, { retentionDays: 7 });
  });

  it("emails the customer that the recording is ready, only once it is attached (B9)", async () => {
    await checkOut(null, form({ orderId }));
    expect(emailRecordingReady).toHaveBeenCalledWith(orderId);
    expect(attach.mock.invocationCallOrder[0]).toBeLessThan(emailRecordingReady.mock.invocationCallOrder[0]);
    vi.clearAllMocks();
    attach.mockRejectedValue(new Error("no clips"));
    await checkOut(null, form({ orderId }));
    expect(emailRecordingReady).not.toHaveBeenCalled();
  });

  it("keeps the job completed and says so when the recording cannot be attached", async () => {
    attach.mockRejectedValue(new Error("no clips"));
    expect(await checkOut(null, form({ orderId }))).toEqual({ ok: true, recordingMissing: true });
  });

  it("attaches nothing when the database refuses the check-out", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "not_checked_in" } });
    expect(await checkOut(null, form({ orderId }))).toEqual({ formError: "notCheckedIn" });
    expect(attach).not.toHaveBeenCalled();
  });
});

describe("assignCleaner", () => {
  it("is the agency's, with a job and a cleaner", async () => {
    user = { role: "agency" };
    // assign_cleaner answers true when the job got a different cleaner (review L4).
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await assignCleaner(null, form({ orderId, cleanerId }))).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("assign_cleaner", { p_order: orderId, p_cleaner: cleanerId });
    // B9: the customer learns the cleaner's name and photo by email, after the assignment only.
    expect(emailCleanerAssigned).toHaveBeenCalledTimes(1);
    expect(emailCleanerAssigned).toHaveBeenCalledWith(orderId);
    expect(await assignCleaner(null, form({ orderId, cleanerId: "nobody" }))).toEqual({ formError: "cleanerNotFound" });
    user = { role: "cleaner" };
    expect(await assignCleaner(null, form({ orderId, cleanerId }))).toEqual({ formError: "notAllowed" });
  });
});

describe("assignCleaner's email (review L4)", () => {
  it("emails the customer only when the job got a different cleaner", async () => {
    user = { role: "agency" };
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await assignCleaner(null, form({ orderId, cleanerId }))).toEqual({ ok: true });
    expect(emailCleanerAssigned).not.toHaveBeenCalled();

    rpc.mockResolvedValue({ data: true, error: null });
    expect(await assignCleaner(null, form({ orderId, cleanerId }))).toEqual({ ok: true });
    expect(emailCleanerAssigned).toHaveBeenCalledTimes(1);
  });
});

describe("jobProgress", () => {
  it("names each stage", () => {
    const base = { cleanerName: null, checkedInAt: null, completedAt: null };
    expect(jobProgress(base)).toBe("unassigned");
    expect(jobProgress({ ...base, cleanerName: "Yuliana" })).toBe("assigned");
    expect(jobProgress({ ...base, cleanerName: "Yuliana", checkedInAt: "x" })).toBe("inProgress");
    expect(jobProgress({ ...base, cleanerName: "Yuliana", checkedInAt: "x", completedAt: "y" })).toBe("completed");
  });

  // A job checked in to and not checked out is overdue ("Belum check-out") once checkOutGraceHours (3 h)
  // have passed since its window ended (src/lib/jobs/overdue.ts); until then it is still in progress.
  describe("with the time now and the window's end", () => {
    const endsAt = "2026-11-14T08:00:00.000Z";
    const boundary = Date.parse(endsAt) + 3 * 3_600_000;
    const checkedIn = { cleanerName: "Yuliana", checkedInAt: "2026-11-14T06:05:00.000Z", completedAt: null, endsAt };

    it("is overdue exactly 3 hours after the window's end", () => {
      expect(jobProgress(checkedIn, new Date(boundary))).toBe("overdue");
    });

    it("is still in progress 1 ms before the 3 hours are up", () => {
      expect(jobProgress(checkedIn, new Date(boundary - 1))).toBe("inProgress");
    });

    it("stays overdue after the boundary, 1 ms and days later", () => {
      expect(jobProgress(checkedIn, new Date(boundary + 1))).toBe("overdue");
      expect(jobProgress(checkedIn, new Date(boundary + 5 * 24 * 3_600_000))).toBe("overdue");
    });

    it("is in progress during the window itself", () => {
      expect(jobProgress(checkedIn, new Date("2026-11-14T07:00:00.000Z"))).toBe("inProgress");
    });

    it("is completed, not overdue, once it was checked out, however late", () => {
      const checkedOut = { ...checkedIn, completedAt: "2026-11-14T13:00:00.000Z" };
      expect(jobProgress(checkedOut, new Date(boundary + 3_600_000))).toBe("completed");
    });

    it("is never overdue without a check-in: late and unchecked-in reads as assigned or unassigned", () => {
      const late = new Date(boundary + 3_600_000);
      expect(jobProgress({ ...checkedIn, checkedInAt: null }, late)).toBe("assigned");
      expect(jobProgress({ ...checkedIn, checkedInAt: null, cleanerName: null }, late)).toBe("unassigned");
    });
  });

  // Pinned as it is today: callers that do not pass the time now (the customer's order page,
  // src/components/customer/job-progress.ts) or the window's end can never see "overdue".
  describe("without the time now or the window's end", () => {
    const endsAt = "2026-11-14T08:00:00.000Z";
    const longAfter = new Date("2026-11-24T08:00:00.000Z");
    const checkedIn = { cleanerName: "Yuliana", checkedInAt: "2026-11-14T06:05:00.000Z", completedAt: null };

    it("never returns overdue without now, even with the window's end long past", () => {
      expect(jobProgress({ ...checkedIn, endsAt })).toBe("inProgress");
    });

    it("never returns overdue without the window's end, even with now long after it", () => {
      expect(jobProgress(checkedIn, longAfter)).toBe("inProgress");
    });

    it("never returns overdue with neither", () => {
      expect(jobProgress(checkedIn)).toBe("inProgress");
    });
  });
});
