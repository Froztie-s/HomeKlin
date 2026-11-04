import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { GateFallback } from "@/components/auth/gate-fallback";
import type { FaqEntry } from "@/lib/support/support";
import { ContactAdmin, ContactLoading, ContactPanel } from "./contact-admin";
import { CustomerTicket } from "./customer-ticket";
import { getFaqEntries } from "./faq-cached";
import { FaqResults } from "./faq-results";
import { FaqSearch } from "./faq-search";
import { parseSupportQuery } from "./support-query";

type SearchParams = Record<string, string | string[] | undefined>;

// The content of /support (T19, T20). It reads the address, so it renders at request time inside the
// page's <Suspense>. /support?ticket=<id> opens that chat; otherwise the FAQ: the search box, the
// entries (from the cache, the same for everyone) and the "Hubungi admin" panel, which is always there
// below them and stands out when nothing matched. Only the panel reads the session, behind its own
// <Suspense>, so the FAQ never waits for it. Nothing here names who provides the cleaners
// (markdown/PRODUCT.md principle 6).
export async function SupportContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { query, ticketId } = parseSupportQuery(await searchParams);

  if (ticketId) {
    return (
      <Suspense fallback={<GateFallback />}>
        <CustomerTicket ticketId={ticketId} />
      </Suspense>
    );
  }

  let entries: FaqEntry[] | null;
  try {
    entries = await getFaqEntries(query);
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    entries = null;
  }
  const emphasis = entries !== null && entries.length > 0 ? "quiet" : "strong";

  return (
    <>
      <FaqSearch query={query} />
      <FaqResults entries={entries} query={query} />
      <Suspense
        fallback={
          <ContactPanel emphasis={emphasis}>
            <ContactLoading />
          </ContactPanel>
        }
      >
        <ContactAdmin query={query} emphasis={emphasis} />
      </Suspense>
    </>
  );
}
