import { Clock, UserRoundX } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { ClientMessages } from "@/i18n/client-messages";
import { getCurrentUser } from "@/lib/auth/dal";
import { roleHome, type AppRole } from "@/lib/auth/roles";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import type { Service, ServiceArea } from "@/lib/catalog/catalog";
import { resolveArea } from "@/lib/catalog/customer-filters";
import { groupSlotsByJakartaDay } from "@/lib/catalog/slots-days";
import { formatRupiah } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findFreeWindow, jakartaDayOf } from "./booking-query";
import { BookingUnavailable } from "./booking-unavailable";
import type { BookingDay } from "./booking-window-picker";
import { freeWindowDays, loadFreeSlots } from "./free-slots";
import { OrderForm, type OrderArea } from "./order-form";
import { parseOrderQuery } from "./order-query";
import { ServiceDuration } from "./service-duration";
import { ServiceVisual } from "./service-visual";
import { getSlotLabels } from "./slot-labels";

type SearchParams = Record<string, string | string[] | undefined>;

// The order page's content (T9b), at request time: it reads the address, who is signed in and the
// free windows. The address may name a service, an area and a window (/pesan?layanan=&area=&starts=);
// each is only a suggestion, checked here against the catalog and the free windows and again by the
// order actions on the server. The free windows of every served area are read at once (a handful of
// rows each), so changing the area on the form needs no new request. A signed-in staff user (cleaner,
// agency, admin) cannot order and is told so. Nothing here names who provides the cleaners
// (markdown/PRODUCT.md principle 6): the windows are times only.
export async function OrderContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = parseOrderQuery(await searchParams);
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  if (user && user.role !== "customer") return <StaffNotice role={user.role} />;

  const [t, labels] = await Promise.all([getTranslations("Booking"), getSlotLabels(locale)]);
  let areas: ServiceArea[];
  let services: Service[];
  try {
    [areas, services] = await Promise.all([getServiceAreas(), getCatalogServices()]);
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return <BookingUnavailable kind="error" backHref="/services" />;
  }
  const area = resolveArea(areas, query.areaId);
  if (!area || services.length === 0) return <BookingUnavailable kind="error" backHref="/services" />;

  const now = new Date();
  const slotsByArea = new Map(
    await Promise.all(
      areas.filter((candidate) => candidate.isServed).map(async (candidate) => [candidate.id, await loadFreeSlots(candidate.id)] as const),
    ),
  );
  const orderAreas: OrderArea[] = areas.map((candidate) => {
    const slots = slotsByArea.get(candidate.id);
    const days: BookingDay[] | null =
      slots === undefined
        ? []
        : slots === null
          ? null
          : groupSlotsByJakartaDay(slots, now).map((day) => ({
              date: day.date,
              label: labels.day(day),
              windows: day.windows.map((slot) => ({ startsAt: slot.startsAt, label: labels.window(slot) })),
            }));
    return { id: candidate.id, name: candidate.name[locale], served: candidate.isServed, days };
  });

  const service = services.find((candidate) => candidate.id === query.serviceId);
  const selected = findFreeWindow(slotsByArea.get(area.id) ?? [], query.startsAt);
  // The window in the address is gone (booked, or it never existed): say which one, plainly.
  const takenNotice =
    !selected && query.startsAt && area.isServed
      ? t("takenBody", { day: labels.day(jakartaDayOf(query.startsAt, now)), time: labels.time(query.startsAt) })
      : null;

  return (
    <ClientMessages namespaces={["Booking", "Order", "CodeEntry"]}>
      <OrderForm
        services={services.map((candidate) => ({
          id: candidate.id,
          name: candidate.name[locale],
          price: formatRupiah(candidate.priceIdr, locale),
        }))}
        summaries={Object.fromEntries(services.map((candidate) => [candidate.id, <ServiceSummary key={candidate.id} service={candidate} />]))}
        areas={orderAreas}
        initialServiceId={service?.id ?? null}
        serviceUnknown={Boolean(query.serviceId && !service)}
        initialAreaId={area.id}
        initialStartsAt={selected?.startsAt ?? null}
        takenNotice={takenNotice}
        lookAheadDays={freeWindowDays}
        customer={user ? { name: user.fullName.trim() || (await signedInEmail()) } : null}
      />
    </ClientMessages>
  );
}

/** The signed-in customer's email, for an account made by ordering (it has no name yet). */
async function signedInEmail(): Promise<string> {
  const supabase = await createSupabaseServerClient({ writeCookies: false });
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims.email;
  return typeof email === "string" ? email : "";
}

/** The chosen service at a glance: its picture, name and how long it takes. */
async function ServiceSummary({ service }: { service: Service }) {
  const locale = await getLocale();
  return (
    <div className="flex items-start gap-4">
      <ServiceVisual service={service} sizes="64px" className="size-16 shrink-0 rounded-md" iconClassName="size-6" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-base font-semibold text-ink">{service.name[locale]}</p>
        <p className="text-sm text-ink-muted">{service.description[locale]}</p>
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Clock className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
          <ServiceDuration minutes={service.durationMinutes} />
        </p>
      </div>
    </div>
  );
}

/** A signed-in cleaner, agency or admin: orders are made with a customer account. */
async function StaffNotice({ role }: { role: AppRole }) {
  const t = await getTranslations("Order");
  return (
    <EmptyState icon={UserRoundX} title={t("staffTitle")}>
      {t("staffBody")}
      <span className="mt-4 flex justify-center">
        <ButtonLink href={roleHome[role]}>{t("staffLink")}</ButtonLink>
      </span>
    </EmptyState>
  );
}
