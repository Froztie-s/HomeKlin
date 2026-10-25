import { CircleAlert, MapPinOff, SearchX } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { getPathname, Link } from "@/i18n/navigation";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import type { CatalogFilters, Service, ServiceArea } from "@/lib/catalog/catalog";
import { catalogQuery, defaultAreaId, resolveArea } from "@/lib/catalog/customer-filters";
import { parseCatalogFilters } from "@/lib/validation/catalog";
import { AreaPicker } from "./area-picker";
import { bookingHref } from "./booking-query";
import { loadFreeSlots } from "./free-slots";
import { CatalogForm } from "./catalog-form";
import { CatalogSearch, CatalogTypeFilter } from "./catalog-filters";
import { FreeWindows, FreeWindowsSkeleton } from "./free-windows";
import { ServiceCard } from "./service-card";

type SearchParams = Record<string, string | string[] | undefined>;

const areaLink =
  "inline-flex min-h-touch items-center rounded-full border border-border-control bg-surface px-4 text-sm font-semibold text-ink transition-[background-color,border-color,transform] duration-150 ease-out-quart hover:border-brand-600 hover:bg-brand-50 active:scale-[0.98] active:bg-brand-100";

/** A link inside the catalog with the given filters, e.g. /services?area=jakarta-timur (Link adds /en). */
const catalogHref = (filters: CatalogFilters) => `/services${catalogQuery(filters)}`;

