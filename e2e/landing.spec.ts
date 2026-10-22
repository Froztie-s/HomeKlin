import { expect, test } from "@playwright/test";

// The landing page at / (markdown/SPEC.md "Landing page"): what HomeKlin is, services with sample prices,
// how it works, safety facts, a FAQ teaser and one primary action, "Pesan sekarang", into booking.
// Built on the redesign system in markdown/design.md (T3c).
const headline = "Jasa kebersihan rumah yang bisa Anda tonton langsung";

test.describe("landing page", () => {
  test("keeps the browser tab title as the product name", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("HomeKlin");
  });

  test("says what HomeKlin is and shows the order button in the first screen", async ({ page }) => {
    // Reduced motion finishes the entry animation at once, so the button sits in its final place.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline);

    const hero = page.getByRole("region", { name: headline });
    const cta = hero.getByRole("link", { name: "Pesan sekarang" });
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  });

  test("uses the redesign type: Inter Tight headline, Instrument Serif italic for the benefit words", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const heading = page.getByRole("heading", { level: 1 });
    const accent = heading.locator("em");
    await expect(accent).toHaveText("tonton langsung");

    const headingFont = await heading.evaluate((element) => getComputedStyle(element).fontFamily);
    const accentStyle = await accent.evaluate((element) => {
      const style = getComputedStyle(element);
      return { family: style.fontFamily, style: style.fontStyle };
    });
    expect(headingFont).toMatch(/Inter[ _]Tight/);
    expect(accentStyle.family).toMatch(/Instrument[ _]Serif/);
    expect(accentStyle.style).toBe("italic");
  });

  test("sits on the warm cream canvas", async ({ page }) => {
    await page.goto("/");
    const background = await page.locator("main").evaluate((element) => {
      // The first ancestor (or the element itself) that paints a background.
      for (let node: Element | null = element; node; node = node.parentElement) {
        const colour = getComputedStyle(node).backgroundColor;
        if (colour !== "rgba(0, 0, 0, 0)" && colour !== "transparent") return colour;
      }
      return "";
    });
    expect(background).toBe("rgb(243, 242, 234)");
  });

  test("sends every order button to the booking home", async ({ page }) => {
    await page.goto("/");
    const ctas = page.getByRole("link", { name: "Pesan sekarang" });
    expect(await ctas.count()).toBeGreaterThanOrEqual(3);
    for (const cta of await ctas.all()) {
      await expect(cta).toHaveAttribute("href", "/home");
    }
  });

  test("loads the hero photo", async ({ page }) => {
    await page.goto("/");
    const photo = page.getByRole("img", { name: "Petugas kebersihan mengelap meja dapur" });
    await expect(photo).toBeVisible();
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0)))
      .toBeGreaterThan(0);
  });

  test("shows a sample running job in the hero, labelled as a sample", async ({ page }) => {
    await page.goto("/");
    const job = page.getByRole("region", { name: headline }).getByRole("group", { name: "Contoh pesanan berjalan" });
    await expect(job).toBeVisible();
    await expect(job.getByText("Contoh", { exact: true })).toBeVisible();
    await expect(job.getByText("Sedang berlangsung")).toBeVisible();
    await expect(job.getByText("Petugas HomeKlin", { exact: true })).toBeVisible();
  });

  test("has its own header and no app navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toHaveCount(0);
    await expect(page.getByRole("banner").getByRole("link", { name: "HomeKlin" })).toHaveAttribute("href", "/");
  });

  test("gives every visible header and footer link a touch target of at least 44 px", async ({ page }) => {
    await page.goto("/");
    const links = page.getByRole("banner").getByRole("link").or(page.getByRole("contentinfo").getByRole("link"));
    const visible = await links.filter({ visible: true }).all();
    expect(visible.length).toBeGreaterThanOrEqual(6);
    for (const link of visible) {
      const box = await link.boundingBox();
      expect(box?.height, (await link.textContent()) ?? "").toBeGreaterThanOrEqual(44);
    }
  });

  test("states four safety facts in a row under the hero", async ({ page }) => {
    await page.goto("/");
    const facts = page.getByRole("region", { name: "Di setiap pesanan" }).getByRole("listitem");
    await expect(facts).toHaveCount(4);
    await expect(facts.nth(0)).toContainText("tim pemantau HomeKlin");
    await expect(facts.nth(1)).toContainText("check-in");
    await expect(facts.nth(2)).toContainText("7 hari");
    await expect(facts.nth(3)).toContainText("Persetujuan");
  });

  test("lists the four services with a starting price and marks the prices as samples", async ({ page }) => {
    await page.goto("/");
    const services = page.getByRole("region", { name: "Layanan dan harga, tanpa kejutan" });
    const items = services.getByRole("listitem");
    await expect(items).toHaveCount(4);
    for (const item of await items.all()) {
      await expect(item.getByRole("heading", { level: 3 })).toBeVisible();
      await expect(item).toContainText("mulai dari");
      await expect(item.getByText(/^Rp\s[\d.]+$/)).toBeVisible();
      await expect(item.getByRole("link")).toHaveAttribute("href", "/services");
    }
    await expect(services.getByText(/Harga contoh selama masa pratinjau/)).toBeVisible();
    await expect(services.getByRole("link", { name: "Lihat semua layanan" })).toHaveAttribute("href", "/services");
  });

  test("explains safety beside a photo, with the 7-day replay and the check-in", async ({ page }) => {
    await page.goto("/");
    const safety = page.getByRole("region", { name: "Rumah Anda tetap dalam pantauan Anda" });
    await expect(safety.getByRole("img")).toBeVisible();
    await expect(safety).toContainText("7 hari");
    await expect(safety).toContainText("check-in");
    await expect(safety).toContainText("persetujuan");
  });

  test("explains how it works in five steps, in order", async ({ page }) => {
    await page.goto("/");
    const steps = page.getByRole("region", { name: "Cara kerjanya" }).getByRole("listitem");
    await expect(steps.getByRole("heading", { level: 3 })).toHaveText([
      "Pesan",
      "Bayar",
      "Petugas check-in",
      "Tonton langsung",
      "Putar ulang 7 hari",
    ]);
  });

  test("answers four common questions and links to the full help page", async ({ page }) => {
    await page.goto("/");
    const faq = page.getByRole("region", { name: "Ada pertanyaan? Ini jawabannya." });
    const questions = faq.locator("details");
    await expect(questions).toHaveCount(4);

    const first = questions.first();
    await expect(first.getByText(/nama dan fotonya tampil/)).toBeHidden();
    await first.locator("summary").click();
    await expect(first.getByText(/nama dan fotonya tampil/)).toBeVisible();

    await expect(faq.getByRole("link", { name: "Lihat semua pertanyaan" })).toHaveAttribute("href", "/support");
  });

  test("ends with one call to action and a footer that says the data are samples", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("region", { name: "Pilih jadwal yang masih kosong di area Anda" });
    await expect(cta.getByRole("link", { name: "Pesan sekarang" })).toHaveAttribute("href", "/home");
    await expect(page.getByRole("contentinfo")).toContainText("Harga dan data di situs ini adalah contoh");
  });

  // Both languages (T4): English is checked with the same rules as the Indonesian default.
  for (const path of ["/", "/en"]) {
    test(`uses no em dash or en dash in visible text at ${path}`, async ({ page }) => {
      await page.goto(path);
      const text = await page.evaluate(() => document.body.innerText);
      expect(text.length).toBeGreaterThan(500);
      expect(text).not.toMatch(/[–—]/);
    });

    test(`has no dead links at ${path}`, async ({ page, request }) => {
      await page.goto(path);
      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
      expect(hrefs.length).toBeGreaterThan(10);

      for (const href of new Set(hrefs)) {
        if (href.startsWith("#")) {
          await expect(page.locator(`[id="${href.slice(1)}"]`), href).toHaveCount(1);
        } else {
          expect(href, "links stay inside the site").toMatch(/^\/(?!\/)/);
          // The language switch links to /id/..., which redirects to the plain address: follow it.
          const response = await request.get(href);
          expect(response.status(), href).toBe(200);
        }
      }
    });
  }
});
