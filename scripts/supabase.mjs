// Supabase project chores through the Management API, so nobody has to click through the dashboard
// and no database password is needed: `npm run supabase -- <command> [live|test]`.
//
//   orgs                   list the organizations the access token can see (slug and name)
//   projects               list the projects (ref, name, region, status)
//   create-test-project    create the separate test project (markdown/SPEC.md "Testing Strategy"),
//                          wait until it is up, and write its URL and keys into .env
//   adopt-test-project     the same for a test project made by hand in the dashboard ("homeklin-test")
//   keys <live|test>       write the project's secret key into .env (SUPABASE_SECRET_KEY / TEST_...)
//   autoconfirm <live|test> switch off email confirmation: sign-up signs the user in at once
//                          (Supabase's built-in email reaches only the project team, 2 per hour)
//   migrate <live|test>    apply the files in supabase/migrations that the project has not had yet
//   ethereal               create a throw-away Ethereal SMTP account (mail is accepted, never
//                          delivered) and write it into .env as ETHEREAL_SMTP_USER / _PASS
//   smtp <live|test>       send the project's auth emails (the 6-digit sign-in codes, T9b) through
//                          Gmail (live: SMTP_USER, SMTP_PASS, optional SMTP_HOST, EMAIL_FROM) or Ethereal (test),
//                          with the code template in Indonesian and English
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

// The email with the sign-in code (T9b). Supabase fills in {{ .Token }}. Both languages in one email,
// because the code is asked for before the customer has an account with a language.
const codeSubject = "Kode masuk HomeKlin / HomeKlin sign-in code";
const codeTemplate = `<p>Kode masuk HomeKlin Anda:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Ketik kode ini di halaman HomeKlin. Kode berlaku 10 menit. Jika Anda tidak meminta kode ini, abaikan email ini.</p>
<hr>
<p>Your HomeKlin sign-in code is <strong>{{ .Token }}</strong>. Type it on the HomeKlin page. It is valid for 10 minutes. If you did not ask for it, ignore this email.</p>`;

/** "Name <address>" or a bare address -> { name, address }. */
function parseSender(from) {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from ?? "");
  return match ? { name: match[1] || "HomeKlin", address: match[2] } : { name: "HomeKlin", address: (from ?? "").trim() };
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
    // The project record names its organization; the organizations endpoint can be empty for a token
    // without organization rights.
    const org = { slug: live.organization_slug ?? live.organization_id };
    if (!org.slug) fail("Could not tell which organization owns the live project.");

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

  // For a token that may not create projects: the test project was made in the dashboard with the
  // name "homeklin-test"; this finds it and writes its URL and keys into .env.
  async "adopt-test-project"() {
    const test = (await api("GET", "/projects")).find((project) => project.name === "homeklin-test");
    if (!test) fail('No project named "homeklin-test" is visible to this token.');
    const ref = test.ref ?? test.id;
    await waitUntilHealthy(ref);
    const { publishable, secret } = await apiKeys(ref);
    writeEnv({
      TEST_SUPABASE_URL: `https://${ref}.supabase.co`,
      TEST_SUPABASE_PUBLISHABLE_KEY: publishable,
      TEST_SUPABASE_SECRET_KEY: secret,
    });
    console.log(`Test project ${ref} adopted (${test.region}).`);
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

  async ethereal() {
    if (process.env.ETHEREAL_SMTP_USER) fail("ETHEREAL_SMTP_USER is already set in .env.");
    // Ethereal (by the Nodemailer project): a fake SMTP service for tests; nothing is ever delivered.
    // Source: https://ethereal.email (the account API Nodemailer's createTestAccount uses).
    const response = await fetch("https://api.nodemailer.com/user", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestor: "homeklin-tests", version: "1.0.0" }),
    });
    if (!response.ok) fail(`Ethereal answered ${response.status}.`);
    const account = await response.json();
    if (!account.user || !account.pass) fail("Ethereal returned no account.");
    writeEnv({ ETHEREAL_SMTP_USER: account.user, ETHEREAL_SMTP_PASS: account.pass });
  },

  async smtp(argument) {
    const which = target(argument);
    const ref = projectRef(which);
    const settings =
      which === "live"
        ? {
            // Gmail by default: SMTP_USER is the Gmail address, SMTP_PASS an app password.
            host: process.env.SMTP_HOST ?? "smtp.gmail.com",
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
            sender: parseSender(process.env.EMAIL_FROM ?? `HomeKlin <${process.env.SMTP_USER ?? ""}>`),
          }
        : {
            host: "smtp.ethereal.email",
            user: process.env.ETHEREAL_SMTP_USER,
            pass: process.env.ETHEREAL_SMTP_PASS,
            sender: { name: "HomeKlin (test)", address: process.env.ETHEREAL_SMTP_USER },
          };
    const missing = which === "live" ? ["SMTP_USER", "SMTP_PASS"] : ["ETHEREAL_SMTP_USER", "ETHEREAL_SMTP_PASS"];
    if (!settings.user || !settings.pass || !settings.sender.address) {
      fail(`Missing in .env: ${missing.filter((name) => !process.env[name]).join(", ") || "a sender address"}.`);
    }

    await api("PATCH", `/projects/${ref}/config/auth`, {
      smtp_host: settings.host,
      smtp_port: "587",
      smtp_user: settings.user,
      smtp_pass: settings.pass,
      smtp_admin_email: settings.sender.address,
      smtp_sender_name: settings.sender.name,
      // Live: at most one email per address per minute and 30 per hour. Test: the e2e suite asks for
      // several codes per run (and codes to one address back to back), and Ethereal delivers nothing.
      smtp_max_frequency: which === "live" ? 60 : 1,
      rate_limit_email_sent: which === "live" ? 30 : 300,
      // A 6-digit code, valid for 10 minutes.
      mailer_otp_length: 6,
      mailer_otp_exp: 600,
      // A new customer gets the confirmation email, a returning one the magic-link email: both carry the code.
      mailer_subjects_magic_link: codeSubject,
      mailer_templates_magic_link_content: codeTemplate,
      mailer_subjects_confirmation: codeSubject,
      mailer_templates_confirmation_content: codeTemplate,
    });
    const config = await api("GET", `/projects/${ref}/config/auth`);
    console.log(
      `The ${which} project sends its auth emails through ${config.smtp_host} as ${config.smtp_sender_name}; ` +
        `codes have ${config.mailer_otp_length} digits and last ${config.mailer_otp_exp} s; ` +
        `at most ${config.rate_limit_email_sent} emails per hour.`,
    );
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
