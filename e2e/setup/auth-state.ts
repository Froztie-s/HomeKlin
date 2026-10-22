import type { BrowserContextOptions } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
// A type only: the app's role module imports next-intl, which Node cannot load outside Next.js.
import type { AppRole } from "@/lib/auth/roles";

// Signed-in browsers for the end-to-end suite (T5). The setup project (auth.setup.ts) signs in one test
// user per role and saves each session as a Playwright storage state; the teardown project
// (auth.teardown.ts) deletes those users. No project signs in by default: a spec opts in per file or per
// describe block with test.use(signedInAs.customer), and every other spec runs as a signed-out visitor.
// The folder is git-ignored, because the files hold session tokens.
// Sources: https://playwright.dev/docs/auth ("Multiple signed in roles") and
// https://playwright.dev/docs/test-global-setup-teardown ("Option 1: Project Dependencies")

export type StorageState = Exclude<BrowserContextOptions["storageState"], string | undefined>;

export const authDir = path.join(__dirname, "..", ".auth");

function stateFile(role: AppRole): string {
  return path.join(authDir, `${role}.json`);
}

/** test.use() options that open every page as a signed-in user with that role. */
export const signedInAs = {
  customer: { storageState: stateFile("customer") },
  cleaner: { storageState: stateFile("cleaner") },
  agency: { storageState: stateFile("agency") },
  admin: { storageState: stateFile("admin") },
} as const satisfies Record<AppRole, { storageState: string }>;

/**
 * test.use() options for a visitor who is not signed in. The same as using no storage state at all;
 * it makes a group of public pages read as deliberately signed out next to the signed-in groups.
 */
export const signedOut: { storageState: StorageState } = { storageState: { cookies: [], origins: [] } };

/** A user the setup created in the test project. */
export type TestUserRecord = { role: string; id: string };

const usersFile = path.join(authDir, "users.json");

/** The users the setup created that no teardown has deleted yet; none when the file is absent. */
export function readTestUsers(): TestUserRecord[] {
  if (!existsSync(usersFile)) return [];
  return JSON.parse(readFileSync(usersFile, "utf8")) as TestUserRecord[];
}

export function writeTestUsers(users: readonly TestUserRecord[]): void {
  writeFileSync(usersFile, `${JSON.stringify(users, null, 2)}\n`);
}

/** Every file the setup writes: one storage state per role and the list of users. */
export function authFiles(): string[] {
  return [...Object.values(signedInAs).map(({ storageState }) => storageState), usersFile];
}
