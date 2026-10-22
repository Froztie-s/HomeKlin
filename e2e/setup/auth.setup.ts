import { expect, test as setup } from "@playwright/test";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import type { AppRole } from "@/lib/auth/roles";
import { adminClient, testProject } from "../../tests/integration/test-project";
import { authDir, readTestUsers, signedInAs, writeTestUsers, type StorageState } from "./auth-state";

// Runs before the suite (the "setup" project in playwright.config.ts): one confirmed test user per role
// in the Supabase test project, signed in without the UI, with the session saved as that role's storage
// state (auth-state.ts). Each user is recorded as soon as it exists, so the teardown deletes it even
// when a later step fails.

type SessionCookie = { name: string; value: string; options: CookieOptions };
type StorageCookie = StorageState["cookies"][number];

// For each role, a page only that role may open (src/lib/auth/roles.ts). The setup opens it with the
// saved session, so a session the app does not accept fails here, before any spec relies on it.
const ownPage = {
  customer: "/orders",
  cleaner: "/cleaner",
  agency: "/agency",
  admin: "/admin",
} as const satisfies Record<AppRole, string>;

/**
 * Signs in the way the app's sign-in action does (src/lib/auth/actions.ts): a @supabase/ssr server client
 * with the default cookie settings, so the session comes out in the cookie format the proxy and the
 * server components read (src/lib/supabase/proxy-session.ts, src/lib/supabase/server.ts). There is no
 * request to read cookies from; setAll collects what the client would send to the browser: the session
 * cookie, split into numbered chunks when it is large.
 * Source: node_modules/@supabase/ssr/dist/main/createServerClient.js and cookies.js (setAll runs on the
 * SIGNED_IN event, which signInWithPassword awaits)
 */
async function signIn(role: AppRole, email: string, password: string): Promise<SessionCookie[]> {
  const jar = new Map<string, SessionCookie>();
  const supabase = createServerClient(testProject.url, testProject.publishableKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookiesToSet) => {
        for (const cookie of cookiesToSet) {
          // An empty cookie that expires at once is a deletion, as a browser would treat it.
          if (cookie.value === "" || cookie.options.maxAge === 0) jar.delete(cookie.name);
          else jar.set(cookie.name, cookie);
        }
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Could not sign in the ${role} test user: ${error.message} (HTTP ${error.status})`);
  return [...jar.values()];
}

function sameSite(value: CookieOptions["sameSite"]): StorageCookie["sameSite"] {
  if (value === "strict" || value === true) return "Strict";
  if (value === "none") return "None";
  // "lax", or not set: browsers treat a cookie without SameSite as Lax.
  return "Lax";
}

/** The cookie as a browser keeps it after the Set-Cookie header, in Playwright's storage-state shape. */
function toStorageCookie({ name, value, options }: SessionCookie, domain: string): StorageCookie {
  let expires = -1; // a session cookie
  if (options.maxAge !== undefined) expires = Math.floor(Date.now() / 1000) + options.maxAge;
  else if (options.expires) expires = Math.floor(options.expires.getTime() / 1000);
  return {
    name,
    value,
    domain,
    path: options.path ?? "/",
    expires,
    httpOnly: options.httpOnly ?? false,
    secure: options.secure ?? false,
    sameSite: sameSite(options.sameSite),
  };
}

setup("signs in one test user per role", async ({ baseURL, playwright }) => {
  if (!baseURL) throw new Error("playwright.config.ts must set use.baseURL.");
  // The app's host (localhost): a browser sends a cookie to its host on any port.
  const domain = new URL(baseURL).hostname;
  mkdirSync(authDir, { recursive: true });
  const admin = adminClient();
  // Users from an earlier run whose teardown never ran stay on the list, so this run's teardown deletes them.
  const users = readTestUsers();

  for (const role of Object.keys(signedInAs) as AppRole[]) {
    const email = `homeklin-e2e-${role}-${randomUUID().slice(0, 8)}@example.com`;
    const password = randomBytes(18).toString("base64url");
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) {
      throw new Error(`Could not create the ${role} test user: ${created.error?.message}`);
    }
    const { id } = created.data.user;
    users.push({ role, id });
    writeTestUsers(users);
    console.log(`Created the ${role} test user ${id}`);

    // Every new user is a customer; only the service role can change a role (the T5 migration).
    const profile = await admin.from("profiles").update({ role }).eq("id", id).select("role").single();
    expect(profile.error, `${role} profile updated`).toBeNull();
    expect(profile.data?.role).toBe(role);

    const cookies = await signIn(role, email, password);
    expect(cookies.length, `${role} session cookies`).toBeGreaterThan(0);
    const state: StorageState = { cookies: cookies.map((cookie) => toStorageCookie(cookie, domain)), origins: [] };
    const { storageState } = signedInAs[role];
    writeFileSync(storageState, `${JSON.stringify(state, null, 2)}\n`);

    // A signed-out visitor of a protected page is redirected to /login by the proxy (src/proxy.ts).
    const app = await playwright.request.newContext({ baseURL, storageState });
    const status = (await app.get(ownPage[role], { maxRedirects: 0 })).status();
    await app.dispose();
    expect(status, `the app accepts the ${role} session at ${ownPage[role]}`).toBe(200);
  }
});
