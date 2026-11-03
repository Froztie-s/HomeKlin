import { beforeEach, describe, expect, it, vi } from "vitest";

// The endpoint that hands out a recording's link (T14, src/app/api/recordings/[id]/link/route.ts), with
// stand-in clients. Who may replay is decided by the database (tests/integration/recording-access.test.ts);
// here: the answer for each outcome, and that nobody gets a link without being signed in.

const recordingId = "0b8f3c1e-1111-4222-8333-944455556666";
const { getClaims, rpc, createSignedUrl } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  rpc: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getClaims }, rpc }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createSupabaseServiceClient: () => ({ storage: { from: () => ({ createSignedUrl }) } }),
}));

const { GET } = await import("@/app/api/recordings/[id]/link/route");

async function get(id: string) {
  const response = await GET(new Request(`https://homeklin.test/api/recordings/${id}/link`), {
    params: Promise.resolve({ id }),
  });
  return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json() };
}

describe("GET /api/recordings/[id]/link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
    rpc.mockResolvedValue({
      data: [{ file_path: `jobs/${recordingId}.mp4`, expires_at: new Date(Date.now() + 86_400_000).toISOString() }],
      error: null,
    });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://storage.test/signed?token=t" }, error: null });
  });

  it("gives the link to someone the database lets in, and nobody caches it", async () => {
    const response = await get(recordingId);

    expect(response.status).toBe(200);
    expect(response.cache).toBe("no-store");
    expect(response.body).toMatchObject({ url: "https://storage.test/signed?token=t" });
    expect(rpc).toHaveBeenCalledWith("recording_for_viewer", { p_recording: recordingId });
    expect(createSignedUrl).toHaveBeenCalledWith(`jobs/${recordingId}.mp4`, 600);
  });

  it("asks a visitor to sign in, without looking the recording up", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    expect(await get(recordingId)).toMatchObject({ status: 401, body: { error: "sign_in_required" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers an id that is not a recording id as not found", async () => {
    expect(await get("../../orders")).toMatchObject({ status: 404, body: { error: "recording_not_found" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers not found when the database refuses this viewer", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "recording_not_found" } });
    expect(await get(recordingId)).toMatchObject({ status: 404, body: { error: "recording_not_found" } });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("answers gone for an expired recording", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "recording_expired" } });
    expect(await get(recordingId)).toMatchObject({ status: 410, body: { error: "recording_expired" } });
  });

  it("answers unavailable when the database or storage fails", async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: { message: "storage down" } });
    expect(await get(recordingId)).toMatchObject({ status: 503, body: { error: "unavailable" } });
  });
});
