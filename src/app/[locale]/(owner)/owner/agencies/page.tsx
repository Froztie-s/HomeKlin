import type { Metadata } from "next";
import { Building2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Notice } from "@/components/admin/notice";
import { Panel } from "@/components/agency/agency-ui";
import { primaryButton } from "@/components/agency/styles";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { AgencyStatusPill } from "@/components/owner/agency-status-pill";
import { ConfirmAction } from "@/components/owner/confirm-action";
import { monthYear } from "@/components/owner/numbers";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Link } from "@/i18n/navigation";
import { getServiceAreas } from "@/lib/catalog/cached";
import { formatRupiah } from "@/lib/format";
import { setAgencyStatus, type OwnerFailureKey } from "@/lib/owner/actions";
import { listOwnerAgencies, OwnerError, type OwnerAgency } from "@/lib/owner/owner";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OwnerAgenciesPage");
  return { title: t("title") };
}

// The partner agencies (T29c; D3, after the mock Owner-Partners), the owner only. The title is
// prerendered; the list and the "Tambah mitra" link render inside the page's own role checks and are
// read with the owner's own session (owner_agencies() answers the owner only): per partner the last
// 30 days' completed jobs, on-time share, cancelled orders and fees paid out, as in the mock. Each partner can be suspended or reactivated after a confirm step that says what it does; the
// action checks the owner role again on the server. Adding a partner has its own page (PartnerNew).
export default function OwnerAgenciesPage() {
  const t = useTranslations("OwnerAgenciesPage");
  return (
    <>
      <PageHeader
        size="compact"
        title={t("title")}
        description={t("description")}
        action={
          <Suspense fallback={<GateFallback variant="action" />}>
            <RoleGate roles={["owner"]}>
              <AddPartnerLink label={t("addLink")} />
            </RoleGate>
          </Suspense>
        }
      />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["owner"]}>
          <OwnerAgenciesContent />
        </RoleGate>
      </Suspense>
    </>
  );
}

/** The mock's primary pill with the plus in a lime circle. */
function AddPartnerLink({ label }: { label: string }) {
  return (
    <Link href="/owner/agencies/new" className={`${primaryButton} pr-2.5`}>
      {label}
      <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-lime text-on-lime">
        <Plus className="size-4" />
      </span>
    </Link>
  );
}

const headCell = "px-4 py-3 text-left text-xs font-semibold text-ink first:pl-5 md:first:pl-6";
const numberHead = `${headCell} text-right`;
const numberCell = "px-4 py-3 text-right whitespace-nowrap tabular-nums";

