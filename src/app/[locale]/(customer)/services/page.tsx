import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CatalogSkeleton } from "@/components/customer/catalog-skeleton";
import { ServiceCatalog } from "@/components/customer/service-catalog";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ServicesPage");
  return { title: t("title") };
}

// HomeKlin's services and its one price list, filtered by area, type and keyword from the address
// (?area=&type=&q=), with the free slots of the chosen area (T8). The title and the loading state are
// the prerendered shell; the catalog reads the address, so it streams in behind <Suspense>.
// Source: node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md ("Working with runtime APIs")
export default function ServicesPage({ searchParams }: PageProps<"/[locale]/services">) {
  const t = useTranslations("ServicesPage");
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} size="large" />
      <Suspense fallback={<CatalogSkeleton />}>
        <ServiceCatalog searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}
