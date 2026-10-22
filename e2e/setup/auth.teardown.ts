import { expect, test as teardown } from "@playwright/test";
import { rmSync } from "node:fs";
import { adminClient } from "../../tests/integration/test-project";
import { authFiles, readTestUsers, writeTestUsers, type TestUserRecord } from "./auth-state";

// Runs after the suite (the "teardown" project in playwright.config.ts). Playwright runs it once the setup
// and every project that depends on it have finished, also when some of them failed. It deletes exactly
// the users the setup recorded, by id (the test project is shared: nothing else is touched), then the
// saved sessions.

teardown("deletes the test users the setup created", async () => {
  const admin = adminClient();
  const users = readTestUsers();

  const notDeleted: TestUserRecord[] = [];
  const reasons: string[] = [];
  for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    // 404: the user is already gone (deleted by an earlier teardown that stopped halfway).
    if (error && error.status !== 404) {
      notDeleted.push(user);
      reasons.push(`${user.role} ${user.id}: ${error.message}`);
    }
  }
  if (notDeleted.length > 0) {
    // They stay on the list, so the next run's teardown tries again.
    writeTestUsers(notDeleted);
    throw new Error(`Could not delete these test users:\n${reasons.join("\n")}`);
  }

  for (const user of users) {
    const { error } = await admin.auth.admin.getUserById(user.id);
    expect(error?.status, `the ${user.role} test user ${user.id} is deleted`).toBe(404);
    console.log(`Deleted the ${user.role} test user ${user.id}`);
  }
  for (const file of authFiles()) rmSync(file, { force: true });
});
