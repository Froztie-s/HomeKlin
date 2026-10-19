import { Instrument_Serif, Inter, Inter_Tight } from "next/font/google";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SkipLink } from "@/components/shell/skip-link";

// The redesign's three families (markdown/design.md, Typography), loaded for the landing page only,
// so the apps do not download them until they migrate. Inter and Inter Tight are variable fonts;
// Instrument Serif is used only in italic, at its one weight.
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: "italic",
  subsets: ["latin"],
});

// The landing page has its own header and footer and no app navigation. `theme-forest` switches the
// shared token names to the redesign's values for everything inside (src/app/globals.css).
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`theme-forest ${interTight.variable} ${inter.variable} ${instrumentSerif.variable} flex flex-1 flex-col bg-canvas font-sans text-ink`}
    >
      <SkipLink />
      <MarketingHeader />
      <main id="konten" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
