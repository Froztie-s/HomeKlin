import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { LiveContent } from "@/components/customer/live-content";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("LiveStream");
  return { title: t("title") };
}

// /orders/live?order=<order id>: the live view of one of the customer's own jobs (T23), the address
// "Tonton langsung" links point to. Customers only, like the rest of /orders; the title is prerendered
// and the content renders inside the role check, which reads the order with the customer's own session.
export default function LivePage({ searchParams }: PageProps<"/[locale]/orders/live">) {
  const t = useTranslations("LiveStream");
  return (
    <PageContainer>
      <PageHeader title={t("title")} size="large" />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["customer"]}>
          <LiveContent searchParams={searchParams} />
        </RoleGate>
      </Suspense>
    </PageContainer>
  );
}
