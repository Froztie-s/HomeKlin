// Seeds the demo users (T6): `npm run db:seed -- <live|test>`.
//
//   live   the live project:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, SEED_DEMO_PASSWORD
//   test   the test project:  TEST_SUPABASE_URL, TEST_SUPABASE_SECRET_KEY, TEST_SEED_DEMO_PASSWORD
//
// Creates or updates one customer, one admin, one agency user per partner agency and two cleaners per
// agency (scripts/seed-data.mjs), all with the demo password, and sets each profile's role and name.
// Running it again creates nothing: it updates the same accounts.
//
// Guard (T5 security review): sign-up is open and these e-mails are public in this repo, so anyone
// could register admin@example.com before the seed runs. The seed therefore creates its users only
// through the admin API with a marker in app_metadata, which only the secret key can set ("Only a
// service role can modify", AdminUserAttributes in @supabase/auth-js). If an account with a demo e-mail
// lacks the marker, the seed stops before changing anything. It never promotes an account found by e-mail.
//
// Values come from .env and are never printed. The functions are exported for the tests
// (tests/seed.test.ts, tests/integration/seed.test.ts); the command-line part runs only when this file
// is run directly. API reference: https://supabase.com/docs/reference/javascript/auth-admin-createuser,
// .../auth-admin-listusers and .../auth-admin-updateuserbyid

import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { agencies, demoAccounts } from "./seed-data.mjs";

/** The app_metadata key that marks an account as made by this seed. */
export const SEED_MARKER = "homeklin_seed";

const emailDomain = "example.com";

/**
 * @typedef {"customer" | "cleaner" | "agency" | "admin"} Role
 * @typedef {{ email: string, role: Role, fullName: string, agency?: string }} DemoUser
 * @typedef {{ id: string, email?: string, app_metadata?: Record<string, unknown>, user_metadata?: Record<string, unknown> }} ExistingUser
 * @typedef {{ action: "create", user: DemoUser } | { action: "update" | "refuse", user: DemoUser, id: string }} SeedStep
 * @typedef {DemoUser & { id: string, status: "created" | "updated" }} SeedResult
 */

/**
 * The demo users with their e-mails. A test run passes its own prefix ("t6-1a2b3c4d-") so it gets its
 * own accounts and never touches the real demo users.
 *
 * @param {string} [emailPrefix]
 * @returns {DemoUser[]}
 */
export function demoUsers(emailPrefix = "") {
  if (!/^[a-z0-9._-]*$/.test(emailPrefix)) {
    throw new Error("The e-mail prefix may only hold lower-case letters, digits, '.', '_' and '-'.");
  }
  return demoAccounts.map(({ localPart, role, fullName, agency }) => {
    const name = role === "agency" ? agencies.find((entry) => entry.key === agency)?.name : fullName;
    if (!name) throw new Error(`Demo user ${localPart} has no name (or an unknown agency).`);
    const user = { email: `${emailPrefix}${localPart}@${emailDomain}`, role, fullName: name };
    return agency === undefined ? user : { ...user, agency };
  });
}

const targets = {
  live: { url: "NEXT_PUBLIC_SUPABASE_URL", secretKey: "SUPABASE_SECRET_KEY", password: "SEED_DEMO_PASSWORD" },
  test: { url: "TEST_SUPABASE_URL", secretKey: "TEST_SUPABASE_SECRET_KEY", password: "TEST_SEED_DEMO_PASSWORD" },
};

// Supabase Auth hashes passwords with bcrypt, which reads only the first 72 bytes, and the sign-up form
// asks for at least 8 characters (src/lib/validation/auth.ts). A demo password outside that range could
// not be typed into the sign-in form as it is.
const passwordBytes = (value) => new TextEncoder().encode(value).length;
const normalUrl = (url) => url.trim().replace(/\/+$/, "").toLowerCase();

/**
 * Which project to seed and with what, read from the environment. Errors name variables, never values.
 *
 * @param {string | undefined} target "live" or "test"
 * @param {Record<string, string | undefined>} env
 * @returns {{ name: "live" | "test", url: string, secretKey: string, password: string, passwordVariable: string }}
 */
export function seedTarget(target, env) {
  if (target !== "live" && target !== "test") {
    throw new Error("Say which project to seed: npm run db:seed -- live, or npm run db:seed -- test.");
  }
  const names = targets[target];
  const missing = Object.values(names).filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`Missing in .env: ${missing.join(", ")} (see .env.example).`);

  const url = String(env[names.url]);
  const password = String(env[names.password]);
  const liveUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  if (target === "test" && liveUrl && normalUrl(url) === normalUrl(liveUrl)) {
    throw new Error("TEST_SUPABASE_URL is the live project's URL. The test target must be the separate test project.");
  }
  if (password.length < 8 || passwordBytes(password) > 72) {
    throw new Error(`${names.password} must be 8 characters to 72 bytes long.`);
  }
  const secretKey = String(env[names.secretKey]);
  return { name: target, url, secretKey, password, passwordVariable: names.password };
}

