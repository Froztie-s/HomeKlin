import { ArrowLeft, CircleAlert, CircleCheck, VideoOff } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";
import { listMyOrders, type CustomerOrder } from "@/lib/booking/orders";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseOpenedOrderId } from "./booking-query";
import { OrderLive } from "./order-live";

type SearchParams = Record<string, string | string[] | undefined>;

// The content of /orders/live?order=<order id> for a signed-in customer (T23): the live view of one of
// their own jobs, on a page of its own, which "Tonton langsung" links can point to. The order is looked
// up among the customer's own orders (listMyOrders, with their own session), so another customer's id,
// a made-up one, an unpaid order or a missing id all get the same "Siaran tidak tersedia", with nothing
// from the order and no link to any video. A finished job says so and points to its recording; a paid
// job not yet streaming says the cleaner has not started (./order-live.tsx, which asks the server again).
export async function LiveContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const orderId = parseOpenedOrderId(await searchParams);

  let orders: CustomerOrder[];
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    orders = await listMyOrders(client);
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return <LiveError />;
  }

  const order = orders.find((candidate) => candidate.id === orderId);
  if (!order || order.status !== "paid") return <LiveRefused />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
      <BackToOrder orderId={order.id} />
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card md:p-6">
        {order.completedAt ? <JobFinished orderId={order.id} /> : <OrderLive orderId={order.id} variant="page" />}
      </div>
    </div>
  );
}

async function BackToOrder({ orderId }: { orderId: string }) {
  const t = await getTranslations("LiveStream");
  return (
    <Link
      href={`/orders?order=${orderId}`}
      className="inline-flex min-h-touch w-fit items-center gap-2 rounded-full pr-3 text-sm font-semibold text-brand-700 transition-colors duration-150 ease-out-quart hover:text-brand-800 hover:underline active:text-ink"
    >
      <ArrowLeft className="size-4.5 shrink-0" aria-hidden="true" />
      {t("backToOrder")}
    </Link>
  );
}

async function JobFinished({ orderId }: { orderId: string }) {
  const t = await getTranslations("LiveStream");
  return (
    <div className="flex flex-col items-start gap-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-surface text-success">
          <CircleCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-display text-lg font-semibold text-ink">{t("completedTitle")}</h2>
          <p className="text-sm text-ink-muted">{t("completedBody")}</p>
        </div>
      </div>
      <ButtonLink href={`/orders?order=${orderId}#recording`}>{t("seeRecording")}</ButtonLink>
    </div>
  );
}

async function LiveRefused() {
  const t = await getTranslations("LiveStream");
  return (
    <EmptyState icon={VideoOff} title={t("unavailableTitle")}>
      {t("unavailableBody")}
      <span className="mt-4 flex justify-center">
        <ButtonLink href="/orders" variant="secondary">
          {t("toOrders")}
        </ButtonLink>
      </span>
    </EmptyState>
  );
}

async function LiveError() {
  const t = await getTranslations("LiveStream");
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
