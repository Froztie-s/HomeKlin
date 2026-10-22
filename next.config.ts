import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl finds src/i18n/request.ts by itself. createMessagesDeclaration writes
// src/messages/id.d.json.ts (git-ignored) on dev, build and typegen, which gives TypeScript the exact
// Indonesian messages, so a wrong ICU argument in t() is a type error too, not only a wrong key.
// Source: https://next-intl.dev/docs/workflows/typescript
const withNextIntl = createNextIntlPlugin({
  experimental: { createMessagesDeclaration: "./src/messages/id.json" },
});

const nextConfig: NextConfig = {
  cacheComponents: true,
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
