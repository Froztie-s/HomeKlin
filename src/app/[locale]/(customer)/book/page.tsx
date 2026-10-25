import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { orderHrefFromBook } from "@/components/customer/order-query";
import { redirect } from "@/i18n/navigation";

// The old booking address (T9), /book?service=&area=&starts=, leads to the order page (T9b) with the
// same choice: /pesan?layanan=&area=&starts=, in the same language. /book is still a customer section
// in src/lib/auth/roles.ts, so the page keeps its role check (tests/protected-pages.test.ts) until that
// entry goes; a visitor is sent to sign in first and comes back here.
export default function BookPage({ searchParams }: PageProps<"/[locale]/book">) {
  return (
    <Suspense fallback={<GateFallback />}>
      <RoleGate roles={["customer"]}>
        <ToOrderPage searchParams={searchParams} />
      </RoleGate>
    </Suspense>
  );
}

async function ToOrderPage({ searchParams }: { searchParams: PageProps<"/[locale]/book">["searchParams"] }): Promise<null> {
  const [params, locale] = await Promise.all([searchParams, getLocale()]);
  return redirect({ href: orderHrefFromBook(params), locale });
}
