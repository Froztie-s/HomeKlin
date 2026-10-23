import { expect, test } from "@playwright/test";
import { signedInAs, signedOut } from "./setup/auth-state";

// One brand to the customer (markdown/PRODUCT.md principle 6): customer pages never name or hint at a
// partner agency, in Indonesian or in English. Checked in what people read, what screen readers
// announce, and the raw HTML (which includes the messages sent to the browser).
// Public pages are checked as a visitor; Pesanan and Akun belong to a signed-in customer (T5).
const pageGroups = [
  {
    who: "a visitor",
    session: signedOut,
    paths: [
      "/",
      "/home",
      "/services",
      "/support",
      "/login",
      "/signup",
      "/en",
      "/en/home",
      "/en/services",
      "/en/support",
      "/en/login",
      "/en/signup",
    ],
  },
  {
    who: "a signed-in customer",
    session: signedInAs.customer,
    paths: ["/orders", "/account", "/en/orders", "/en/account"],
  },
];
const agencyWording = /agensi|agency|mitra|partner/i;

for (const { who, session, paths } of pageGroups) {
  test.describe(`as ${who}`, () => {
    test.use(session);

    for (const path of paths) {
      test(`${path} never mentions a partner agency`, async ({ page }) => {
        await page.goto(path);
        // A protected page's role check streams in after the shell (status 200) and redirects a wrong
        // role from there, so first wait until it has finished, then check this is still the address:
        // not redirected to the sign-in page or to another role's home.
        await expect(page.getByText(/^(Memuat…|Loading…)$/)).toHaveCount(0);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page).toHaveURL(path);

        const found = await page.evaluate(() => {
          const labelled = document.querySelectorAll("[alt], [aria-label], [title]");
          const attributes = [...labelled].flatMap((element) =>
            ["alt", "aria-label", "title"].map((name) => element.getAttribute(name) ?? ""),
          );
          return {
            text: document.body.innerText,
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
            attributes: attributes.join("\n"),
            lang: document.documentElement.lang,
          };
        });

        // Guard against a vacuous pass: there is real text, a title and a description to check, in the
        // language of the address.
        expect(found.text.length).toBeGreaterThan(50);
        expect(found.title).toContain("HomeKlin");
        expect(found.description).not.toBe("");
        expect(found.lang).toBe(path.startsWith("/en") ? "en" : "id");

        expect(found.text).not.toMatch(agencyWording);
        expect(found.title).not.toMatch(agencyWording);
        expect(found.description).not.toMatch(agencyWording);
        expect(found.attributes).not.toMatch(agencyWording);
        expect(await page.content()).not.toMatch(agencyWording);
      });
    }
  });
}
