import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import { GateFallback } from "@/components/auth/gate-fallback";
import { RoleGate } from "@/components/auth/role-gate";
import { orderHrefFromBook } from "@/components/customer/order-query";
import { redirect } from "@/i18n/navigation";

// The old booking address (T9), /book?service=&area=&starts=, leads to the order page (T9b) with the
// same choice: /pesan?layanan=&area=&starts=, in the same language. Customers only, like /pesan
// (2026-11-20). The address is read at request time, so the redirect sits behind <Suspense>.
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
