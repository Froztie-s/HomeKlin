import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl finds src/i18n/request.ts by itself. createMessagesDeclaration writes
// src/messages/id.d.json.ts (git-ignored) on dev, build and typegen, which gives TypeScript the exact
// Indonesian messages, so a wrong ICU argument in t() is a type error too, not only a wrong key.
// Source: https://next-intl.dev/docs/workflows/typescript
const withNextIntl = createNextIntlPlugin({
  experimental: { createMessagesDeclaration: "./src/messages/id.json" },
});

// Security headers on every response (T34 security review, M1). No other site may frame HomeKlin, so a
// signed-in admin or cleaner cannot be tricked into clicking a framed button (clickjacking). A full
// script-src CSP with nonces is not set: it needs every inline script of Next.js and next-intl nonced,
// and is logged as a follow-up in markdown/Progress.md.
// Source: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md
export const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
