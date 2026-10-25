import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { BookingContent } from "@/components/customer/booking-content";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("BookPage");
  return { title: t("title") };
}

// Booking (T9), customers only: /book?service=<id>&area=<id>&starts=<window start>, opened from
// "Pesan" on /services. A visitor who is not signed in is sent to the sign-in page first and comes
// back to the same address (src/proxy.ts keeps the query in `next`). The title is the prerendered
// shell; the form renders inside the page's own role check, at request time, because it reads the
// address and the free windows.
// Sources: node_modules/next/dist/docs/01-app/02-guides/authentication.md ("Layouts and auth checks")
// and node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md ("Working with runtime APIs")
export default function BookPage({ searchParams }: PageProps<"/[locale]/book">) {
  const t = useTranslations("BookPage");
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} size="large" />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["customer"]}>
          <BookingContent searchParams={searchParams} />
        </RoleGate>
      </Suspense>
    </PageContainer>
  );
}
