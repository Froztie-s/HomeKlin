import { CircleAlert, ClipboardList } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { listMyOrders, type CustomerOrder } from "@/lib/booking/orders";
import { getCatalogServices, getServiceAreas } from "@/lib/catalog/cached";
import type { Service, ServiceArea } from "@/lib/catalog/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseBookedOrderId } from "./booking-query";
import { OrderConfirmation } from "./order-confirmation";
import { cameBackFromPayment } from "./payment-query";

type SearchParams = Record<string, string | string[] | undefined>;

// The content of /orders for a signed-in customer, inside the page's role check. Right after booking
// (/orders?booked=<order id>, where bookService sends the customer) it shows that order and what
// happens next (T9), with the payment (T10); Midtrans sends the customer back to the same address.
// The order is read with the customer's own session through listMyOrders, which returns only their
// own orders and never the agency, so another customer's id in the address finds nothing. Otherwise
// the page says what will appear here; the full order list comes with T12.
export async function OrdersContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const bookedId = parseBookedOrderId(params);
  if (bookedId) {
    const confirmation = await bookedOrder(bookedId, cameBackFromPayment(params));
    if (confirmation) return confirmation;
  }
  return <NoOrdersYet />;
}

/** The confirmation of one of the customer's orders, or null when they have no order with that id. */
async function bookedOrder(id: string, returned: boolean) {
  const locale = await getLocale();
  let order: CustomerOrder | undefined;
  let services: Service[] = [];
  let areas: ServiceArea[] = [];
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    [order, services, areas] = await Promise.all([
      listMyOrders(client).then((orders) => orders.find((candidate) => candidate.id === id)),
      getCatalogServices(),
      getServiceAreas(),
    ]);
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
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
  if (!order) return null;
  // A service switched off since booking is no longer in the catalog; the order keeps its price.
  const service = services.find((candidate) => candidate.id === order.serviceId);
  const area = areas.find((candidate) => candidate.id === order.areaId);
  return (
    <OrderConfirmation
      order={order}
      serviceName={service?.name[locale]}
      areaName={area?.name[locale] ?? order.areaId}
      cameBackFromPayment={returned}
    />
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
