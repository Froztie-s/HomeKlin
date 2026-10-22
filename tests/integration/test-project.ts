import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

// The separate Supabase test project the integration tests run against (markdown/SPEC.md, "Testing
// Strategy"), never the live one. Locally its keys are in .env (npm run supabase -- create-test-project);
// in CI they come from the repository secrets. Missing keys fail the run instead of skipping it
// (markdown/CONSTRAINTS.md: no skipped tests).

if (!process.env.TEST_SUPABASE_URL && existsSync(".env")) process.loadEnvFile(".env");

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Integration tests need the test project's keys: run ` +
        "`npm run supabase -- create-test-project` (see .env.example), or set the CI secrets.",
    );
  }
  return value;
}

export const testProject = {
  url: required("TEST_SUPABASE_URL"),
  publishableKey: required("TEST_SUPABASE_PUBLISHABLE_KEY"),
  secretKey: required("TEST_SUPABASE_SECRET_KEY"),
};

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Acts with the secret key: bypasses row-level security. Only for setting up and cleaning up. */
export function adminClient(): SupabaseClient {
  return createClient(testProject.url, testProject.secretKey, noSession);
}

/** Acts like a browser that is not signed in (the publishable key, row-level security applies). */
export function visitorClient(): SupabaseClient {
  return createClient(testProject.url, testProject.publishableKey, noSession);
}

export type TestUser = { id: string; email: string; password: string; client: SupabaseClient };

/**
 * A confirmed user with a unique address on example.com (reserved, never delivered), signed in on its
 * own client. Any metadata is passed exactly as a visitor could send it at sign-up.
 */
export async function createTestUser(label: string, metadata: Record<string, unknown> = {}): Promise<TestUser> {
  const email = `homeklin-${label}-${randomUUID().slice(0, 8)}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error || !data.user) throw new Error(`Could not create test user ${label}: ${error?.message}`);

  const client = visitorClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`Could not sign in test user ${label}: ${signIn.error.message}`);
  return { id: data.user.id, email, password, client };
}

/** Deletes test users; their profiles go with them (on delete cascade). */
export async function deleteTestUsers(users: readonly (TestUser | undefined)[]): Promise<void> {
  const admin = adminClient();
  for (const user of users) {
    if (user) await admin.auth.admin.deleteUser(user.id);
  }
}
