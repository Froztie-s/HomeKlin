import { ArrowRight, Check, ChevronRight, ClipboardList, History, Lock } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";
import type { CustomerOrder } from "@/lib/booking/orders";
import { formatJakartaTime } from "@/lib/catalog/slots-days";
import { flowAccentButton, flowCard, flowCardTitle, flowPageTitle, flowTextLink } from "./flow-styles";
import { initialsOf } from "./job-progress";
import { HelpCard } from "./order-details";
import { OrderList } from "./order-list";
import { getOrderWords } from "./order-status";
import { splitOrders } from "./orders-overview-data";

type OrdersOverviewProps = {
  orders: CustomerOrder[];
  serviceName: (order: CustomerOrder) => string | undefined;
  /** The signed-in customer: their name (empty for an account made by ordering) and email. */
  account: { name: string; email: string };
  now: Date;
};

// "Pesanan Anda" (D5, mocks Customer-Home and Phone-Home): the signed-in home, /home. Since 2026-11-20
// it holds only the orders not finished yet (rules in ./orders-overview-data.ts): a job in progress
// under "Sedang berlangsung", on a dark band with its Petugas HomeKlin and "Tonton langsung", then
// "Akan datang", the orders waiting for payment or for their time, the soonest first. The finished
// ones have their own page, /orders (./orders-history.tsx), linked under the list. Beside them the account (who is signed in, and how: with the email they ordered with), what happens to
// recordings, and the way to help. Everything is the customer's own (listMyOrders), never the agency.
export async function OrdersOverview({ orders, serviceName, account, now }: OrdersOverviewProps) {
  const locale = await getLocale();
  const [t, words] = await Promise.all([getTranslations("OrdersOverview"), getOrderWords(locale)]);
  const split = splitOrders(orders, now);
  const ongoingCount = split.live.length + split.upcoming.length;
  const firstName = account.name.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="flex flex-col gap-6 md:gap-7">
      <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className={flowPageTitle}>{t("title")}</h1>
          <p className="max-w-prose text-ink-muted md:text-body-lg">
            {firstName ? t("leadNamed", { name: firstName }) : t("lead")}
          </p>
        </div>
        <ButtonLink href="/services" variant="forest" size="lg" className="shrink-0">
          {t("bookAgain")}
        </ButtonLink>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          {split.live.length > 0 ? (
            <section aria-labelledby="sedang-berlangsung" className="flex flex-col gap-3">
              <h2 id="sedang-berlangsung" className={flowCardTitle}>
                {t("ongoingTitle")}
              </h2>
              {split.live.map((order) => (
                <article
                  key={order.id}
                  aria-labelledby={`berlangsung-${order.id}`}
                  className="on-dark-focus relative isolate overflow-hidden rounded-xl bg-primary-container p-6 text-on-primary md:p-8"
                >
                  <span aria-hidden="true" className="absolute -right-20 -bottom-36 -z-10 size-80 rounded-full bg-primary" />
                  <p className="inline-flex items-center gap-2 rounded-full bg-band px-3 py-1.5 text-sm text-lime">
                    <span className="size-2 rounded-full bg-mint-bright motion-safe:animate-breathe" aria-hidden="true" />
                    {t("livePill")}
                  </p>
                  <h3 id={`berlangsung-${order.id}`} className="mt-4 font-display text-title font-semibold md:text-3xl">
                    {words.service(serviceName(order))}
                  </h3>
                  <p className="mt-1 tabular-nums">{t("orderLine", { code: order.orderCode, arrival: words.arrival(order) })}</p>
                  {order.cleanerName ? (
                    <div className="mt-5 flex items-center gap-3">
                      <CleanerFace name={order.cleanerName} photoUrl={order.cleanerPhotoUrl} alt={t("photoAlt", { name: order.cleanerName })} />
                      <p className="flex min-w-0 flex-col">
                        <span className="font-semibold">{order.cleanerName}</span>
                        <span className="text-sm text-on-band-muted">
                          {order.checkedInAt ? t("cleanerCheckedIn", { time: formatJakartaTime(order.checkedInAt, locale) }) : t("cleanerRole")}
                        </span>
                      </p>
                    </div>
                  ) : null}
                  <p className="mt-4 flex items-start gap-2 text-sm text-on-band-muted">
                    <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{t("recordingLater")}</span>
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href={`/orders/live?order=${order.id}`} className={flowAccentButton}>
                      {t("watch")}
                      <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
                    </Link>
                    <Link
                      href={`/orders?order=${order.id}`}
                      className="inline-flex min-h-13 items-center justify-center rounded-full px-6 text-base font-semibold text-on-primary inset-ring-[1.5px] inset-ring-on-primary transition-colors duration-150 ease-out-quart hover:bg-primary active:bg-band"
                    >
                      {t("seeOrder")}
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          ) : null}
          {split.upcoming.length > 0 ? (
            <section aria-labelledby="akan-datang" className="flex flex-col gap-3">
              {/* "Akan datang" (user, 2026-11-17): says why these white cards differ from the dark
                  live card above; same heading style as "Sedang berlangsung". */}
              <h2 id="akan-datang" className={flowCardTitle}>
                {t("upcomingTitle")}
              </h2>
              <OrderList orders={split.upcoming} serviceName={serviceName} now={now} />
            </section>
          ) : null}
          {ongoingCount === 0 ? (
            <EmptyState tone="forest" icon={ClipboardList} title={orders.length === 0 ? t("emptyTitle") : t("ongoingEmptyTitle")}>
              {orders.length === 0 ? t("emptyBody") : t("ongoingEmptyBody")}
            </EmptyState>
          ) : null}
          {split.history.length > 0 ? (
            // The finished orders have their own page, /orders (2026-11-20); here only the way there.
            <Link
              href="/orders"
              className="group flex items-center gap-4 rounded-lg bg-card p-4 inset-ring-1 inset-ring-border transition-shadow duration-150 ease-out-quart hover:shadow-card-hover active:bg-sunken md:p-5"
            >
              <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lime-wash text-on-lime-wash">
                <History className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold text-ink">{t("historyLinkTitle")}</span>
                <span className="text-sm text-ink-muted">{t("historyLinkBody", { count: split.history.length })}</span>
              </span>
              <ChevronRight
                className="size-5 shrink-0 text-ink-muted transition-transform duration-150 ease-out-quart group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          ) : null}
        </div>

        <aside aria-label={t("asideLabel")} className="flex flex-col gap-4">
          <section aria-labelledby="akun-anda" className={flowCard}>
            <h2 id="akun-anda" className={flowCardTitle}>
              {t("accountTitle")}
            </h2>
            <div className="mt-4 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-lime-wash font-display text-base font-semibold text-on-lime-wash"
              >
                {initialsOf(account.name.trim() || account.email)}
              </span>
              <p className="flex min-w-0 flex-col">
                {account.name.trim() ? <span className="font-semibold text-ink">{account.name}</span> : null}
                <span className="text-sm break-all text-ink-muted">{account.email}</span>
              </p>
            </div>
            <p className="mt-4 text-sm text-ink-muted">{t("accountBody")}</p>
            <SignOutButton className="mt-4 w-fit" />
          </section>
          <section aria-labelledby="tentang-rekaman" className={flowCard}>
            <h2 id="tentang-rekaman" className={flowCardTitle}>
              {t("recordingTitle")}
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5 text-sm text-ink">
              {(["replay", "kept", "private"] as const).map((fact) => (
                <li key={fact} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-mint" strokeWidth={2.5} aria-hidden="true" />
                  <span>{t(`recordingFacts.${fact}`)}</span>
                </li>
              ))}
            </ul>
            <Link href="/orders/recording" className={`${flowTextLink} mt-3`}>
              {t("seeRecordings")}
            </Link>
          </section>
          <HelpCard />
        </aside>
      </div>
    </div>
  );
}

function CleanerFace({ name, photoUrl, alt }: { name: string; photoUrl: string | null; alt: string }) {
  if (!photoUrl) {
    return (
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lime-wash font-semibold text-on-lime-wash">
        {initialsOf(name)}
      </span>
    );
  }
  return (
    <Image
      src={photoUrl}
      width={88}
      height={88}
      alt={alt}
      sizes="44px"
      unoptimized={!photoUrl.startsWith("/")}
      className="size-11 shrink-0 rounded-full bg-lime-wash object-cover"
    />
  );
}

