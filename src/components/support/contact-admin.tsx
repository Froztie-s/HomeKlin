import { Headset, LoaderCircle, LogIn } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { getOrderWords } from "@/components/customer/order-status";
import { ButtonLink } from "@/components/ui/button-link";
import { ClientMessages } from "@/i18n/client-messages";
import { getCurrentUser } from "@/lib/auth/dal";
import { roleHome } from "@/lib/auth/roles";
import { listMyOrders, type CustomerOrder } from "@/lib/booking/orders";
import { getCatalogServices } from "@/lib/catalog/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listMyTickets, type Ticket } from "@/lib/support/support";
import { MyTickets } from "./my-tickets";
import { TicketForm } from "./ticket-form";

type Emphasis = "strong" | "quiet";

const emphasisStyles: Record<Emphasis, string> = {
  // Nothing matched: the panel is the way on, so it stands out.
  strong: "border-brand-200 bg-brand-50",
  quiet: "border-border bg-surface shadow-card",
};

/** The "Masih butuh bantuan? Hubungi admin" panel; also the loading state's frame. */
export async function ContactPanel({ emphasis, children }: { emphasis: Emphasis; children: ReactNode }) {
  const t = await getTranslations("SupportPage");
  return (
    <section
      aria-labelledby="hubungi-admin"
      data-emphasis={emphasis}
      className={`flex flex-col gap-4 rounded-xl border p-4 md:p-6 ${emphasisStyles[emphasis]}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
            emphasis === "strong" ? "bg-brand-600 text-on-brand" : "bg-brand-50 text-brand-700"
          }`}
        >
          <Headset className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="hubungi-admin" className="font-display text-lg font-semibold text-ink">
            {t("contact.title")}
          </h2>
          <p className="max-w-prose text-sm text-ink-muted">{t("contact.body")}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** What fills the panel while the session is read. */
export async function ContactLoading() {
  const t = await getTranslations("SupportPage");
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-ink-faint">
      <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      {t("contact.loading")}
    </p>
  );
}

type ContactAdminProps = {
  /** The search words, carried over as the question. */
  query: string;
  emphasis: Emphasis;
};

// The signed-in part of /support (T20), at request time behind <Suspense>: it reads the session. A
// visitor is asked to sign in first (and comes back here); a signed-in customer gets the ticket form
// and, below the panel, their own tickets; staff are pointed to their own pages. The role decides what
// renders here, and openTicket checks it again on the server. Everything is read with the customer's
// own session, so row-level security returns only their own tickets and orders.
export async function ContactAdmin({ query, emphasis }: ContactAdminProps) {
  const [t, user] = await Promise.all([getTranslations("SupportPage"), getCurrentUser()]);

  if (!user) {
    return (
      <ContactPanel emphasis={emphasis}>
        <p className="max-w-prose text-base text-ink">{t("contact.signedOutBody")}</p>
        <ButtonLink href="/login?next=%2Fsupport" icon={LogIn} className="w-full sm:w-fit">
          {t("contact.signIn")}
        </ButtonLink>
      </ContactPanel>
    );
  }

  if (user.role !== "customer") {
    return (
      <ContactPanel emphasis="quiet">
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold text-ink">{t("contact.staffTitle")}</p>
          <p className="max-w-prose text-sm text-ink-muted">{t("contact.staffBody")}</p>
        </div>
        <ButtonLink href={user.role === "admin" ? "/admin/tickets" : roleHome[user.role]} variant="secondary" className="w-full sm:w-fit">
          {user.role === "admin" ? t("contact.adminLink") : t("contact.staffLink")}
        </ButtonLink>
      </ContactPanel>
    );
  }

  const locale = await getLocale();
  let tickets: Ticket[] | null;
  let orderOptions: { id: string; label: string }[] = [];
  try {
    const client = await createSupabaseServerClient({ writeCookies: false });
    const [ticketRows, orders, services, words] = await Promise.all([
      listMyTickets(client),
      listMyOrders(client),
      getCatalogServices(),
      getOrderWords(locale),
    ]);
    tickets = ticketRows;
    const serviceName = (order: CustomerOrder) => services.find((service) => service.id === order.serviceId)?.name[locale];
    orderOptions = orders.slice(0, 20).map((order) => ({
      id: order.id,
      label: `${words.service(serviceName(order))}, ${words.arrival(order)}`,
    }));
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    tickets = null;
  }

  return (
    <>
      <ContactPanel emphasis={emphasis}>
        <ClientMessages namespaces={["SupportTicketForm"]}>
          {/* Keyed by the search, so a new search carries its words over into the question. */}
          <TicketForm key={query} initialQuestion={query} orders={orderOptions} />
        </ClientMessages>
      </ContactPanel>
      <MyTickets tickets={tickets} />
    </>
  );
}
