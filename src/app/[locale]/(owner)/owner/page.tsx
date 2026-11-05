import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Notice } from "@/components/admin/notice";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { AgencyStatusPill } from "@/components/owner/agency-status-pill";
import { statusRows } from "@/components/owner/numbers";
import { TrendChart } from "@/components/owner/trend-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatRupiah } from "@/lib/format";
import { getBusinessNumbers, OwnerError, type BusinessNumbers } from "@/lib/owner/owner";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OwnerDashboardPage");
  return { title: t("title") };
}

// The owner only (T29b). The title is prerendered; the numbers render inside the page's own role
// check (a layout's check would not protect it) and are read with the owner's own session, through
// owner_numbers(), which answers the owner role only and carries no customer data. Never cached, so
// the owner always sees what is stored.
export default function OwnerDashboardPage() {
  const t = useTranslations("OwnerDashboardPage");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<GateFallback />}>
        <RoleGate roles={["owner"]}>
          <OwnerNumbers />
        </RoleGate>
      </Suspense>
    </>
  );
}

const headCell = "px-4 py-3 text-left text-xs font-semibold text-ink-muted";
const numberHead = `${headCell} text-right`;
const numberCell = "px-4 py-3 text-right text-ink tabular-nums whitespace-nowrap";

async function OwnerNumbers() {
  const [t, locale] = await Promise.all([getTranslations("OwnerDashboardPage"), getLocale()]);

  let numbers: BusinessNumbers;
  try {
    numbers = await getBusinessNumbers(await createSupabaseServerClient({ writeCookies: false }));
  } catch (error) {
    if (!(error instanceof OwnerError)) throw error;
    console.error(error);
    return (
      <Notice tone="danger" title={t("errorTitle")}>
        {t("errorBody")}
      </Notice>
    );
  }

  const tiles = [
    { id: "revenue", label: t("tiles.revenue"), value: formatRupiah(numbers.revenueIdr, locale), hint: t("tiles.revenueHint") },
    { id: "paid", label: t("tiles.paidOrders"), value: String(numbers.paidOrders), hint: t("tiles.paidOrdersHint") },
    {
      id: "completed",
      label: t("tiles.completedJobs"),
      value: String(numbers.completedJobs),
      hint: t("tiles.completedJobsHint", { paid: numbers.paidOrders }),
    },
  ];
  const statuses = statusRows(numbers.byStatus);
  const totalOrders = statuses.reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <section aria-label={t("tiles.label")} className="grid gap-4 md:grid-cols-3">
        {tiles.map((tile) => (
          <div
            key={tile.id}
            role="group"
            aria-labelledby={`tile-${tile.id}`}
            className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-5"
          >
            <p id={`tile-${tile.id}`} className="text-sm font-medium text-ink-muted">
              {tile.label}
            </p>
            <p className="font-display text-3xl font-semibold tracking-display whitespace-nowrap text-ink tabular-nums">
              {tile.value}
            </p>
            <p className="text-sm text-ink-faint">{tile.hint}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TrendChart trend={numbers.trend} />

        <section aria-labelledby="owner-status" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 xl:p-6">
          <header className="flex flex-col gap-1">
            <h2 id="owner-status" className="font-display text-lg font-semibold text-ink">
              {t("status.title")}
            </h2>
            <p className="text-sm text-ink-muted">{t("status.description")}</p>
          </header>
          <p className="text-sm font-medium text-ink">{t("status.total", { count: totalOrders })}</p>
          <ul className="flex flex-col gap-4">
            {statuses.map((row) => (
              <li key={row.status} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink">{t(`status.${row.status}`)}</span>
                  <span className="whitespace-nowrap tabular-nums">
                    <span className="font-semibold text-ink">{row.count}</span>{" "}
                    <span className="text-ink-faint">{t("status.share", { percent: row.percent })}</span>
                  </span>
                </div>
                {/* One hue for every status: the bar shows the share, the words say which status. */}
                <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <span className="block h-full rounded-full bg-brand-600" style={{ width: `${row.percent}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="owner-partners" className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 id="owner-partners" className="font-display text-lg font-semibold text-ink">
            {t("partners.title")}
          </h2>
          <p className="text-sm text-ink-muted">{t("partners.description")}</p>
        </header>
        {numbers.agencies.length === 0 ? (
          <EmptyState icon={Building2} title={t("partners.emptyTitle")}>
            {t("partners.emptyBody")}
          </EmptyState>
        ) : (
          <div className="relative overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t("partners.title")}</caption>
              <thead className="bg-surface-sunken">
                <tr>
                  <th scope="col" className={headCell}>
                    {t("partners.name")}
                  </th>
                  <th scope="col" className={headCell}>
                    {t("partners.status")}
                  </th>
                  <th scope="col" className={numberHead}>
                    {t("partners.jobs")}
                  </th>
                  <th scope="col" className={numberHead}>
                    {t("partners.completed")}
                  </th>
                  <th scope="col" className={numberHead}>
                    {t("partners.revenue")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {numbers.agencies.map((agency) => (
                  <tr key={agency.id} className="transition-colors duration-150 ease-out-quart hover:bg-canvas">
                    <th scope="row" className="px-4 py-3 text-left font-semibold text-ink">
                      {agency.name}
                    </th>
                    <td className="px-4 py-3">
                      <AgencyStatusPill status={agency.status} label={t(`agencyStatus.${agency.status}`)} />
                    </td>
                    <td className={numberCell}>{agency.jobs}</td>
                    <td className={numberCell}>{agency.completed}</td>
                    <td className={`${numberCell} font-semibold`}>{formatRupiah(agency.revenueIdr, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
