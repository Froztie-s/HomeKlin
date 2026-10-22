import { expect, test } from "@playwright/test";

// One brand to the customer (markdown/PRODUCT.md principle 6): customer pages never name or hint at a
// partner agency, in Indonesian or in English. Checked in what people read, what screen readers
// announce, and the raw HTML (which includes the messages sent to the browser).
const indonesianPages = ["/", "/home", "/services", "/orders", "/support", "/account"];
const englishPages = ["/en", "/en/home", "/en/services", "/en/orders", "/en/support", "/en/account"];
const agencyWording = /agensi|agency|mitra|partner/i;

for (const path of [...indonesianPages, ...englishPages]) {
  test(`${path} never mentions a partner agency`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

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
