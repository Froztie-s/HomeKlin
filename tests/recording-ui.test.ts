import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { initialsOf, progressSteps } from "@/components/customer/job-progress";
import { recordingState, recordingTimeLeft, timeLeftMessage } from "@/components/customer/recording-time";
import type { CustomerOrder } from "@/lib/booking/orders";
import en from "@/messages/en.json";
import id from "@/messages/id.json";

// The replay on an order's details (T15): how long a recording is still kept ("6 hari 23 jam lagi"),
// which state the recording section shows, and the job's progress with the Petugas HomeKlin's
// initials when there is no photo. Pure rules; the pages render what these return.

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;
const now = Date.parse("2026-11-04T03:00:00Z");
const at = (offset: number) => new Date(now + offset).toISOString();

const countdown = {
  id: createTranslator({ locale: "id", messages: id, namespace: "Recording" }),
  en: createTranslator({ locale: "en", messages: en, namespace: "Recording" }),
};
const words = (offset: number, language: "id" | "en" = "id") => {
  const left = timeLeftMessage(recordingTimeLeft(at(offset), now));
  return countdown[language](left.key, left.values);
};

describe("recordingTimeLeft", () => {
  it("counts days and hours while more than a day is left", () => {
    expect(recordingTimeLeft(at(6 * day + 23 * hour + 30 * minute), now)).toEqual({ unit: "days", days: 6, hours: 23 });
    expect(recordingTimeLeft(at(day), now)).toEqual({ unit: "days", days: 1, hours: 0 });
  });

  it("counts hours and minutes on the last day, and minutes in the last hour", () => {
    expect(recordingTimeLeft(at(23 * hour + 5 * minute), now)).toEqual({ unit: "hours", hours: 23, minutes: 5 });
    expect(recordingTimeLeft(at(hour), now)).toEqual({ unit: "hours", hours: 1, minutes: 0 });
    expect(recordingTimeLeft(at(59 * minute), now)).toEqual({ unit: "minutes", minutes: 59 });
  });

  it("rounds a part-minute up, so the last seconds still read 1 minute", () => {
    expect(recordingTimeLeft(at(10_000), now)).toEqual({ unit: "minutes", minutes: 1 });
    expect(recordingTimeLeft(at(7 * day - 10_000), now)).toEqual({ unit: "days", days: 7, hours: 0 });
  });

  it("has ended at the moment of expiry and after it", () => {
    expect(recordingTimeLeft(at(0), now)).toEqual({ unit: "ended" });
    expect(recordingTimeLeft(at(-day), now)).toEqual({ unit: "ended" });
  });
});

describe("the countdown's words", () => {
  it("reads naturally in Indonesian, leaving out a zero part", () => {
    expect(words(6 * day + 23 * hour)).toBe("6 hari 23 jam lagi");
    expect(words(7 * day)).toBe("7 hari lagi");
    expect(words(2 * hour + 15 * minute)).toBe("2 jam 15 menit lagi");
    expect(words(3 * hour)).toBe("3 jam lagi");
    expect(words(45 * minute)).toBe("45 menit lagi");
    expect(words(-minute)).toBe("Masa simpan sudah berakhir");
  });

  it("reads naturally in English, with singulars", () => {
    expect(words(6 * day + 23 * hour, "en")).toBe("6 days 23 hours left");
    expect(words(day + hour, "en")).toBe("1 day 1 hour left");
    expect(words(7 * day, "en")).toBe("7 days left");
    expect(words(hour + minute, "en")).toBe("1 hour 1 minute left");
    expect(words(30 * minute, "en")).toBe("30 minutes left");
    expect(words(-minute, "en")).toBe("The 7 days are over");
  });
});

const order = (fields: Partial<CustomerOrder> = {}): CustomerOrder => ({
  id: "00000000-0000-4000-8000-000000000001",
  serviceId: "regular",
  areaId: "jakarta-pusat",
  startsAt: at(-3 * day),
  endsAt: at(-3 * day + 2 * hour),
  address: "Jl. Contoh No. 1, Jakarta",
  contactPhone: "+6281234567890",
  priceIdr: 150_000,
  status: "paid",
  createdAt: at(-5 * day),
  cleanerName: "Rina Wulandari",
  cleanerPhotoUrl: null,
  checkedInAt: at(-3 * day),
  completedAt: at(-3 * day + 2 * hour),
  recordingId: "00000000-0000-4000-8000-0000000000aa",
  recordingExpiresAt: at(4 * day),
  recordingDeleted: false,
  ...fields,
});

describe("recordingState", () => {
  it("shows nothing until the job is done", () => {
    expect(recordingState(order({ completedAt: null }), now)).toBe("none");
    expect(recordingState(order({ status: "cancelled" }), now)).toBe("none");
  });

  it("offers a recording that is still kept", () => {
    expect(recordingState(order(), now)).toBe("available");
  });

  it("says a finished job without a recording has none", () => {
    expect(recordingState(order({ recordingId: null, recordingExpiresAt: null }), now)).toBe("unavailable");
  });

  it("says the recording was deleted once its date has passed or the cleanup removed it", () => {
    expect(recordingState(order({ recordingExpiresAt: at(-minute) }), now)).toBe("expired");
    expect(recordingState(order({ recordingExpiresAt: at(0) }), now)).toBe("expired");
    expect(recordingState(order({ recordingDeleted: true }), now)).toBe("expired");
    expect(recordingState(order({ recordingExpiresAt: null }), now)).toBe("expired");
  });
});

describe("progressSteps", () => {
  const states = (fields: Partial<CustomerOrder>) => progressSteps(order(fields)).map((step) => step.state);

  it("waits for a cleaner first", () => {
    expect(states({ cleanerName: null, checkedInAt: null, completedAt: null })).toEqual(["current", "upcoming", "upcoming"]);
  });

  it("then has a cleaner assigned, the check-in next", () => {
    expect(states({ checkedInAt: null, completedAt: null })).toEqual(["done", "upcoming", "upcoming"]);
  });

  it("is in progress after the check-in", () => {
    expect(states({ completedAt: null })).toEqual(["done", "done", "current"]);
  });

  it("is done after the check-out, with the times of both", () => {
    const steps = progressSteps(order());
    expect(steps.map((step) => step.state)).toEqual(["done", "done", "done"]);
    expect(steps.map((step) => step.at)).toEqual([null, at(-3 * day), at(-3 * day + 2 * hour)]);
  });
});

describe("initialsOf", () => {
  it("takes the first letters of the first two names", () => {
    expect(initialsOf("Rina Wulandari")).toBe("RW");
    expect(initialsOf("siti nur aisyah")).toBe("SN");
  });

  it("takes one letter of a single name and ignores extra spaces", () => {
    expect(initialsOf("  Ratna  ")).toBe("R");
  });
});
