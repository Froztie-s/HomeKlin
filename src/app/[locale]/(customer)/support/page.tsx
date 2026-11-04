import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GateFallback } from "@/components/auth/gate-fallback";
import { SupportContent } from "@/components/support/support-content";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("SupportPage");
  return { title: t("title") };
}

// Help (T19, T20), public: HomeKlin's FAQ with keyword search (/support?q=<words>), and when it does not
// help, "Hubungi admin": a signed-in customer turns the question into a chat ticket and follows it at
// /support?ticket=<id>, in real time. The title is the prerendered shell; the content reads the address
// (and its contact panel the session), so it streams in behind <Suspense>. Every ticket action checks
// the role and the input on the server (src/lib/support/actions.ts), and row-level security keeps each
// customer to their own tickets.
// Source: node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md ("Working with runtime APIs")
export default function SupportPage({ searchParams }: PageProps<"/[locale]/support">) {
  const t = useTranslations("SupportPage");
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} size="large" />
      <Suspense fallback={<GateFallback />}>
        <SupportContent searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}
