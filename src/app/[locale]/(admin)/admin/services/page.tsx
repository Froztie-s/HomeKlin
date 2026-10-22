import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminServicesPage");
  return { title: t("title") };
}

// Placeholder until T7b builds the editor for HomeKlin's one price list; the empty state says what will appear.
export default function AdminServicesPage() {
  const t = useTranslations("AdminServicesPage");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState icon={Tags} title={t("emptyTitle")}>
        {t("emptyBody")}
      </EmptyState>
    </>
  );
}