/**
 * Decides, per demo user, what the seed does, without changing anything: create the account when its
 * e-mail is free, update it when this seed made it (the marker in app_metadata is exactly true), and
 * refuse it otherwise. Supabase Auth keeps e-mails unique, so there is at most one match.
 *
 * @param {readonly DemoUser[]} users
 * @param {readonly ExistingUser[]} existingUsers
 * @returns {SeedStep[]}
 */
export function planSeed(users, existingUsers) {
  const byEmail = new Map();
  for (const account of existingUsers) {
    if (account.email) byEmail.set(account.email.toLowerCase(), account);
  }
  return users.map((user) => {
    const account = byEmail.get(user.email.toLowerCase());
    if (!account) return { action: "create", user };
    const marked = account.app_metadata?.[SEED_MARKER] === true;
    return { action: marked ? "update" : "refuse", user, id: account.id };
  });
}

/**
 * Every account of the project. listUsers returns one page at a time; its nextPage reads only the first
 * digit of the page number, so this counts pages itself and stops at the first empty one.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} client a client with the secret key
 * @returns {Promise<import("@supabase/supabase-js").User[]>}
 */
export async function listAllUsers(client) {
  const perPage = 1000;
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Could not list the project's users: ${error.message}`);
    if (data.users.length === 0) return users;
    users.push(...data.users);
  }
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {DemoUser} user
 * @param {string} password
 * @returns {Promise<string>} the new account's id
 */
async function createAccount(client, user, password) {
  const { data, error } = await client.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    app_metadata: { [SEED_MARKER]: true },
    user_metadata: { full_name: user.fullName },
  });
  if (error || !data.user) throw new Error(`Could not create ${user.email}: ${error?.message ?? "no user returned"}`);
  return data.user.id;
}

/**
 * Gives an account this seed made earlier the current demo password and name.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} id
 * @param {DemoUser} user
 * @param {string} password
 * @returns {Promise<string>} the account's id
 */
async function updateAccount(client, id, user, password) {
  const { error } = await client.auth.admin.updateUserById(id, {
    password,
    user_metadata: { full_name: user.fullName },
  });
  if (error) throw new Error(`Could not update ${user.email}: ${error.message}`);
  return id;
}

/**
 * Sets the role and name on the profile. The secret key bypasses row-level security; users themselves
 * can never change a profile (supabase/migrations/20261022120000_profiles_and_roles.sql).
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} id
 * @param {DemoUser} user
 */
async function setProfile(client, id, user) {
  const { data, error } = await client
    .from("profiles")
    .update({ role: user.role, full_name: user.fullName })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`Could not set the profile of ${user.email}: ${error.message}`);
  if (data.length !== 1) {
    throw new Error(`${user.email} has no profile. Is the profiles migration applied to this project?`);
  }
}

/**
 * Creates or updates every demo user, then sets its profile. Refuses before changing anything when an
 * account with a demo e-mail was not made by this seed.
 *
 * @param {{ client: import("@supabase/supabase-js").SupabaseClient, password: string, emailPrefix?: string, onResult?: (result: SeedResult) => void }} options
 * @returns {Promise<SeedResult[]>}
 */
export async function seed({ client, password, emailPrefix = "", onResult = () => {} }) {
  const plan = planSeed(demoUsers(emailPrefix), await listAllUsers(client));
  const refused = plan.filter((step) => step.action === "refuse").map((step) => step.user.email);
  if (refused.length > 0) {
    throw new Error(
      `Already registered, but not by this seed: ${refused.join(", ")}. Nothing was changed. ` +
        "The seed never takes over an account it did not create; delete that account (Supabase dashboard > " +
        "Authentication > Users) after checking who made it, then run the seed again.",
    );
  }

  const results = [];
  for (const step of plan) {
    const id =
      step.action === "create"
        ? await createAccount(client, step.user, password)
        : await updateAccount(client, step.id, step.user, password);
    await setProfile(client, id, step.user);
    const result = { ...step.user, id, status: step.action === "create" ? "created" : "updated" };
    results.push(result);
    onResult(result);
  }
  return results;
}

async function main() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const target = seedTarget(process.argv[2], process.env);
  const client = createClient(target.url, target.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  console.log(`Seeding the demo users into the ${target.name} project ...`);
  const results = await seed({
    client,
    password: target.password,
    onResult: ({ status, role, email, fullName }) =>
      console.log(`  ${status.padEnd(8)} ${role.padEnd(9)} ${email.padEnd(30)} ${fullName}`),
  });
  const created = results.filter((result) => result.status === "created").length;
  console.log(
    `Done: ${created} created, ${results.length - created} updated. ` +
      `Every demo user signs in with ${target.passwordVariable} from .env.`,
  );
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
