import {
  getRedirectUrl,
  getRewrittenUrl,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import proxy, { config } from "@/proxy";

// The language routing in front of every page (src/proxy.ts, next-intl middleware).
// Decision (T4): every new visitor starts in Indonesian, whatever the browser prefers; a language the
// visitor picks is kept in the NEXT_LOCALE cookie for a year.
const origin = "http://localhost:3000";
const oneYear = 60 * 60 * 24 * 365;

type RequestOptions = { acceptLanguage?: string; cookie?: string; method?: string; body?: string };

// A page load, as a browser sends it (Sec-Fetch-Dest: document).
function pageRequest(path: string, { acceptLanguage, cookie, method, body }: RequestOptions = {}) {
  const headers = new Headers({ "sec-fetch-dest": "document" });
  if (acceptLanguage) headers.set("accept-language", acceptLanguage);
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(`${origin}${path}`, { headers, method, body });
}

describe("routing", () => {
  it("has Indonesian as the default and English as the second language, unprefixed for Indonesian", async () => {
    expect(routing.locales).toEqual(["id", "en"]);
    expect(routing.defaultLocale).toBe("id");
    expect(routing.localePrefix).toBe("as-needed");
  });
});

describe("proxy", () => {
  it("serves Indonesian to a new visitor whose browser prefers English, and sets no cookie", async () => {
    const response = await proxy(pageRequest("/", { acceptLanguage: "en-US,en;q=0.9" }));

    expect(getRedirectUrl(response)).toBeNull();
    expect(getRewrittenUrl(response)).toBe(`${origin}/id`);
    expect(response.cookies.get("NEXT_LOCALE")).toBeUndefined();
  });

  it("serves an Indonesian app page at its unprefixed address", async () => {
    const response = await proxy(pageRequest("/home", { acceptLanguage: "en" }));

    expect(getRewrittenUrl(response)).toBe(`${origin}/id/home`);
  });

  it("sends a visitor who chose English to the English page", async () => {
    expect(getRedirectUrl(await proxy(pageRequest("/", { cookie: "NEXT_LOCALE=en" })))).toBe(`${origin}/en`);
    expect(getRedirectUrl(await proxy(pageRequest("/home", { cookie: "NEXT_LOCALE=en" })))).toBe(`${origin}/en/home`);
  });

  it("keeps a visitor who chose Indonesian on the unprefixed address", async () => {
    const response = await proxy(pageRequest("/home", { acceptLanguage: "en", cookie: "NEXT_LOCALE=id" }));

    expect(getRewrittenUrl(response)).toBe(`${origin}/id/home`);
  });

  it("drops the Indonesian prefix from the address", async () => {
    expect(getRedirectUrl(await proxy(pageRequest("/id/home")))).toBe(`${origin}/home`);
    expect(getRedirectUrl(await proxy(pageRequest("/id")))).toBe(`${origin}/`);
  });

  it("remembers a switch to English for a year", async () => {
    // The switch links to /en/...; without JavaScript the proxy is what updates the cookie.
    const response = await proxy(pageRequest("/en/home", { cookie: "NEXT_LOCALE=id" }));

    expect(getRedirectUrl(response)).toBeNull();
    const cookie = response.cookies.get("NEXT_LOCALE");
    expect(cookie?.value).toBe("en");
    expect(cookie?.maxAge).toBe(oneYear);
  });

  it("leaves the request body alone, so server actions can still read it", async () => {
    const request = pageRequest("/home", { method: "POST", body: "form-data" });

    await proxy(request);

    expect(request.bodyUsed).toBe(false);
    expect(await request.text()).toBe("form-data");
  });

  it("sends a visitor without a session from a protected page to sign-in, keeping the page as next", async () => {
    expect(getRedirectUrl(await proxy(pageRequest("/orders")))).toBe(`${origin}/login?next=%2Forders`);
    expect(getRedirectUrl(await proxy(pageRequest("/agency/schedule")))).toBe(
      `${origin}/login?next=%2Fagency%2Fschedule`,
    );
  });

  it("keeps the language and the query string on the way to sign-in", async () => {
    expect(getRedirectUrl(await proxy(pageRequest("/en/admin/monitor?view=grid")))).toBe(
      `${origin}/en/login?next=%2Fadmin%2Fmonitor%3Fview%3Dgrid`,
    );
  });

  it("lets a visitor without a session open public pages and the sign-in pages", async () => {
    for (const path of ["/", "/home", "/services", "/support", "/login", "/signup", "/en/login"]) {
      expect(getRedirectUrl(await proxy(pageRequest(path))), path).toBeNull();
    }
  });

  it("applies a remembered language before the sign-in check", async () => {
    // /orders with an English cookie goes to /en/orders first; that request then goes to sign-in.
    expect(getRedirectUrl(await proxy(pageRequest("/orders", { cookie: "NEXT_LOCALE=en" })))).toBe(
      `${origin}/en/orders`,
    );
    expect(getRedirectUrl(await proxy(pageRequest("/en/orders", { cookie: "NEXT_LOCALE=en" })))).toBe(
      `${origin}/en/login?next=%2Forders`,
    );
  });

  it("runs on pages only, not on the API, Next.js files or public files", async () => {
    for (const url of ["/", "/home", "/en", "/en/services", "/agency/schedule", "/id/home"]) {
      expect(unstable_doesMiddlewareMatch({ config, url }), url).toBe(true);
    }
    for (const url of [
      "/api/health",
      "/_next/static/chunks/app.js",
      "/_next/image",
      "/images/hero-wiping-counter.jpg",
      "/favicon.ico",
    ]) {
      expect(unstable_doesMiddlewareMatch({ config, url }), url).toBe(false);
    }
  });
});
