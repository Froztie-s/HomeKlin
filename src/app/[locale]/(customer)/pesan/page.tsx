import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GateFallback } from "@/components/auth/gate-fallback";
import { OrderContent } from "@/components/customer/order-content";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OrderPage");
  return { title: t("title") };
}

// The order page (T9b), public: /pesan?layanan=<id>&area=<id>&starts=<window start>, opened from the
// landing page's service cards, "Pesan" on /services and "Pesan sekarang". Ordering needs no account
// first: a guest gets a 6-digit code by email, and the code places the order (and makes the account).
// A signed-in customer orders straight away. The title is the prerendered shell; the form renders at
// request time behind <Suspense>, because it reads the address, the session and the free windows.
// Every order action checks the role and the input on the server (src/lib/booking/actions.ts).
// Source: node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md ("Working with runtime APIs")
export default function OrderPage({ searchParams }: PageProps<"/[locale]/pesan">) {
  const t = useTranslations("OrderPage");
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} size="large" />
      <Suspense fallback={<GateFallback />}>
        <OrderContent searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}
