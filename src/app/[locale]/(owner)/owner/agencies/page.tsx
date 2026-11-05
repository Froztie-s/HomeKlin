import type { Metadata } from "next";
import { Building2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Notice } from "@/components/admin/notice";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { AddAgencyForm } from "@/components/owner/add-agency-form";
import { AgencyStatusPill } from "@/components/owner/agency-status-pill";
import { ConfirmAction } from "@/components/owner/confirm-action";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClientMessages } from "@/i18n/client-messages";
import { getServiceAreas } from "@/lib/catalog/cached";
import { formatRupiah } from "@/lib/format";
import { setAgencyStatus, type OwnerFailureKey } from "@/lib/owner/actions";
import { listOwnerAgencies, OwnerError, type OwnerAgency } from "@/lib/owner/owner";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OwnerAgenciesPage");
  return { title: t("title") };
}

// The partner agencies (T29c), the owner only. The title is prerendered; the list renders inside the
// page's own role check and is read with the owner's own session (owner_agencies() answers the owner
// only). Each partner can be suspended or reactivated after a confirm step that says what it does;
// "Tambah mitra" adds one. The actions check the owner role again on the server.
export default function OwnerAgenciesPage() {
  const t = useTranslations("OwnerAgenciesPage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["owner"]}>
          <OwnerAgenciesContent />
        </RoleGate>
      </Suspense>
    </>
  );
}

const headCell = "px-4 py-3 text-left text-xs font-semibold text-ink-muted";
const numberHead = `${headCell} text-right`;
const numberCell = "px-4 py-3 text-right whitespace-nowrap text-ink tabular-nums";

async function OwnerAgenciesContent() {
  const [t, locale] = await Promise.all([getTranslations("OwnerAgenciesPage"), getLocale()]);

  let agencies: OwnerAgency[];
  let areas: Awaited<ReturnType<typeof getServiceAreas>>;
  try {
    [agencies, areas] = await Promise.all([
      listOwnerAgencies(await createSupabaseServerClient({ writeCookies: false })),
      getServiceAreas(),
    ]);
  } catch (error) {
    if (!(error instanceof OwnerError)) throw error;
    console.error(error);
    return (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }

  const areaName = (id: string) => areas.find((area) => area.id === id)?.name[locale] ?? id;
  const since = new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
  // Changing the status can only be refused for the partner reasons; the admin-account keys never come
  // from setAgencyStatus and read as "not saved".
  const general = t("errors.unavailable");
  const errors = {
    notAllowed: t("errors.notAllowed"), nameInvalid: t("errors.nameInvalid"), areaNotFound: t("errors.areaNotFound"),
    agencyNotFound: t("errors.agencyNotFound"), statusInvalid: t("errors.statusInvalid"), emailInvalid: general,
    emailTaken: general, passwordInvalid: general, adminNotFound: general, unavailable: general,
  } satisfies Record<OwnerFailureKey, string>;
  const active = agencies.filter((agency) => agency.status === "active").length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{t("summary", { total: agencies.length, active })}</p>
        <a
          href="#tambah-mitra"
          className="inline-flex min-h-touch items-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-semibold text-on-brand transition-[background-color,transform] duration-150 ease-out-quart hover:bg-brand-700 active:scale-[0.98] active:bg-brand-800"
        >
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          {t("addLink")}
        </a>
      </div>

      {agencies.length === 0 ? (
        <EmptyState icon={Building2} title={t("empty.title")}>
          {t("empty.body")}
        </EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t("table.caption")}</caption>
            <thead className="bg-surface-sunken">
              <tr>
                <th scope="col" className={headCell}>{t("table.name")}</th>
                <th scope="col" className={headCell}>{t("table.status")}</th>
                <th scope="col" className={headCell}>{t("table.areas")}</th>
                <th scope="col" className={`${numberHead} hidden 2xl:table-cell`}>{t("table.cleaners")}</th>
                <th scope="col" className={numberHead}>{t("table.jobs")}</th>
                <th scope="col" className={numberHead}>{t("table.revenue")}</th>
                <th scope="col" className={`${headCell} hidden 2xl:table-cell`}>{t("table.signIn")}</th>
                <th scope="col" className={headCell}>
                  <span className="sr-only">{t("table.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agencies.map((agency) => {
                const suspended = agency.status === "suspended";
                const labels = suspended ? "reactivate" : "suspend";
                const signIn = agency.hasSignIn ? t("signIn.yes") : t("signIn.no");
                return (
                  <tr key={agency.id} className="align-top transition-colors duration-150 ease-out-quart hover:bg-canvas">
                    <td className="min-w-48 px-4 py-3">
                      <p className="font-semibold break-words text-ink">{agency.name}</p>
                      <p className="whitespace-nowrap text-ink-faint">{t("table.since", { date: since.format(new Date(agency.createdAt)) })}</p>
                      {/* Below 1536 px the cleaners and the sign-in move under the name. */}
                      <p className="mt-1 text-ink-muted 2xl:hidden">
                        {t("table.cleaners")}: {agency.cleaners} <span aria-hidden="true">·</span> {t("table.signIn")}: {signIn}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <AgencyStatusPill status={agency.status} label={t(`status.${agency.status}`)} />
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {agency.areaIds.length > 0 ? (
                        <ul className="flex flex-col gap-0.5">
                          {agency.areaIds.map((id) => (
                            <li key={id} className="whitespace-nowrap">{areaName(id)}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-ink-faint">{t("table.noAreas")}</span>
                      )}
                    </td>
                    <td className={`${numberCell} hidden 2xl:table-cell`}>{agency.cleaners}</td>
                    <td className={numberCell}>{agency.jobs}</td>
                    <td className={`${numberCell} font-semibold`}>{formatRupiah(agency.revenueIdr, locale)}</td>
                    <td className="hidden px-4 py-3 whitespace-nowrap text-ink 2xl:table-cell">{signIn}</td>
                    <td className="px-4 py-2 text-right">
                      <ConfirmAction
                        action={setAgencyStatus}
                        fields={{ agencyId: agency.id, status: suspended ? "active" : "suspended" }}
                        icon={suspended ? "reactivate" : "suspend"}
                        tone={suspended ? "default" : "danger"}
                        labels={{
                          button: t(`${labels}.button`),
                          buttonLabel: t(`${labels}.label`, { name: agency.name }),
                          question: t(`${labels}.question`, { name: agency.name }),
                          body: t(`${labels}.body`),
                          confirm: t(`${labels}.confirm`),
                          pending: t(`${labels}.pending`),
                          cancel: t("cancel"),
                          // Said after the change, when the row already shows the new status.
                          done: t(suspended ? "suspend.done" : "reactivate.done", { name: agency.name }),
                        }}
                        errors={errors}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section id="tambah-mitra" aria-labelledby="tambah-mitra-title" className="scroll-mt-20 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 xl:p-8">
        <header className="flex flex-col gap-1">
          <h2 id="tambah-mitra-title" className="font-display text-lg font-semibold text-ink">
            {t("form.title")}
          </h2>
          <p className="max-w-prose text-sm text-ink-muted">{t("form.description")}</p>
        </header>
        <ClientMessages namespaces={["OwnerAgenciesPage"]}>
          <AddAgencyForm areas={areas.map((area) => ({ id: area.id, name: area.name[locale] }))} />
        </ClientMessages>
      </section>
    </>
  );
}