// The catalog part of /services (T8): the filters from the address, HomeKlin's services and the free
// slots of the chosen area. It reads the address, so it renders at request time inside the page's
// <Suspense>; the services and areas come from the cache (src/lib/catalog/cached.ts), the free slots
// fresh (FreeWindows). Nothing here names who provides the cleaners (markdown/PRODUCT.md principle 6).
export async function ServiceCatalog({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseCatalogFilters(await searchParams);
  const [locale, t, tFilters, tWindows] = await Promise.all([
    getLocale(),
    getTranslations("CatalogResults"),
    getTranslations("CatalogFilters"),
    getTranslations("FreeWindows"),
  ]);
  const action = getPathname({ href: "/services", locale });

  let areas: ServiceArea[];
  let services: Service[];
  try {
    [areas, services] = await Promise.all([
      getServiceAreas(),
      getCatalogServices({ category: filters.category, query: filters.query }),
    ]);
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return <CatalogError retryHref={`${action}${catalogQuery(filters)}`} />;
  }

  const area = resolveArea(areas, filters.areaId);
  if (!area) return <CatalogError retryHref={`${action}${catalogQuery(filters)}`} />;
  // "Pesan" on each card opens the booking page in the area's earliest free window (read once per
  // request, shared with the windows panel). No free window, or none readable: no booking button.
  const earliest = area.isServed ? ((await loadFreeSlots(area.id))?.[0] ?? null) : null;
  const bookHrefFor = (service: Service) =>
    earliest ? bookingHref({ serviceId: service.id, areaId: area.id, startsAt: earliest.startsAt }) : undefined;
  const areaName = area.name[locale];
  // Links name the area unless it is the default, so the default address stays plain (as the form does).
  const areaId = area.id === defaultAreaId ? undefined : area.id;

  const filterFields = area.isServed ? (
    <>
      <section
        aria-labelledby="jadwal-kosong"
        className="rounded-xl border border-border bg-surface p-4 shadow-card md:grid md:grid-cols-[minmax(0,17rem)_1fr] md:gap-8 md:p-6"
      >
        <AreaPicker areas={areas} value={area.id} layout="stacked" />
        <div className="mt-4 border-t border-border pt-4 md:mt-0 md:border-t-0 md:border-l md:pt-0 md:pl-8">
          <h2 id="jadwal-kosong" className="font-display text-lg font-semibold text-ink">
            {tWindows("title", { area: areaName })}
          </h2>
          <div className="mt-3">
            {/* Keyed by area: a new area shows the loading state while its free slots arrive. */}
            <Suspense key={area.id} fallback={<FreeWindowsSkeleton label={tWindows("loading")} />}>
              <FreeWindows areaId={area.id} areaName={areaName} />
            </Suspense>
          </div>
        </div>
      </section>
      <div className="flex flex-col gap-4">
        <div className="md:max-w-md">
          <CatalogSearch query={filters.query} />
        </div>
        <CatalogTypeFilter current={filters.category} />
      </div>
    </>
  ) : (
    <>
      <div className="rounded-xl border border-border bg-surface p-4 shadow-card md:p-6">
        <div className="md:max-w-68">
          <AreaPicker areas={areas} value={area.id} layout="stacked" />
        </div>
      </div>
      {/* No search or type filter where nothing can be booked; a new area keeps them. */}
      <input type="hidden" name="type" value={filters.category ?? ""} />
      <input type="hidden" name="q" value={filters.query ?? ""} />
    </>
  );

  return (
    <CatalogForm action={action} defaultArea={defaultAreaId} pendingLabel={tFilters("pending")} filters={filterFields}>
      {area.isServed ? (
        <section aria-labelledby="daftar-harga">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="daftar-harga" className="font-display text-xl font-semibold text-ink">
              {t("title")}
            </h2>
            <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-muted">
              <span>
                {filters.query
                  ? t("countForQuery", { count: services.length, query: filters.query })
                  : t("count", { count: services.length })}
              </span>
              {filters.query ? (
                <Link
                  href={catalogHref({ areaId, category: filters.category })}
                  scroll={false}
                  className="-mx-2 inline-flex min-h-touch items-center rounded-full px-2 font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-800 active:bg-brand-100"
                >
                  {t("clearSearch")}
                </Link>
              ) : null}
            </p>
          </div>
          {services.length > 0 ? (
            <ul aria-labelledby="daftar-harga" className="mt-4 grid gap-4 md:grid-cols-2 md:gap-5">
              {services.map((service) => (
                <li key={service.id}>
                  <ServiceCard service={service} bookHref={bookHrefFor(service)} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4">
              <EmptyState icon={SearchX} title={t("noMatchTitle")}>
                {t("noMatchBody")}
                <span className="mt-4 flex justify-center">
                  <Link href={catalogHref({ areaId })} scroll={false} className={areaLink}>
                    {t("showAll")}
                  </Link>
                </span>
              </EmptyState>
            </div>
          )}
        </section>
      ) : (
        <div className="flex flex-col gap-5">
          <EmptyState icon={MapPinOff} title={t("unservedTitle", { area: areaName })}>
            {t("unservedBody")}
          </EmptyState>
          <div>
            <h3 id="area-dilayani" className="text-sm font-medium text-ink-muted">
              {t("servedAreas")}
            </h3>
            <ul aria-labelledby="area-dilayani" className="mt-2 flex flex-wrap gap-2">
              {areas
                .filter((other) => other.isServed)
                .map((other) => (
                  <li key={other.id}>
                    <Link
                      href={catalogHref({
                        areaId: other.id === defaultAreaId ? undefined : other.id,
                        category: filters.category,
                        query: filters.query,
                      })}
                      scroll={false}
                      className={areaLink}
                    >
                      {other.name[locale]}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}
    </CatalogForm>
  );
}

/** When the catalog cannot be read: say so, and offer a full reload of the same address. */
async function CatalogError({ retryHref }: { retryHref: string }) {
  const t = await getTranslations("CatalogResults");
  return (
    <EmptyState icon={CircleAlert} title={t("errorTitle")}>
      {t("errorBody")}
      <span className="mt-4 flex justify-center">
        {/* A plain link on purpose: a full page load reads the catalog again. */}
        <a href={retryHref} className={areaLink}>
          {t("retry")}
        </a>
      </span>
    </EmptyState>
  );
}
