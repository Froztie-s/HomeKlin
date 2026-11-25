import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The customer pages' language switch (merged 2026-11-20): the booking flow's layout holds the floating
// one (no bar there); the customer app shows it in its top bar (UX audit item 3), not floating. Its
// floating place respects the phone's safe-area insets. The
// behaviour is in e2e/language-floating.spec.ts and e2e/booking-flow.spec.ts; this keeps the wiring
// from drifting.
const read = (path: string) => readFileSync(path, "utf8");
/** One `@utility` rule of globals.css, up to the next top-level at-rule. */
const utility = (css: string, name: string) => {
  const start = css.indexOf(`@utility ${name} {`);
  const end = css.indexOf("\n@", start + 1);
  return css.slice(start, end);
};

describe("floating language switch", () => {
  it("is not floating in the customer app, whose top bar holds the switch", () => {
    const layout = read("src/app/[locale]/(customer)/(app)/layout.tsx");
    expect(layout).not.toContain("FloatingLanguageSwitch");
    expect(layout).not.toContain("floatingControl");
  });

  it("is rendered by the booking flow's layout in its own place, with no app navigation there", () => {
    const layout = read("src/app/[locale]/(customer)/(booking)/layout.tsx");
    expect(layout).toContain('<FloatingLanguageSwitch place="flow" />');
    expect(layout).toContain("<BookingShell>");
    expect(layout).not.toContain("MobileShell");
    const shell = read("src/components/shell/booking-shell.tsx");
    expect(shell).toContain("pb-clear-switch");
  });

  it("is in the app bar for the customer as for the cleaner", () => {
    const header = read("src/components/shell/app-header.tsx");
    expect(header).toContain("<LanguageSwitch");
    expect(header).not.toContain('nav === "customer" ? null : <LanguageSwitch');
  });

  it("is placed with the safe-area insets and above the phone's bottom bar", () => {
    const css = read("src/app/globals.css");
    const corner = utility(css, "float-corner");
    expect(corner).toContain("env(safe-area-inset-left)");
    expect(corner).toContain("env(safe-area-inset-bottom)");
    expect(corner).toContain("var(--spacing-bottom-nav)");
  });

  it("sits in the booking flow above the phone's booking bar, not above a bottom bar that is not there", () => {
    const css = read("src/app/globals.css");
    const rule = utility(css, "float-corner-flow");
    expect(rule).toContain("var(--booking-bar-height, env(safe-area-inset-bottom))");
    expect(rule).toContain("env(safe-area-inset-bottom)");
    expect(rule).not.toContain("--spacing-bottom-nav");
  });
});
