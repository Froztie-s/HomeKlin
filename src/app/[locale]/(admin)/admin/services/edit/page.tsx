import type { Metadata } from "next";
import { ArrowLeft, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { categoryOptions } from "@/components/admin/category-options";
import { Notice } from "@/components/admin/notice";
import { ServiceForm } from "@/components/admin/service-form";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClientMessages } from "@/i18n/client-messages";
import { getService, type AdminService } from "@/lib/catalog/admin";
import { CatalogError } from "@/lib/catalog/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseServiceId, serviceToFormValues } from "@/lib/validation/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminServiceEditPage");
  return { title: t("title") };
}

type SearchParams = PageProps<"/[locale]/admin/services/edit">["searchParams"];

// Changes one of HomeKlin's services (T7b), admins only (T5), at /admin/services/edit?id=<id>. The id
// is a search parameter, not a path segment: an unknown path segment would make the whole address
// request-time data, and the back-office shell reads the address (usePathname) outside a Suspense
// boundary, which Cache Components refuses for a dynamic segment. The title is prerendered; the id is
// read inside the page's own role check. The service is read with the signed-in admin's own client, so
// an inactive one can be found too.
// Source: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-pathname.md
// ("Cache Components")
export default function AdminServiceEditPage({ searchParams }: PageProps<"/[locale]/admin/services/edit">) {
  const t = useTranslations("AdminServiceEditPage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["admin"]}>
          <EditServiceContent searchParams={searchParams} />
        </RoleGate>
      </Suspense>
    </>
  );
}

async function EditServiceContent({ searchParams }: { searchParams: SearchParams }) {
  const [{ id: rawId }, t] = await Promise.all([searchParams, getTranslations("AdminServiceEditPage")]);
  // An address no service could have is not looked up at all (?id=a&id=b counts as no id).
  const id = parseServiceId(rawId);

  let service: AdminService | null = null;
  if (id) {
    const supabase = await createSupabaseServerClient({ writeCookies: false });
    try {
      service = await getService(supabase, id);
    } catch (error) {
      if (!(error instanceof CatalogError)) throw error;
      const list = await getTranslations("AdminServicesPage");
      return (
        <Notice tone="danger" title={list("loadErrorTitle")}>
          {list("loadErrorBody")}
        </Notice>
      );
    }
  }

  if (!service) {
    return (
      <>
        <EmptyState icon={SearchX} title={t("notFoundTitle")}>
          {t("notFoundBody")}
        </EmptyState>
        <div>
          <ButtonLink href="/admin/services" variant="secondary" icon={ArrowLeft}>
            {t("back")}
          </ButtonLink>
        </div>
      </>
    );
  }

  return (
    <ClientMessages namespaces={["AdminServiceForm"]}>
      <ServiceForm mode="edit" initial={serviceToFormValues(service)} categories={await categoryOptions()} />
    </ClientMessages>
  );
}
