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
  experimental: {
    // An agency uploads a cleaner's photo of up to 2 MB through a Server Action (addCleaner); the
    // default 1 MB body limit would refuse it. The room above 2 MB is for the form's other fields and
    // the multipart overhead. Source: node_modules/next/dist/docs/01-app/02-guides/server-actions.md
    serverActions: { bodySizeLimit: "3mb" },
  },
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
