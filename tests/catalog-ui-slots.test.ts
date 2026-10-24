import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { formatJakartaDay, formatJakartaTime, groupSlotsByJakartaDay } from "@/lib/catalog/slots-days";
import en from "@/messages/en.json";
import id from "@/messages/id.json";

// The free arrival windows on /services (T8), grouped by their day in Jakarta and written in Jakarta
// time (WIB, UTC+7, no daylight saving), whatever time zone the server or the browser runs in.
// The catalog gives the windows as ISO times in UTC: 08.00 WIB is 01:00Z.

const window = (startsAt: string, endsAt: string) => ({ startsAt, endsAt });

describe("groupSlotsByJakartaDay", () => {
  const now = new Date("2026-10-26T02:00:00.000Z"); // Monday 26 October, 09.00 in Jakarta

  it("groups windows by their day in Jakarta, not by their day in UTC", () => {
    const lateMonday = window("2026-10-26T16:00:00.000Z", "2026-10-26T16:30:00.000Z"); // 23.00 WIB, Monday
    const earlyTuesday = window("2026-10-26T17:00:00.000Z", "2026-10-26T18:00:00.000Z"); // 00.00 WIB, Tuesday
    const days = groupSlotsByJakartaDay([lateMonday, earlyTuesday], now);
    expect(days.map((day) => day.date)).toEqual(["2026-10-26", "2026-10-27"]);
    expect(days[0].windows).toEqual([lateMonday]);
    expect(days[1].windows).toEqual([earlyTuesday]);
  });

  it("marks today and tomorrow as Jakarta sees them, and no other day", () => {
    const days = groupSlotsByJakartaDay(
      [
        window("2026-10-26T06:00:00.000Z", "2026-10-26T08:00:00.000Z"), // Monday 13.00
        window("2026-10-27T01:00:00.000Z", "2026-10-27T03:00:00.000Z"), // Tuesday 08.00
        window("2026-10-28T01:00:00.000Z", "2026-10-28T03:00:00.000Z"), // Wednesday 08.00
      ],
      now,
    );
    expect(days.map((day) => day.relative)).toEqual(["today", "tomorrow", null]);
  });

  it("counts today from the Jakarta date, which runs seven hours ahead of UTC", () => {
    // 18:00Z on Monday is already 01.00 on Tuesday in Jakarta.
    const lateUtc = new Date("2026-10-26T18:00:00.000Z");
    const days = groupSlotsByJakartaDay([window("2026-10-27T01:00:00.000Z", "2026-10-27T03:00:00.000Z")], lateUtc);
    expect(days[0]).toMatchObject({ date: "2026-10-27", relative: "today" });
  });

  it("puts the days, and the windows inside each day, in time order", () => {
    const days = groupSlotsByJakartaDay(
      [
        window("2026-10-28T08:00:00.000Z", "2026-10-28T10:00:00.000Z"),
        window("2026-10-27T03:00:00.000Z", "2026-10-27T05:00:00.000Z"),
        window("2026-10-27T01:00:00.000Z", "2026-10-27T03:00:00.000Z"),
      ],
      now,
    );
    expect(days.map((day) => day.date)).toEqual(["2026-10-27", "2026-10-28"]);
    expect(days[0].windows.map((slot) => slot.startsAt)).toEqual([
      "2026-10-27T01:00:00.000Z",
      "2026-10-27T03:00:00.000Z",
    ]);
  });

  it("returns no days when no window is free", () => {
    expect(groupSlotsByJakartaDay([], now)).toEqual([]);
  });
});

describe("formatJakartaTime", () => {
  it("writes the time in Jakarta with the Indonesian dot, in both languages", () => {
    expect(formatJakartaTime("2026-10-27T01:00:00.000Z", "id")).toBe("08.00");
    expect(formatJakartaTime("2026-10-27T08:00:00.000Z", "en")).toBe("15.00");
  });

  it("uses the 24-hour clock, so midnight is 00.00", () => {
    expect(formatJakartaTime("2026-10-26T17:00:00.000Z", "id")).toBe("00.00");
    expect(formatJakartaTime("2026-10-26T17:00:00.000Z", "en")).toBe("00.00");
  });
});

describe("formatJakartaDay", () => {
  it("names the weekday and the date in each language, day before month", () => {
    expect(formatJakartaDay("2026-10-27", "id")).toEqual({ weekday: "Selasa", date: "27 Oktober" });
    expect(formatJakartaDay("2026-10-27", "en")).toEqual({ weekday: "Tuesday", date: "27 October" });
  });
});

describe("Jakarta time whatever the machine's time zone", () => {
  const original = process.env.TZ;
  afterEach(() => {
    process.env.TZ = original;
  });

  it("groups and writes the same in Los Angeles as in Jakarta", () => {
    process.env.TZ = "America/Los_Angeles";
    const slot = window("2026-10-26T17:00:00.000Z", "2026-10-26T19:00:00.000Z"); // Tuesday 00.00 WIB
    const days = groupSlotsByJakartaDay([slot], new Date("2026-10-26T02:00:00.000Z"));
    expect(days[0]).toMatchObject({ date: "2026-10-27", relative: "tomorrow" });
    expect(formatJakartaTime(slot.startsAt, "id")).toBe("00.00");
    expect(formatJakartaDay(days[0].date, "id")).toEqual({ weekday: "Selasa", date: "27 Oktober" });
  });
});

describe("the day and window labels (FreeWindows messages)", () => {
  const tId = createTranslator({ locale: "id", messages: id, namespace: "FreeWindows" });
  const tEn = createTranslator({ locale: "en", messages: en, namespace: "FreeWindows" });
  const day = { weekday: "Selasa", date: "27 Oktober" };
  const dayEn = { weekday: "Tuesday", date: "27 October" };

  it("puts today and tomorrow before the date", () => {
    expect(tId("today", day)).toBe("Hari ini, Selasa 27 Oktober");
    expect(tId("tomorrow", day)).toBe("Besok, Selasa 27 Oktober");
    expect(tId("day", day)).toBe("Selasa, 27 Oktober");
    expect(tEn("today", dayEn)).toBe("Today, Tuesday 27 October");
    expect(tEn("tomorrow", dayEn)).toBe("Tomorrow, Tuesday 27 October");
    expect(tEn("day", dayEn)).toBe("Tuesday, 27 October");
  });

  it("writes a window as its start and end with a plain hyphen", () => {
    expect(tId("window", { start: "08.00", end: "10.00" })).toBe("08.00-10.00");
    expect(tEn("window", { start: "08.00", end: "10.00" })).toBe("08.00-10.00");
  });
});
