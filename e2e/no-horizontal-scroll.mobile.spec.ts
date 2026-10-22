import { expect, test } from "@playwright/test";
import { signedInAs, signedOut } from "./setup/auth-state";

// markdown/PRODUCT.md: usable from 360 px wide with no horizontal scroll. Checked on every page that
// exists, in Indonesian and in English (English runs up to 30% longer, markdown/design.md).
// Public pages are checked as a visitor; every other page by a signed-in user with the role it belongs
// to (T5, src/lib/auth/roles.ts).
test.use({ viewport: { width: 360, height: 740 } });

const pageGroups = [
  { who: "a visitor", session: signedOut, paths: ["/", "/home", "/services", "/support"] },
  { who: "a customer", session: signedInAs.customer, paths: ["/orders", "/account"] },
  { who: "a cleaner", session: signedInAs.cleaner, paths: ["/cleaner", "/cleaner/account"] },
  {
    who: "an agency",
    session: signedInAs.agency,
    paths: ["/agency", "/agency/schedule", "/agency/cleaners", "/agency/orders", "/agency/recordings"],
  },
  {
    who: "an admin",
    session: signedInAs.admin,
    paths: ["/admin", "/admin/monitor", "/admin/tickets", "/admin/recordings", "/admin/services", "/admin/faq"],
  },
];

for (const { who, session, paths: indonesianPages } of pageGroups) {
  test.describe(`as ${who}`, () => {
    test.use(session);

    const pages = [...indonesianPages, ...indonesianPages.map((path) => (path === "/" ? "/en" : `/en${path}`))];

    for (const path of pages) {
      test(`${path} has no horizontal scroll at 360 px`, async ({ page }) => {
        await page.goto(path);
        // Still at this address: not redirected to the sign-in page or to another role's home.
        await expect(page).toHaveURL(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
      });
    }
  });
}
