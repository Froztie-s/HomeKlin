import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { OrdersContent } from "@/components/customer/orders-content";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OrdersPage");
  return { title: t("title") };
}

// Customers only (T5). The title is prerendered; everything else renders inside the role check, which
// every protected page makes itself, because a layout's check does not protect its pages
// (node_modules/next/dist/docs/01-app/02-guides/authentication.md, "Layouts and auth checks").
// The content lists the customer's orders (T12); /orders?booked=<order id> confirms one (T9) and
// /orders?order=<order id> opens one from the list.
export default function OrdersPage({ searchParams }: PageProps<"/[locale]/orders">) {
  const t = useTranslations("OrdersPage");
  return (
    <PageContainer>
      <PageHeader title={t("title")} size="large" />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["customer"]}>
          <OrdersContent searchParams={searchParams} />
        </RoleGate>
      </Suspense>
    </PageContainer>
  );
}
