import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Source: https://vitest.dev/config/ and node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
