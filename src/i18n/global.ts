import type messages from "@/messages/id.json";
import type { routing } from "./routing";

// Types next-intl with this site's locales and the Indonesian messages (the source of truth), so
// useTranslations("Unknown") or t("missing") is a type error in `npm run check` and `next build`.
// tests/messages.test.ts checks that en.json has exactly the same keys and ICU arguments.
// Source: https://next-intl.dev/docs/workflows/typescript
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
