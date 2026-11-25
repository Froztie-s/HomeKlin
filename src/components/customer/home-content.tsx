import { ArrowRight, ChevronRight } from "lucide-react";
import Form from "next/form";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import { defaultAreaId } from "@/lib/catalog/customer-filters";
import { AreaPicker } from "./area-picker";
import { flowCard, flowCardTitle, flowPageTitle, flowPrimaryButton, flowTextLink } from "./flow-styles";
import { OrdersContentUnavailable, readCustomerOrders } from "./orders-content";
import { OrdersOverview } from "./orders-overview";
import { ServiceRow } from "./service-row";

// The customer app home, /home (D5, mocks Customer-Home and Phone-Home). A signed-in customer sees
// "Pesanan Anda": a job in progress first, then the orders still to come (the finished ones are on /orders), their account and help, from their
// own session (listMyOrders, never the agency). Anyone else (a visitor, or staff, who cannot order)
// sees where to start: the area, which leads to step 1 (/services?area=...), and HomeKlin's services
// with their one full price. It reads the session, so it renders inside the page's <Suspense>.
export async function HomeContent() {
  const user = await getCurrentUser();
  if (user?.role === "customer") {
    const read = await readCustomerOrders();
    if (!read) return <OrdersContentUnavailable />;
    const locale = await getLocale();
    const now = new Date();
    return (
      <OrdersOverview
        orders={read.orders}
        serviceName={(order) => read.services.find((service) => service.id === order.serviceId)?.name[locale]}
        account={read.account}
        now={now}
      />
    );
  }
  return <GuestHome />;
}

async function GuestHome() {
  const [t, areas, services, locale] = await Promise.all([
    getTranslations("HomePage"),
    getServiceAreas(),
    getCatalogServices(),
    getLocale(),
  ]);
  return (
    <div className="flex flex-col gap-6 md:gap-7">
      <header className="flex flex-col gap-2">
        <h1 className={flowPageTitle}>{t("title")}</h1>
        <p className="max-w-prose text-ink-muted md:text-body-lg">{t("lead")}</p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        {/* Choosing an area leads to step 1 there. A button sends it (choosing in the list alone never
            leaves the page); next/form makes it a client-side navigation, a plain GET form without JS. */}
        <Form action={getPathname({ href: "/services", locale })} className={`${flowCard} flex flex-col gap-4`}>
          <h2 className={flowCardTitle}>{t("areaTitle")}</h2>
          <AreaPicker areas={areas} value={defaultAreaId} layout="stacked" />
          <button type="submit" className={flowPrimaryButton}>
            {t("areaSubmit")}
            <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
          </button>
        </Form>
        <section aria-labelledby="home-services-title" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="home-services-title" className={flowCardTitle}>
              {t("services")}
            </h2>
            <Link href="/services" className={flowTextLink}>
              {t("seeAll")}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-lg bg-card">
            {services.map((service) => (
              <li key={service.id}>
                <ServiceRow service={service} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