async function OwnerAgenciesContent() {
  const [t, locale] = await Promise.all([getTranslations("OwnerAgenciesPage"), getLocale()]);

  let agencies: OwnerAgency[];
  let areas: Awaited<ReturnType<typeof getServiceAreas>>;
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    [agencies, areas] = await Promise.all([listOwnerAgencies(client), getServiceAreas()]);
  } catch (error) {
    if (!(error instanceof OwnerError)) throw error;
    console.error(error);
    return (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }

  const money = (amount: number) => formatRupiah(amount, locale);
  const areaName = (id: string) => areas.find((area) => area.id === id)?.name[locale] ?? id;
  const percent = new Intl.NumberFormat(locale === "id" ? "id-ID" : "en-ID", { maximumFractionDigits: 0 });
  const onTime = (agency: OwnerAgency) => (agency.onTimePercent === null ? t("table.noOnTime") : `${percent.format(agency.onTimePercent)}%`);
  // Changing the status can only be refused for the partner reasons; the admin-account keys never come
  // from setAgencyStatus and read as "not saved".
  const general = t("errors.unavailable");
  const errors = {
    notAllowed: t("errors.notAllowed"), nameInvalid: t("errors.nameInvalid"), areaNotFound: t("errors.areaNotFound"),
    agencyNotFound: t("errors.agencyNotFound"), statusInvalid: t("errors.statusInvalid"), emailInvalid: general,
    emailTaken: general, passwordInvalid: general, adminNotFound: general, unavailable: general,
  } satisfies Record<OwnerFailureKey, string>;
  const active = agencies.filter((agency) => agency.status === "active").length;

  if (agencies.length === 0) {
    return (
      <EmptyState tone="forest" icon={Building2} title={t("empty.title")}>
        {t("empty.body")}
      </EmptyState>
    );
  }

  return (
    <Panel
      id="daftar-mitra"
      title={t("list.title")}
      description={
        <>
          {t("summary", { total: agencies.length, active })}. {t("list.description")}
        </>
      }
      flush
    >
      <div className="relative sm:overflow-x-auto">
        {/* Below 640 px each partner is a block: its name and numbers, then its action under them. */}
        <table className="w-full border-collapse text-sm max-sm:block">
          <caption className="sr-only">{t("table.caption")}</caption>
          <thead className="bg-sunken max-sm:hidden">
            <tr>
              <th scope="col" className={headCell}>{t("table.name")}</th>
              <th scope="col" className={`${headCell} hidden sm:table-cell`}>{t("table.status")}</th>
              <th scope="col" className={`${numberHead} hidden lg:table-cell`}>{t("table.completed")}</th>
              <th scope="col" className={`${numberHead} hidden lg:table-cell`}>{t("table.onTime")}</th>
              <th scope="col" className={`${numberHead} hidden lg:table-cell`}>{t("table.cancelled")}</th>
              <th scope="col" className={`${numberHead} hidden lg:table-cell`}>{t("table.paidOut")}</th>
              <th scope="col" className={`${headCell} pr-5 md:pr-6`}>
                <span className="sr-only">{t("table.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {agencies.map((agency) => {
              const suspended = agency.status === "suspended";
              const labels = suspended ? "reactivate" : "suspend";
              const signIn = agency.hasSignIn ? t("signIn.yes") : t("signIn.no");
              const status = <AgencyStatusPill status={agency.status} label={t(`status.${agency.status}`)} />;
              return (
                <tr key={agency.id} className="border-t border-border align-top max-sm:block max-sm:pb-4">
                  <td className="py-4 pr-4 pl-5 max-sm:block sm:min-w-52 md:pl-6">
                    <p className="font-semibold break-words text-ink">{agency.name}</p>
                    <p className="text-xs whitespace-nowrap text-ink-muted">{t("table.since", { date: monthYear(agency.createdAt, locale) })}</p>
                    <p className="mt-1.5 text-xs text-ink-muted">
                      {t("table.areas")}: {agency.areaIds.length > 0 ? agency.areaIds.map(areaName).join(", ") : t("table.noAreas")}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {t("table.cleaners")}: {agency.cleaners} <span aria-hidden="true">·</span> {t("table.signIn")}: {signIn}
                    </p>
                    {/* Below 1024 px the numbers, and below 640 px the status, move under the name. */}
                    <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-ink lg:hidden">
                      <span className="whitespace-nowrap">{t("table.completed")}: {agency.completed30d}</span>
                      <span className="whitespace-nowrap">{t("table.onTime")}: {onTime(agency)}</span>
                      <span className="whitespace-nowrap">{t("table.cancelled")}: {agency.cancelled30d}</span>
                      <span className="whitespace-nowrap">{t("table.paidOut")}: {money(agency.paidOut30dIdr)}</span>
                    </p>
                    <div className="mt-2 sm:hidden">{status}</div>
                  </td>
                  <td className="hidden px-4 py-4 sm:table-cell">{status}</td>
                  <td className={`${numberCell} hidden py-4 text-ink lg:table-cell`}>{agency.completed30d}</td>
                  <td className={`${numberCell} hidden py-4 lg:table-cell ${agency.onTimePercent === null ? "text-ink-muted" : "text-ink"}`}>{onTime(agency)}</td>
                  <td className={`${numberCell} hidden py-4 text-ink lg:table-cell`}>{agency.cancelled30d}</td>
                  <td className={`${numberCell} hidden py-4 font-semibold text-ink lg:table-cell`}>{money(agency.paidOut30dIdr)}</td>
                  <td className="pr-5 pl-5 max-sm:block sm:py-3 sm:pl-4 sm:text-right md:pr-6">
                    <ConfirmAction
                      action={setAgencyStatus}
                      fields={{ agencyId: agency.id, status: suspended ? "active" : "suspended" }}
                      icon={suspended ? "reactivate" : "suspend"}
                      tone={suspended ? "default" : "danger"}
                      // Audit item 5: a quiet text button, so the rows do not compete with "Tambah mitra".
                      trigger="quiet"
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
    </Panel>
  );
}

