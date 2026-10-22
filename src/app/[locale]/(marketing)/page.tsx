import { CtaShell } from "@/components/marketing/cta-shell";
import { FaqTeaser } from "@/components/marketing/faq-teaser";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Safety } from "@/components/marketing/safety";
import { ServicesGrid } from "@/components/marketing/services-grid";
import { TrustRow } from "@/components/marketing/trust-row";

// The landing page at / for visitors (markdown/SPEC.md "Landing page"), on the redesign system in
// markdown/design.md (T3c). It sets no title of its own, so the browser tab reads exactly "HomeKlin"
// (the root layout's default).
export default function LandingPage() {
  return (
    <>
      <Hero />
      <TrustRow />
      <ServicesGrid />
      <Safety />
      <HowItWorks />
      <FaqTeaser />
      <CtaShell />
    </>
  );
}
