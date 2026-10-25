import { Clock, MapPin } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ClientMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import type { Service, ServiceArea } from "@/lib/catalog/catalog";
import { catalogQuery, defaultAreaId } from "@/lib/catalog/customer-filters";
import { groupSlotsByJakartaDay } from "@/lib/catalog/slots-days";
import { formatRupiah } from "@/lib/format";
import { BookingForm, type BookingDay } from "./booking-form";
import { findFreeWindow, jakartaDayOf, parseBookingQuery } from "./booking-query";
import { BookingUnavailable } from "./booking-unavailable";
import { freeWindowDays, loadFreeSlots } from "./free-slots";
import { ServiceDuration } from "./service-duration";
import { ServiceVisual } from "./service-visual";
import { getSlotLabels } from "./slot-labels";

type SearchParams = Record<string, string | string[] | undefined>;

/** The services list of an area ("/services?area=jakarta-barat"; the default area needs no ?area=). */
const servicesHrefFor = (areaId?: string) =>
  `/services${catalogQuery({ areaId: areaId === defaultAreaId ? undefined : areaId })}`;

// The booking page's content (T9), rendered for a signed-in customer inside the page's role check,
// at request time (it reads the address and the free windows). The address names a service, an area
// and a window (/book?service=&area=&starts=, from "Pesan" on /services). This checks them against
// the catalog and the area's free windows of the next two weeks, and shows either the booking form or
// a clear state with the way back: a service that cannot be booked, an area that is not served, an
// area with every window taken, or a read error. A window that is no longer free is not a dead end:
// the form opens with the area's other free windows to choose from.
// The form posts to bookService (src/lib/booking/actions.ts), which checks everything again.
// Nothing here names who provides the cleaners (markdown/PRODUCT.md principle 6).
export async function BookingContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = parseBookingQuery(await searchParams);
  const locale = await getLocale();
  const [t, labels] = await Promise.all([getTranslations("Booking"), getSlotLabels(locale)]);

  let areas: ServiceArea[];
  let services: Service[];
  try {
    [areas, services] = await Promise.all([getServiceAreas(), getCatalogServices()]);
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return <BookingUnavailable kind="error" backHref={servicesHrefFor(query.areaId)} />;
  }

  const area = areas.find((candidate) => candidate.id === query.areaId && candidate.isServed);
  const backHref = servicesHrefFor(area?.id);
  const service = services.find((candidate) => candidate.id === query.serviceId);
  if (!service) return <BookingUnavailable kind="service" backHref={backHref} />;
  if (!area) return <BookingUnavailable kind="area" backHref={backHref} />;

  const areaName = area.name[locale];
  const slots = await loadFreeSlots(area.id);
  if (!slots) return <BookingUnavailable kind="error" backHref={backHref} />;
  if (slots.length === 0) {
    return <BookingUnavailable kind="full" backHref={backHref} areaName={areaName} days={freeWindowDays} />;
  }

  const now = new Date();
  const days: BookingDay[] = groupSlotsByJakartaDay(slots, now).map((day) => ({
    date: day.date,
    label: labels.day(day),
    windows: day.windows.map((slot) => ({ startsAt: slot.startsAt, label: labels.window(slot) })),
  }));
  const selected = findFreeWindow(slots, query.startsAt);
  // The window in the address is gone (booked, or it never existed): say which one, plainly.
  const takenNotice =
    !selected && query.startsAt
      ? t("takenBody", { day: labels.day(jakartaDayOf(query.startsAt, now)), time: labels.time(query.startsAt) })
      : null;
  const price = formatRupiah(service.priceIdr, locale);

  return (
    <ClientMessages namespaces={["Booking"]}>
      <BookingForm
        serviceId={service.id}
        serviceName={service.name[locale]}
        areaId={area.id}
        areaName={areaName}
        days={days}
        initialStartsAt={selected?.startsAt ?? null}
        takenNotice={takenNotice}
        servicesHref={backHref}
        price={price}
        summary={
          <section
            aria-labelledby="booking-service-title"
            className="rounded-xl border border-border bg-surface p-4 shadow-card md:p-5"
          >
            <h2 id="booking-service-title" className="font-display text-lg font-semibold text-ink">
              {t("serviceTitle")}
            </h2>
            <div className="mt-3 flex items-start gap-4">
              <ServiceVisual
                service={service}
                sizes="64px"
                className="size-16 shrink-0 rounded-md"
                iconClassName="size-6"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-base font-semibold text-ink">{service.name[locale]}</p>
                <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                  <Clock className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                  <ServiceDuration minutes={service.durationMinutes} />
                </p>
              </div>
            </div>
            <dl className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-muted">{t("areaLabel")}</dt>
                <dd className="flex items-center gap-1.5 font-medium text-ink">
                  <MapPin className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
                  {areaName}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-muted">{t("priceLabel")}</dt>
                <dd className="font-display text-xl font-semibold whitespace-nowrap text-ink tabular-nums">{price}</dd>
              </div>
            </dl>
            <Link
              href={backHref}
              className="-mx-2 mt-2 inline-flex min-h-touch items-center rounded-full px-2 text-sm font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:bg-brand-50 hover:text-brand-800 active:bg-brand-100"
            >
              {t("changeService")}
            </Link>
          </section>
        }
      />
    </ClientMessages>
  );
}
