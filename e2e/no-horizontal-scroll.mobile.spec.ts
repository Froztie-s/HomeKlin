import { expect, test } from "@playwright/test";
import { signedInAs, signedOut } from "./setup/auth-state";

// markdown/PRODUCT.md: usable from 360 px wide with no horizontal scroll. Checked on every page that
// exists, in Indonesian and in English (English runs up to 30% longer, markdown/design.md).
// Public pages are checked as a visitor; every other page by a signed-in user with the role it belongs
// to (T5, src/lib/auth/roles.ts).
test.use({ viewport: { width: 360, height: 740 } });

const pageGroups = [
  { who: "a visitor", session: signedOut, paths: ["/", "/home", "/services", "/support", "/login", "/pesan"] },
  { who: "a customer", session: signedInAs.customer, paths: ["/orders", "/account", "/pesan"] },
  { who: "a cleaner", session: signedInAs.cleaner, paths: ["/cleaner", "/cleaner/account"] },
  {
    who: "an agency",
    session: signedInAs.agency,
    paths: ["/agency", "/agency/schedule", "/agency/cleaners", "/agency/orders", "/agency/recordings"],
  },
  {
    who: "an admin",
    session: signedInAs.admin,
    paths: [
      "/admin",
      "/admin/monitor",
      "/admin/tickets",
      "/admin/recordings",
      "/admin/services",
      "/admin/services/new",
      "/admin/services/edit?id=regular",
      "/admin/faq",
    ],
  },
];

for (const { who, session, paths: indonesianPages } of pageGroups) {
  test.describe(`as ${who}`, () => {
    test.use(session);

    const pages = [...indonesianPages, ...indonesianPages.map((path) => (path === "/" ? "/en" : `/en${path}`))];

    for (const path of pages) {
      test(`${path} has no horizontal scroll at 360 px`, async ({ page }) => {
        await page.goto(path);
        // A protected page's role check streams in after the shell (status 200) and redirects a wrong
        // role from there, so first wait until it has finished, then check this is still the address:
        // not redirected to the sign-in page or to another role's home.
        await expect(page.getByText(/^(Memuat…|Loading…)$/)).toHaveCount(0);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page).toHaveURL(path);
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
      });
    }
  });
}
