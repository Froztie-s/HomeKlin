import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { categoryOptions } from "@/components/admin/category-options";
import { ServiceForm } from "@/components/admin/service-form";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { PageHeader } from "@/components/ui/page-header";
import { ClientMessages } from "@/i18n/client-messages";
import { listAllServices, nextSortOrder } from "@/lib/catalog/admin";
import { CatalogError } from "@/lib/catalog/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ServiceFormValues } from "@/lib/validation/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminServiceNewPage");
  return { title: t("title") };
}

// Adds a service to HomeKlin's price list (T7b), admins only (T5). The title is prerendered; the form
// renders inside the page's own role check. A new service starts switched off, so customers do not
// see it until admin has checked it and ticked Aktif.
export default function AdminServiceNewPage() {
  const t = useTranslations("AdminServiceNewPage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["admin"]}>
          <NewServiceContent />
        </RoleGate>
      </Suspense>
    </>
  );
}

async function NewServiceContent() {
  const supabase = await createSupabaseServerClient({ writeCookies: false });
  // The new service goes after the last one unless admin chooses another place. Should the list not
  // load, the field starts empty and admin fills it in.
  let sortOrder = "";
  try {
    sortOrder = String(nextSortOrder(await listAllServices(supabase)));
  } catch (error) {
    if (!(error instanceof CatalogError)) throw error;
  }

  const initial: ServiceFormValues = {
    id: "",
    category: "",
    sortOrder,
    nameId: "",
    nameEn: "",
    descriptionId: "",
    descriptionEn: "",
    priceIdr: "",
    durationMinutes: "",
    isActive: false,
  };
  return (
    <ClientMessages namespaces={["AdminServiceForm"]}>
      <ServiceForm mode="create" initial={initial} categories={await categoryOptions()} />
    </ClientMessages>
  );
}
