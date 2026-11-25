import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The customer pages' language switch sits in the top app bar, as on the cleaner app (UX audit,
// 2026-11-18, item 3): from 16 Nov it floated at the bottom-left of every customer page and covered
// content (the live card's "Lihat pesanan", the payment step). Merged on 2026-11-20 with the focused
// booking layout, whose steps have no bar and keep the floating switch. The behaviour is in
// e2e/language-customer-bar.spec.ts; this keeps the wiring from drifting back.
const read = (path: string) => readFileSync(path, "utf8");

describe("customer language switch", () => {
  it("is in the app bar for the customer and the cleaner alike", () => {
    const header = read("src/components/shell/app-header.tsx");
    expect(header).toContain("<LanguageSwitch palette={palette} />");
    expect(header).not.toContain('nav === "customer" ? null : <LanguageSwitch');
  });

  it("does not float in the customer app; only the booking flow, which has no bar, keeps it floating", () => {
    const app = read("src/app/[locale]/(customer)/(app)/layout.tsx");
    expect(app).not.toContain("FloatingLanguageSwitch");
    expect(app).not.toContain("floatingControl");
    expect(read("src/app/[locale]/(customer)/layout.tsx")).not.toContain("<FloatingLanguageSwitch");
    expect(read("src/app/[locale]/(customer)/(booking)/layout.tsx")).toContain('<FloatingLanguageSwitch place="flow" />');
  });
});
