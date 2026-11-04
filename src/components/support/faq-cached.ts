import { cacheLife, cacheTag } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { searchFaq } from "@/lib/support/support";

/** Tags every cached FAQ read; admin's FAQ changes can call updateTag(faqCacheTag) to show at once. */
export const faqCacheTag = "faq";

// HomeKlin's FAQ as /support reads it (T19): public, so it is read with the cookie-free public client
// and cached, one entry per search (the words are already trimmed and limited by parseSupportQuery).
// The FAQ changes rarely, and only through admin, so a few minutes' lifetime keeps every search fast
// while a change made outside the app (the seed, the database console) still shows soon.
// Sources: node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md,
// 04-functions/cacheTag.md and 04-functions/cacheLife.md
export async function getFaqEntries(query: string) {
  "use cache";
  cacheTag(faqCacheTag);
  cacheLife("minutes");
  return searchFaq(createSupabasePublicClient(), query);
}
