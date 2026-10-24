import { describe, expect, it } from "vitest";
import { agencies, agencyAreas, seedAreas, seedServices, slotPattern } from "../scripts/seed-data.mjs";
import { serviceCategories } from "@/lib/catalog/catalog";
import { demoUsers, planSeed, SEED_MARKER, seedTarget, slotTimes } from "../scripts/seed.mjs";

// The demo users of the seed script (T6, scripts/seed.mjs) and the decisions it takes before it changes
// anything. The seed against a real project is tested in tests/integration/seed.test.ts.

describe("demo users", () => {
  const users = demoUsers();
  const withRole = (role: string) => users.filter((user) => user.role === role);

  it("has exactly one customer and one admin", () => {
    expect(withRole("customer")).toHaveLength(1);
    expect(withRole("admin")).toHaveLength(1);
  });

  it("has two partner agencies, each with one agency user named after the agency", () => {
    expect(agencies).toHaveLength(2);
    const agencyUsers = withRole("agency");

    expect(agencyUsers).toHaveLength(2);
    for (const agency of agencies) {
      const own = agencyUsers.filter((user) => user.agency === agency.key);
      expect(own).toHaveLength(1);
      expect(own[0]?.fullName).toBe(agency.name);
    }
  });

  it("has two cleaners per agency, four in all", () => {
    const cleaners = withRole("cleaner");

    expect(cleaners).toHaveLength(4);
    for (const agency of agencies) {
      expect(cleaners.filter((cleaner) => cleaner.agency === agency.key)).toHaveLength(2);
    }
  });

  it("ties only agency users and cleaners to an agency", () => {
    expect([...withRole("customer"), ...withRole("admin")].map((user) => user.agency)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it("gives every user a unique, lower-case e-mail on example.com", () => {
    const emails = users.map((user) => user.email);

    expect(new Set(emails).size).toBe(users.length);
    for (const email of emails) {
      expect(email).toMatch(/^[a-z0-9._-]+@example\.com$/);
    }
  });

  it("gives every user a name that fits the profile column (1 to 120 characters)", () => {
    for (const user of users) {
      expect(user.fullName.trim()).toBe(user.fullName);
      expect(user.fullName.length).toBeGreaterThan(0);
      expect(user.fullName.length).toBeLessThanOrEqual(120);
    }
  });

  it("gives agency names that are unique, so each agency user is easy to tell apart", () => {
    expect(new Set(agencies.map((agency) => agency.name)).size).toBe(agencies.length);
    expect(new Set(agencies.map((agency) => agency.key)).size).toBe(agencies.length);
  });

  it("puts a prefix in front of every e-mail, so a test run gets its own accounts", () => {
    const prefixed = demoUsers("t6-run1-");

    expect(prefixed.map((user) => user.email)).toEqual(users.map((user) => `t6-run1-${user.email}`));
    expect(prefixed.map((user) => [user.role, user.fullName])).toEqual(
      users.map((user) => [user.role, user.fullName]),
    );
  });

  it("refuses a prefix that would not give a valid lower-case e-mail", () => {
    expect(() => demoUsers("Run 1@")).toThrow("prefix");
  });
});

describe("planSeed", () => {
  const [customer, admin] = demoUsers();
  if (!customer || !admin) throw new Error("demoUsers() returned fewer than two users.");

  it("creates a demo user whose e-mail has no account yet", () => {
    const plan = planSeed([customer], [{ id: "other", email: "someone@example.com", app_metadata: {} }]);

    expect(plan).toEqual([{ action: "create", user: customer }]);
  });

  it("updates an account the seed created before (marked in app_metadata)", () => {
    const plan = planSeed([admin], [{ id: "u1", email: admin.email, app_metadata: { [SEED_MARKER]: true } }]);

    expect(plan).toEqual([{ action: "update", user: admin, id: "u1" }]);
  });

  it("refuses an account with a demo e-mail that the seed did not create", () => {
    const plan = planSeed([admin], [{ id: "u2", email: admin.email, app_metadata: { provider: "email" } }]);

    expect(plan).toEqual([{ action: "refuse", user: admin, id: "u2" }]);
  });

  it("refuses an account that carries the marker only in user_metadata, which users can set themselves", () => {
    const plan = planSeed(
      [admin],
      [{ id: "u3", email: admin.email, app_metadata: {}, user_metadata: { [SEED_MARKER]: true } }],
    );

    expect(plan).toEqual([{ action: "refuse", user: admin, id: "u3" }]);
  });

  it("refuses an account whose marker is anything but true", () => {
    const plan = planSeed([admin], [{ id: "u4", email: admin.email, app_metadata: { [SEED_MARKER]: "true" } }]);

    expect(plan).toEqual([{ action: "refuse", user: admin, id: "u4" }]);
  });

  it("finds an existing account whatever the case of its e-mail", () => {
    const plan = planSeed([admin], [{ id: "u5", email: admin.email.toUpperCase() }]);

    expect(plan).toEqual([{ action: "refuse", user: admin, id: "u5" }]);
  });

  it("ignores accounts without an e-mail (phone or anonymous sign-ins)", () => {
    const plan = planSeed([customer], [{ id: "u6", app_metadata: {} }]);

    expect(plan).toEqual([{ action: "create", user: customer }]);
  });
});

describe("seedTarget", () => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://live-ref.supabase.co",
    SUPABASE_SECRET_KEY: "live-secret-value",
    SEED_DEMO_PASSWORD: "live-password-value",
    TEST_SUPABASE_URL: "https://test-ref.supabase.co",
    TEST_SUPABASE_SECRET_KEY: "test-secret-value",
    TEST_SEED_DEMO_PASSWORD: "test-password-value",
  };

  it("reads the live project's URL, secret key and demo password", () => {
    expect(seedTarget("live", env)).toEqual({
      name: "live",
      url: "https://live-ref.supabase.co",
      secretKey: "live-secret-value",
      password: "live-password-value",
      passwordVariable: "SEED_DEMO_PASSWORD",
    });
  });

  it("reads the test project's URL, secret key and demo password", () => {
    expect(seedTarget("test", env)).toEqual({
      name: "test",
      url: "https://test-ref.supabase.co",
      secretKey: "test-secret-value",
      password: "test-password-value",
      passwordVariable: "TEST_SEED_DEMO_PASSWORD",
    });
  });

  it("refuses a missing or unknown target", () => {
    expect(() => seedTarget(undefined, env)).toThrow("npm run db:seed -- live");
    expect(() => seedTarget("production", env)).toThrow("npm run db:seed -- test");
  });

  it("names every missing variable", () => {
    const missing = { ...env, SUPABASE_SECRET_KEY: "", SEED_DEMO_PASSWORD: undefined };

    expect(() => seedTarget("live", missing)).toThrow("Missing in .env: SUPABASE_SECRET_KEY, SEED_DEMO_PASSWORD");
  });

  it("never shows a key or a password in its error", () => {
    const message = errorMessage(() => seedTarget("live", { ...env, SEED_DEMO_PASSWORD: "pendek" }));

    expect(message).toContain("SEED_DEMO_PASSWORD");
    expect(message).not.toContain("pendek");
    expect(message).not.toContain("live-secret-value");
  });

  it("refuses the test target when its URL is the live project's URL", () => {
    const sameProject = { ...env, TEST_SUPABASE_URL: "https://LIVE-ref.supabase.co/" };

    expect(() => seedTarget("test", sameProject)).toThrow("live project");
  });

  it("refuses a demo password the sign-in form would not accept", () => {
    const rule = "SEED_DEMO_PASSWORD must be 8 characters to 72 bytes long";

    expect(() => seedTarget("live", { ...env, SEED_DEMO_PASSWORD: "1234567" })).toThrow(rule);
    // 37 characters, but 74 bytes: Supabase Auth (bcrypt) reads only the first 72 bytes.
    expect(() => seedTarget("live", { ...env, SEED_DEMO_PASSWORD: "é".repeat(37) })).toThrow(rule);
    expect(seedTarget("live", { ...env, SEED_DEMO_PASSWORD: "a".repeat(72) }).password).toHaveLength(72);
  });
});

/** The message of the error that `run` throws; fails the test when nothing is thrown. */
function errorMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected an error, but nothing was thrown.");
}

