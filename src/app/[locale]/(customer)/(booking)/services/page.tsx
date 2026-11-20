import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageContainer } from "@/components/ui/page-container";
import { BookingStepper } from "@/components/customer/booking-stepper";
import { BookingTrust } from "@/components/customer/booking-trust";
import { CatalogSkeleton } from "@/components/customer/catalog-skeleton";
import { flowPageTitle } from "@/components/customer/flow-styles";
import { ServiceCatalog } from "@/components/customer/service-catalog";
import { StaffRedirect } from "@/components/auth/staff-redirect";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ServicesPage");
  return { title: t("metaTitle") };
}

// Step 1 of ordering (D5, mocks Main and Phone-Services) on the T8 catalog: HomeKlin's services and its
// one price list, filtered by area, type and keyword from the address (?area=&type=&q=), and the
// chosen service's free times in that area. The steps, the title and the loading state are the
// prerendered shell; the catalog reads the address, so it streams in behind <Suspense>.
// Source: node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md ("Working with runtime APIs")
export default function ServicesPage({ searchParams }: PageProps<"/[locale]/services">) {
  const t = useTranslations("ServicesPage");
  return (
    <PageContainer wide>
      <BookingStepper current={1} />
      <header className="flex flex-col gap-2">
        <h1 className={flowPageTitle}>{t("title")}</h1>
        <p className="max-w-prose text-ink-muted md:text-body-lg">{t("description")}</p>
        <BookingTrust />
      </header>
      <Suspense fallback={<CatalogSkeleton />}>
        <StaffRedirect />
        <ServiceCatalog searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}
