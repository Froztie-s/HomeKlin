import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageContainer } from "@/components/ui/page-container";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { BookingStepper } from "@/components/customer/booking-stepper";
import { BookingTrust } from "@/components/customer/booking-trust";
import { flowPageTitle } from "@/components/customer/flow-styles";
import { OrderContent } from "@/components/customer/order-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OrderPage");
  return { title: t("title") };
}

// Step 2 of ordering (T9b, restyled in D5 after the Customer-Booking and Phone-Booking mocks):
// /pesan?layanan=<id>&area=<id>&starts=<window start>, opened from step 1 (/services), the landing
// page's service cards and the old /book address. Customers only since 2026-11-20 (the user: no
// ordering without an account): a visitor is sent to /login with this address as ?next=, and can sign
// up from there; staff go to their own home. So, like every protected page, everything renders inside
// the role check (tests/protected-pages.test.ts). Every order action checks the role and the input on
// the server (src/lib/booking/actions.ts).
// Source: node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md ("Working with runtime APIs")
export default function OrderPage({ searchParams }: PageProps<"/[locale]/pesan">) {
  const t = useTranslations("OrderPage");
  return (
    <PageContainer wide>
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["customer"]}>
          <BookingStepper current={2} />
          <header className="flex flex-col gap-2">
            <h1 className={flowPageTitle}>{t("title")}</h1>
            <p className="max-w-prose text-ink-muted md:text-body-lg">{t("description")}</p>
            <BookingTrust />
          </header>
          <OrderContent searchParams={searchParams} />
        </RoleGate>
      </Suspense>
    </PageContainer>
  );
}