// The catalog part of the seed (T7): HomeKlin's services and price list, the service areas, which
// areas each partner agency serves, and the agencies' arrival windows for the coming weeks.
describe("catalog seed data", () => {
  it("has at least 6 services, at least 2 of each service type, all with a price and a duration", () => {
    expect(seedServices.length).toBeGreaterThanOrEqual(6);
    for (const category of serviceCategories) {
      expect(seedServices.filter((service) => service.category === category).length, category).toBeGreaterThanOrEqual(2);
    }
    for (const service of seedServices) {
      expect(service.priceIdr, service.id).toBeGreaterThan(0);
      expect(Number.isInteger(service.priceIdr), service.id).toBe(true);
      expect(service.durationMinutes, service.id).toBeGreaterThanOrEqual(30);
    }
  });

  it("names and describes every service and area in Indonesian and English, within the column limits", () => {
    for (const { id, nameId, nameEn, descriptionId, descriptionEn } of seedServices) {
      for (const name of [nameId, nameEn]) expect(name.length, id).toBeGreaterThan(0);
      for (const name of [nameId, nameEn]) expect(name.length, id).toBeLessThanOrEqual(80);
      for (const text of [descriptionId, descriptionEn]) expect(text.length, id).toBeGreaterThan(0);
      for (const text of [descriptionId, descriptionEn]) expect(text.length, id).toBeLessThanOrEqual(300);
    }
    for (const { id, nameId, nameEn } of seedAreas) expect([nameId.length > 0, nameEn.length > 0], id).toEqual([true, true]);
  });

  it("uses no em or en dash in any text customers read", () => {
    const texts = [...seedServices.flatMap((s) => [s.nameId, s.nameEn, s.descriptionId, s.descriptionEn]), ...seedAreas.flatMap((a) => [a.nameId, a.nameEn])];
    for (const text of texts) expect(text, text).not.toMatch(/[\u2013\u2014]/);
  });

  it("has two agencies whose areas overlap, and one area nobody serves yet (the empty state)", () => {
    const [first, second] = agencies.map((agency) => agencyAreas[agency.key] ?? []);
    expect(first.filter((area) => second.includes(area)).length).toBeGreaterThan(0);
    const areaIds = seedAreas.map((area) => area.id);
    for (const area of [...first, ...second]) expect(areaIds).toContain(area);
    expect(areaIds.filter((area) => !first.includes(area) && !second.includes(area)).length).toBeGreaterThan(0);
  });
});

