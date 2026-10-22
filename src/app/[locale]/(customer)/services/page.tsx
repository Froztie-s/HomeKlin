import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { defaultArea, previewServices } from "@/components/customer/home-preview-data";
import { ServiceCard } from "@/components/customer/service-card";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { SampleNote } from "@/components/ui/sample-note";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ServicesPage");
  return { title: t("title") };
}

// HomeKlin's services with the one price list. Static preview until T7 (catalog) and T8 (free slots).
export default function ServicesPage() {
  const t = useTranslations("ServicesPage");
  const preview = useTranslations("PreviewData");
  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("description", { area: preview(`areas.${defaultArea}`) })}
        size="large"
      />
      <ul className="grid gap-4 md:grid-cols-2 md:gap-5">
        {previewServices.map((service) => (
          <li key={service.id}>
            <ServiceCard service={service} />
          </li>
        ))}
      </ul>
      <SampleNote>{t("previewNote")}</SampleNote>
    </PageContainer>
  );
}
