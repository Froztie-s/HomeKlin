import { beforeEach, describe, expect, it, vi } from "vitest";
import { StreamError } from "@/lib/stream/streams";

// The live stream endpoint (T23, src/app/api/streams/[orderId]/route.ts) with a stand-in stream reader.
// Who may watch is decided by the database (tests/integration/streams.test.ts); here: each answer, and
// that nobody gets a link without being signed in.

const orderId = "0b8f3c1e-1111-4222-8333-944455556666";
const { getClaims, watchStream, streamStatus } = vi.hoisted(() => ({ getClaims: vi.fn(), watchStream: vi.fn(), streamStatus: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getClaims } }) }));
vi.mock("@/lib/supabase/service", () => ({ createSupabaseServiceClient: () => ({}) }));
vi.mock("@/lib/stream/streams", async (original) => ({
  ...(await original<typeof import("@/lib/stream/streams")>()),
  watchStream,
  streamStatus,
}));

const { GET } = await import("@/app/api/streams/[orderId]/route");

async function get(id: string, query = "") {
  const response = await GET(new Request(`https://homeklin.test/api/streams/${id}${query}`), { params: Promise.resolve({ orderId: id }) });
  return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  getClaims.mockResolvedValue({ data: { claims: { sub: "u" } }, error: null });
  watchStream.mockResolvedValue({
    status: "active",
    cleanerName: "Yuliana",
    startedAt: "2026-11-04T03:00:00.000Z",
    view: { kind: "video", url: "https://storage.test/clip?token=t", expiresInSeconds: 600 },
  });
  streamStatus.mockResolvedValue("weak");
});

describe("GET /api/streams/[orderId]", () => {
  it("answers what to play, never cached", async () => {
    const response = await get(orderId);
    expect(response).toMatchObject({ status: 200, cache: "no-store", body: { status: "active", view: { kind: "video" } } });
  });

  it("answers only the status when polled", async () => {
    expect(await get(orderId, "?status=1")).toMatchObject({ status: 200, body: { status: "weak" } });
    expect(watchStream).not.toHaveBeenCalled();
    streamStatus.mockResolvedValue(null);
    expect((await get(orderId, "?status=1")).status).toBe(404);
  });

  it("asks a visitor to sign in, and answers not found for a refusal or a bad id", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    expect((await get(orderId)).status).toBe(401);
    getClaims.mockResolvedValue({ data: { claims: { sub: "u" } }, error: null });
    expect((await get("not-an-id")).status).toBe(404);
    watchStream.mockRejectedValue(new StreamError("stream_not_found", "stream_not_found"));
    expect(await get(orderId)).toMatchObject({ status: 404, body: { error: "stream_not_found" } });
  });

  it("answers unavailable when the source fails", async () => {
    watchStream.mockRejectedValue(new Error("storage down"));
    expect((await get(orderId)).status).toBe(503);
  });
});
