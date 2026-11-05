import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { canReview, formatAverage } from "@/components/reviews/rating";
import en from "@/messages/en.json";
import id from "@/messages/id.json";

// Ratings on the customer pages (T30): which orders can be reviewed, and how an average reads.

const t = {
  id: createTranslator({ locale: "id", messages: id, namespace: "Reviews" }),
  en: createTranslator({ locale: "en", messages: en, namespace: "Reviews" }),
};

describe("canReview", () => {
  it("offers a review only on a paid job that is finished", () => {
    expect(canReview({ status: "paid", completedAt: "2026-11-03T04:00:00Z" })).toBe(true);
    expect(canReview({ status: "paid", completedAt: null })).toBe(false);
    expect(canReview({ status: "pending_payment", completedAt: null })).toBe(false);
    expect(canReview({ status: "cancelled", completedAt: "2026-11-03T04:00:00Z" })).toBe(false);
  });
});

describe("formatAverage", () => {
  // Both languages use Indonesian number conventions (src/lib/format.ts), as the prices do.
  it("writes the average with one decimal comma, in either language", () => {
    expect(formatAverage(4.5, "id")).toBe("4,5");
    expect(formatAverage(4.5, "en")).toBe("4,5");
    expect(formatAverage(4, "id")).toBe("4,0");
  });
});

describe("the review messages", () => {
  it("say the rating in words, so a star is never the only sign", () => {
    expect(t.id("summary.label", { average: "4,5", count: 2 })).toBe("Nilai 4,5 dari 5, 2 ulasan");
    expect(t.en("summary.label", { average: "4,5", count: 1 })).toBe("Rated 4,5 out of 5, 1 review");
    expect(t.id("stars", { count: 3 })).toBe("3 dari 5 bintang");
    expect(t.en("stars", { count: 1 })).toBe("1 out of 5 stars");
  });
});
