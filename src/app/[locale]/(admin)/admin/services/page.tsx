import type { Metadata } from "next";
import { Plus, Tags } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Notice } from "@/components/admin/notice";
import { ServicesTable } from "@/components/admin/services-table";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClientMessages } from "@/i18n/client-messages";
import { listAllServices, type AdminService } from "@/lib/catalog/admin";
import { CatalogError } from "@/lib/catalog/catalog";
import { formatRupiah } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseServiceId } from "@/lib/validation/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminServicesPage");
  return { title: t("title") };
}

type SearchParams = PageProps<"/[locale]/admin/services">["searchParams"];

// HomeKlin's services and its one price list (T7b), admins only (T5). The title is prerendered; the
// list renders inside the page's own role check (a layout's check would not protect it) and is read
// with the signed-in admin's own client, so row-level security decides what it may see: every service,
// switched on or off. It is never cached, so admin always sees what is stored. After a save the form
// comes back here with ?created= or ?saved= and the service's id, which says what was done.
export default function AdminServicesPage({ searchParams }: PageProps<"/[locale]/admin/services">) {
  const t = useTranslations("AdminServicesPage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["admin"]}>
          <AdminServicesContent searchParams={searchParams} />
        </RoleGate>
      </Suspense>
    </>
  );
}

/** The first value of a parameter that may appear more than once. */
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function AdminServicesContent({ searchParams }: { searchParams: SearchParams }) {
  const [t, locale, params, supabase] = await Promise.all([
    getTranslations("AdminServicesPage"),
    getLocale(),
    searchParams,
    createSupabaseServerClient({ writeCookies: false }),
  ]);

  let services: AdminService[];
  try {
    services = await listAllServices(supabase);
  } catch (error) {
    // Only a failed read becomes a message; anything else (such as Next.js' own signals) goes on.
    if (!(error instanceof CatalogError)) throw error;
    return (
      <Notice tone="danger" title={t("loadErrorTitle")}>
        {t("loadErrorBody")}
      </Notice>
    );
  }

  const createdId = parseServiceId(first(params.created));
  const savedId = parseServiceId(first(params.saved));
  const changed = services.find((service) => service.id === (createdId ?? savedId));
  const active = services.filter((service) => service.isActive).length;

  return (
    <>
      {changed ? (
        <Notice
          tone="success"
          title={t(createdId ? "notice.created" : "notice.saved", { name: changed.name.id })}
        >
          {changed.isActive
            ? t("notice.live", { price: formatRupiah(changed.priceIdr, locale) })
            : t("notice.hidden")}
        </Notice>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{t("summary", { total: services.length, active })}</p>
        <ButtonLink href="/admin/services/new" icon={Plus}>
          {t("add")}
        </ButtonLink>
      </div>
      {services.length === 0 ? (
        <EmptyState icon={Tags} title={t("emptyTitle")}>
          {t("emptyBody")}
        </EmptyState>
      ) : (
        <ClientMessages namespaces={["AdminServiceSwitch"]}>
          <ServicesTable services={services} />
        </ClientMessages>
      )}
    </>
  );
}
