import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SkipLink } from "@/components/shell/skip-link";

// The landing page has its own header and footer and no app navigation.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <MarketingHeader />
      <main id="konten" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <MarketingFooter />
    </>
  );
}