describe("slotTimes", () => {
  // Saturday 24 October 2026, 10.00 in Jakarta (UTC+7).
  const now = new Date("2026-10-24T03:00:00.000Z");
  const slots = slotTimes(now);

  it("starts tomorrow in Jakarta time and skips Sundays (Sunday 25 October is closed)", () => {
    expect(slots[0]).toEqual({ startsAt: "2026-10-26T01:00:00.000Z", endsAt: "2026-10-26T03:00:00.000Z" });
    for (const { startsAt } of slots) {
      const jakarta = new Date(new Date(startsAt).getTime() + 7 * 3_600_000);
      expect(jakarta.getUTCDay(), startsAt).not.toBe(0);
    }
  });

  it("gives the four arrival windows of each open day over three weeks, all in the future and unique", () => {
    // 25 October to 14 November: 21 days, of which three are Sundays.
    expect(slots).toHaveLength(18 * slotPattern.windows.length);
    expect(slots.slice(0, 4).map(({ startsAt }) => startsAt)).toEqual([
      "2026-10-26T01:00:00.000Z",
      "2026-10-26T03:00:00.000Z",
      "2026-10-26T06:00:00.000Z",
      "2026-10-26T08:00:00.000Z",
    ]);
    expect(new Set(slots.map(({ startsAt }) => startsAt)).size).toBe(slots.length);
    for (const { startsAt, endsAt } of slots) {
      expect(new Date(startsAt).getTime()).toBeGreaterThan(now.getTime());
      expect(new Date(endsAt).getTime()).toBeGreaterThan(new Date(startsAt).getTime());
    }
  });

  it("uses the same Jakarta day whatever the time of day in UTC", () => {
    // 23.30 on Saturday in Jakarta is still Saturday there, though it is 16.30 UTC.
    expect(slotTimes(new Date("2026-10-24T16:30:00.000Z"))[0]?.startsAt).toBe("2026-10-26T01:00:00.000Z");
  });
});
