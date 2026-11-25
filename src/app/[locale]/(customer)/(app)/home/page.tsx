import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GateFallback } from "@/components/auth/gate-fallback";
import { HomeContent } from "@/components/customer/home-content";
import { PageContainer } from "@/components/ui/page-container";
import { StaffRedirect } from "@/components/auth/staff-redirect";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("HomePage");
  return { title: t("metaTitle") };
}

// The customer app home (D5, mocks Customer-Home and Phone-Home): "Pesanan Anda" for a signed-in
// customer, where to start for anyone else (src/components/customer/home-content.tsx). Public: a
// visitor may look before ordering, and the orders are read with the customer's own session only.
// The content reads the session, so it streams in behind <Suspense>.
// Source: node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md ("Working with runtime APIs")
export default function HomePage() {
  return (
    <PageContainer wide>
      <Suspense fallback={<GateFallback />}>
        <StaffRedirect />
        <HomeContent />
      </Suspense>
    </PageContainer>
  );
}
