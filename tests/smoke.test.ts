import { describe, expect, it } from "vitest";
import { appName } from "@/lib/app-name";

describe("appName", () => {
  it("returns the product name", () => {
    expect(appName()).toBe("HomeKlin");
  });
});
