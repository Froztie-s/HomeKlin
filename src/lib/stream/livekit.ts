import { createHmac } from "node:crypto";

// LiveKit access tokens (T31), made on HomeKlin's server only. A LiveKit token is a JWT signed with
// HS256 using the project's API secret, with the API key as issuer, the participant as subject and a
// "video" grant naming one room and what the participant may do there. One room per job ("job-<order
// id>"); the cleaner may publish, viewers may only subscribe. Tokens live 10 minutes: LiveKit checks
// them when a participant joins, so a leaked token soon stops working.
// Source: https://docs.livekit.io/home/get-started/authentication/ ("Creating a token", "Video grant")

export const livekitTokenSeconds = 600;

export type LivekitConfig = { apiKey: string; apiSecret: string; serverUrl: string };

/** The LiveKit project from the environment, or null when it is not set up (the demo source is used). */
export function livekitConfig(env: Record<string, string | undefined> = process.env): LivekitConfig | null {
  const apiKey = env.LIVEKIT_API_KEY;
  const apiSecret = env.LIVEKIT_API_SECRET;
  const serverUrl = env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !serverUrl || !/^wss:\/\//.test(serverUrl)) return null;
  return { apiKey, apiSecret, serverUrl };
}

export function jobRoom(orderId: string): string {
  return `job-${orderId}`;
}

export type TokenGrant = {
  identity: string;
  name?: string;
  room: string;
  canPublish: boolean;
  now?: number;
};

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/** A signed LiveKit token for one participant in one room. */
export function livekitToken(config: Pick<LivekitConfig, "apiKey" | "apiSecret">, grant: TokenGrant): string {
  const issuedAt = Math.floor((grant.now ?? Date.now()) / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const claims = {
    iss: config.apiKey,
    sub: grant.identity,
    name: grant.name,
    nbf: issuedAt,
    iat: issuedAt,
    exp: issuedAt + livekitTokenSeconds,
    video: {
      room: grant.room,
      roomJoin: true,
      canPublish: grant.canPublish,
      canPublishData: false,
      canSubscribe: true,
    },
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = createHmac("sha256", config.apiSecret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}
