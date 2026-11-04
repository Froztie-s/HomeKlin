import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobRoom, livekitConfig, livekitToken, livekitTokenSeconds } from "@/lib/stream/livekit";

// LiveKit tokens (T31, src/lib/stream/livekit.ts and src/app/api/streams/[orderId]/token/route.ts):
// signed with the API secret, one room per job, publishing only for the job's cleaner, 10 minutes, and
// no token for anyone the stream rules refuse. The rules themselves: tests/integration/streams.test.ts.

const config = { apiKey: "APItestkey", apiSecret: "a-test-secret-that-is-long-enough", serverUrl: "wss://homeklin-test.livekit.cloud" };
const orderId = "0b8f3c1e-1111-4222-8333-944455556666";

function decode(token: string) {
  const [header, claims, signature] = token.split(".");
  return {
    header: JSON.parse(Buffer.from(header ?? "", "base64url").toString()),
    claims: JSON.parse(Buffer.from(claims ?? "", "base64url").toString()),
    valid: createHmac("sha256", config.apiSecret).update(`${header}.${claims}`).digest("base64url") === signature,
  };
}

describe("livekitToken", () => {
  it("signs a token for one room, with what the participant may do, for 10 minutes", () => {
    const token = livekitToken(config, { identity: "user-1", room: jobRoom(orderId), canPublish: true, now: 1_000_000 });
    const { header, claims, valid } = decode(token);
    expect(valid).toBe(true);
    expect(header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(claims).toMatchObject({
      iss: config.apiKey,
      sub: "user-1",
      nbf: 1000,
      exp: 1000 + livekitTokenSeconds,
      video: { room: `job-${orderId}`, roomJoin: true, canPublish: true, canSubscribe: true },
    });
  });

  it("does not verify with another secret", () => {
    const token = livekitToken(config, { identity: "u", room: "r", canPublish: false });
    expect(decode(token).valid).toBe(true);
    const [header, claims, signature] = token.split(".");
    expect(createHmac("sha256", "another-secret").update(`${header}.${claims}`).digest("base64url")).not.toBe(signature);
  });
});

describe("livekitConfig", () => {
  it("needs the key, the secret and a wss:// address", () => {
    expect(livekitConfig({ LIVEKIT_API_KEY: "k", LIVEKIT_API_SECRET: "s", LIVEKIT_URL: "wss://x.livekit.cloud" })).toEqual({
      apiKey: "k", apiSecret: "s", serverUrl: "wss://x.livekit.cloud",
    });
    expect(livekitConfig({ LIVEKIT_API_KEY: "k", LIVEKIT_API_SECRET: "s", LIVEKIT_URL: "http://x" })).toBeNull();
    expect(livekitConfig({})).toBeNull();
  });
});

const { getClaims, rpc } = vi.hoisted(() => ({ getClaims: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getClaims }, rpc }) }));
const { GET } = await import("@/app/api/streams/[orderId]/token/route");

async function get(id = orderId) {
  const response = await GET(new Request(`https://homeklin.test/api/streams/${id}/token`), { params: Promise.resolve({ orderId: id }) });
  return { status: response.status, body: await response.json() };
}

describe("GET /api/streams/[orderId]/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LIVEKIT_API_KEY", config.apiKey);
    vi.stubEnv("LIVEKIT_API_SECRET", config.apiSecret);
    vi.stubEnv("LIVEKIT_URL", config.serverUrl);
    vi.spyOn(console, "error").mockImplementation(() => {});
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
  });

  it("gives the job's cleaner a token that may publish", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const response = await get();
    expect(response).toMatchObject({ status: 200, body: { serverUrl: config.serverUrl, canPublish: true } });
    expect(decode(response.body.token).claims.video).toMatchObject({ room: `job-${orderId}`, canPublish: true });
  });

  it("gives an allowed viewer a token that may only watch", async () => {
    rpc.mockImplementation(async (fn: string) => (fn === "can_publish_stream" ? { data: false, error: null } : { data: [{ session_id: "s" }], error: null }));
    const response = await get();
    expect(response.body.canPublish).toBe(false);
    expect(decode(response.body.token).claims.video.canPublish).toBe(false);
  });

  it("gives no token to anyone the stream rules refuse, nor without a session or a set-up LiveKit", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === "can_publish_stream" ? { data: false, error: null } : { data: null, error: { message: "stream_not_found" } },
    );
    expect(await get()).toEqual({ status: 404, body: { error: "stream_not_found" } });
    getClaims.mockResolvedValue({ data: null, error: null });
    expect((await get()).status).toBe(401);
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
    vi.stubEnv("LIVEKIT_URL", "");
    expect(await get()).toEqual({ status: 503, body: { error: "not_configured" } });
  });
});
