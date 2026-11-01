import { ArrowLeft, CircleAlert, ClipboardList } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";
import { listMyOrders, type CustomerOrder } from "@/lib/booking/orders";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import type { Service, ServiceArea } from "@/lib/catalog/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseBookedOrderId, parseOpenedOrderId } from "./booking-query";
import { OrderConfirmation } from "./order-confirmation";
import { OrderList } from "./order-list";
import { cameBackFromPayment } from "./payment-query";

type SearchParams = Record<string, string | string[] | undefined>;

// The content of /orders for a signed-in customer, inside the page's role check. It lists the
// customer's orders, newest first (T12). Right after booking (/orders?booked=<order id>, where
// bookService sends the customer) it shows that order and what happens next (T9), with the payment
// (T10); Midtrans sends the customer back to the same address. An order opened from the list is
// /orders?order=<order id>, the same page without the claim that it was just made. Everything is read
// with the customer's own session through listMyOrders, which returns only their own orders and never
// the agency, so another customer's id in the address finds nothing and falls back to the list.
export async function OrdersContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const locale = await getLocale();
  const bookedId = parseBookedOrderId(params);
  const wantedId = bookedId ?? parseOpenedOrderId(params);

  let orders: CustomerOrder[];
  let services: Service[];
  let areas: ServiceArea[];
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    [orders, services, areas] = await Promise.all([listMyOrders(client), getCatalogServices(), getServiceAreas()]);
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return <OrdersUnavailable />;
  }

  // A service switched off since booking is no longer in the catalog; the order keeps its price.
  const serviceName = (order: CustomerOrder) =>
    services.find((candidate) => candidate.id === order.serviceId)?.name[locale];

  const order = orders.find((candidate) => candidate.id === wantedId);
  if (order) {
    const area = areas.find((candidate) => candidate.id === order.areaId);
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        <BackToList />
        <OrderConfirmation
          order={order}
          serviceName={serviceName(order)}
          areaName={area?.name[locale] ?? order.areaId}
          cameBackFromPayment={bookedId ? cameBackFromPayment(params) : false}
          variant={bookedId ? "booked" : "details"}
        />
      </div>
    );
  }
  if (orders.length === 0) return <NoOrdersYet />;
  return <OrderList orders={orders} serviceName={serviceName} />;
}

async function BackToList() {
  const t = await getTranslations("OrdersPage");
  return (
    <Link
      href="/orders"
      className="inline-flex min-h-touch w-fit items-center gap-2 rounded-full pr-3 text-sm font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:text-brand-800 hover:underline active:text-ink"
    >
      <ArrowLeft className="size-4.5 shrink-0" aria-hidden="true" />
      {t("backToList")}
    </Link>
  );
}

async function OrdersUnavailable() {
  const t = await getTranslations("OrderConfirmation");
  return (
    <EmptyState icon={CircleAlert} title={t("errorTitle")}>
      {t("errorBody")}
      <span className="mt-4 flex justify-center">
        {/* A plain link on purpose: a full page load reads the order again. */}
        <a
          href=""
          className="inline-flex min-h-touch items-center justify-center rounded-full border border-border-control bg-surface px-5 text-sm font-semibold text-ink transition-colors duration-150 ease-out-quart hover:bg-surface-sunken active:bg-brand-50"
        >
          {t("retry")}
        </a>
      </span>
    </EmptyState>
  );
}

async function NoOrdersYet() {
  const t = await getTranslations("OrdersPage");
  return (
    <EmptyState icon={ClipboardList} title={t("emptyTitle")}>
      {t("emptyBody")}
    </EmptyState>
  );
}
