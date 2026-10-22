// Supabase project chores through the Management API, so nobody has to click through the dashboard
// and no database password is needed: `npm run supabase -- <command> [live|test]`.
//
//   orgs                   list the organizations the access token can see (slug and name)
//   projects               list the projects (ref, name, region, status)
//   create-test-project    create the separate test project (markdown/SPEC.md "Testing Strategy"),
//                          wait until it is up, and write its URL and keys into .env
//   keys <live|test>       write the project's secret key into .env (SUPABASE_SECRET_KEY / TEST_...)
//   autoconfirm <live|test> switch off email confirmation: sign-up signs the user in at once
//                          (Supabase's built-in email reaches only the project team, 2 per hour)
//   migrate <live|test>    apply the files in supabase/migrations that the project has not had yet
//
// Needs SUPABASE_ACCESS_TOKEN in .env (a personal access token from
// https://supabase.com/dashboard/account/tokens). Secrets go into .env (git-ignored) and are never
// printed. API reference: https://supabase.com/docs/reference/api/introduction (the database query
// endpoint is marked beta there).

import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const apiBase = "https://api.supabase.com/v1";
const envFile = ".env";
const migrationsDir = "supabase/migrations";

if (existsSync(envFile)) process.loadEnvFile(envFile);

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) fail("SUPABASE_ACCESS_TOKEN is not set in .env (see the comment at the top of this file).");

async function api(method, path, body) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) fail(`${method} ${path} answered ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

/** Sets or replaces KEY=value lines in .env without touching the other lines. */
function writeEnv(values) {
  let lines = existsSync(envFile) ? readFileSync(envFile, "utf8").split(/\r?\n/) : [];
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const index = lines.findIndex((existing) => existing.startsWith(`${key}=`));
    if (index >= 0) lines[index] = line;
    else lines.splice(lines.at(-1) === "" ? lines.length - 1 : lines.length, 0, line);
  }
  if (lines.at(-1) !== "") lines.push("");
  writeFileSync(envFile, lines.join("\n"));
  console.log(`Wrote ${Object.keys(values).join(", ")} to ${envFile}.`);
}

/** The project ref from its URL: https://<ref>.supabase.co */
function projectRef(target) {
  const url = target === "test" ? process.env.TEST_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) fail(`No URL for the ${target} project in .env.`);
  const ref = new URL(url).hostname.split(".")[0];
  if (!/^[a-z0-9]{20}$/.test(ref)) fail(`Unexpected project URL for ${target}.`);
  return ref;
}

function target(argument) {
  if (argument !== "live" && argument !== "test") fail("Say which project: live or test.");
  return argument;
}

async function waitUntilHealthy(ref) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const project = await api("GET", `/projects/${ref}`);
    if (project.status === "ACTIVE_HEALTHY") return;
    console.log(`Waiting for the project to start (${project.status}) ...`);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  fail("The project did not become healthy within 10 minutes.");
}

async function apiKeys(ref) {
  const keys = await api("GET", `/projects/${ref}/api-keys?reveal=true`);
  const publishable = keys.find((key) => key.type === "publishable")?.api_key;
  const secret = keys.find((key) => key.type === "secret")?.api_key;
  if (!publishable || !secret) fail("The project has no publishable and secret API key yet.");
  return { publishable, secret };
}

async function query(ref, sql) {
  return api("POST", `/projects/${ref}/database/query`, { query: sql });
}

const commands = {
  async orgs() {
    for (const org of await api("GET", "/organizations")) console.log(`${org.slug}  ${org.name}`);
  },

  async projects() {
    for (const project of await api("GET", "/projects")) {
      console.log(`${project.ref ?? project.id}  ${project.name}  ${project.region}  ${project.status}`);
    }
  },

  async "create-test-project"() {
    if (process.env.TEST_SUPABASE_URL) fail("TEST_SUPABASE_URL is already set; the test project exists.");
    const live = (await api("GET", "/projects")).find((project) => (project.ref ?? project.id) === projectRef("live"));
    if (!live) fail("The live project was not found with this token.");
    const orgs = await api("GET", "/organizations");
    const org = orgs.find((candidate) => candidate.id === live.organization_id) ?? (orgs.length === 1 ? orgs[0] : null);
    if (!org) fail("Could not tell which organization owns the live project.");

    const dbPassword = randomBytes(24).toString("base64url");
    const created = await api("POST", "/projects", {
      name: "homeklin-test",
      organization_slug: org.slug,
      db_pass: dbPassword,
      region_selection: { type: "specific", code: live.region },
    });
    const ref = created.ref ?? created.id;
    writeEnv({ TEST_SUPABASE_DB_PASSWORD: dbPassword, TEST_SUPABASE_URL: `https://${ref}.supabase.co` });
    await waitUntilHealthy(ref);
    const { publishable, secret } = await apiKeys(ref);
    writeEnv({ TEST_SUPABASE_PUBLISHABLE_KEY: publishable, TEST_SUPABASE_SECRET_KEY: secret });
    console.log(`Test project ${ref} is ready in ${live.region}.`);
  },

  async keys(argument) {
    const which = target(argument);
    const { secret } = await apiKeys(projectRef(which));
    writeEnv({ [which === "test" ? "TEST_SUPABASE_SECRET_KEY" : "SUPABASE_SECRET_KEY"]: secret });
  },

  async autoconfirm(argument) {
    const ref = projectRef(target(argument));
    await api("PATCH", `/projects/${ref}/config/auth`, { mailer_autoconfirm: true });
    const config = await api("GET", `/projects/${ref}/config/auth`);
    console.log(`Email confirmation is ${config.mailer_autoconfirm ? "off (sign-up signs in at once)" : "still on"}.`);
  },

  async migrate(argument) {
    const ref = projectRef(target(argument));
    // The same bookkeeping table the Supabase CLI uses, so the CLI could take over later.
    await query(
      ref,
      `create schema if not exists supabase_migrations;
       create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`,
    );
    const applied = new Set(
      (await query(ref, "select version from supabase_migrations.schema_migrations")).map((row) => row.version),
    );
    const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
    let count = 0;
    for (const file of files) {
      const match = /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(file);
      if (!match) fail(`Migration file name must be <14-digit version>_<snake_case_name>.sql: ${file}`);
      const [, version, name] = match;
      if (applied.has(version)) continue;
      const sql = readFileSync(`${migrationsDir}/${file}`, "utf8");
      // One transaction per file: it applies completely and is recorded, or not at all. The version and
      // name are inlined only after the file-name check above (digits, lower-case letters, underscores).
      await query(
        ref,
        `begin;\n${sql}\ninsert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name}');\ncommit;`,
      );
      console.log(`Applied ${file}`);
      count += 1;
    }
    console.log(count ? `${count} migration(s) applied to the ${argument} project.` : `The ${argument} project is up to date.`);
  },
};

const [command, argument] = process.argv.slice(2);
if (!commands[command]) fail(`Unknown command. Use one of: ${Object.keys(commands).join(", ")}.`);
await commands[command](argument);
