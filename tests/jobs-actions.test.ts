import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobProgress } from "@/lib/jobs/jobs";

// The job actions (T18 check-in and check-out, T28 assigning a cleaner; src/lib/jobs/actions.ts) with
// stand-in clients. The rules themselves live in the database and are tested against the test project
// in tests/integration/jobs.test.ts; here: the role check, the input parsing, the refusal keys, and that
// check-out attaches the recording without losing the completed job when that fails.

const orderId = "0b8f3c1e-1111-4222-8333-944455556666";
const cleanerId = "1c9f4d2f-2222-4333-8444-a55566667777";
const { rpc, attach } = vi.hoisted(() => ({ rpc: vi.fn(), attach: vi.fn() }));
let user: { role: string } | null = null;

vi.mock("@/lib/auth/dal", () => ({ authorize: async (roles: string[]) => (user && roles.includes(user.role) ? user : null) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));
vi.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: () => ({}) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/recordings/attach", async (original) => ({
  ...(await original<typeof import("@/lib/recordings/attach")>()),
  attachRecording: attach,
}));

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
    expect(await assignCleaner(null, form({ orderId, cleanerId }))).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("assign_cleaner", { p_order: orderId, p_cleaner: cleanerId });
    expect(await assignCleaner(null, form({ orderId, cleanerId: "nobody" }))).toEqual({ formError: "cleanerNotFound" });
    user = { role: "cleaner" };
    expect(await assignCleaner(null, form({ orderId, cleanerId }))).toEqual({ formError: "notAllowed" });
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
});
