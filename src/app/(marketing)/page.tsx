import { CtaBand } from "@/components/marketing/cta-band";
import { FaqTeaser } from "@/components/marketing/faq-teaser";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Safety } from "@/components/marketing/safety";
import { ServicesBento } from "@/components/marketing/services-bento";

// The landing page at / for visitors (markdown/SPEC.md "Landing page"). It sets no title of its own,
// so the browser tab reads exactly "HomeKlin" (the root layout's default).
export default function LandingPage() {
  return (
    <>
      <Hero />
      <ServicesBento />
      <HowItWorks />
      <Safety />
      <FaqTeaser />
      <CtaBand />
    </>
  );
}
