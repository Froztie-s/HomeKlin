"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { bookingBack, bookingStepOf, flowFallback } from "@/components/customer/booking-flow";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { currentFlowMemory } from "./flow-memory";

/** Where the link leads without JavaScript (or opened in a new tab): the plain way back of each step. */
const plainHref = { 1: flowFallback, 2: "/services", 3: "/home" } as const;

// "Kembali" in the booking flow's header (booking-shell.tsx). Step 2 goes to step 1 with the choice
// (what was typed is kept in the tab, src/components/customer/order-draft.ts); step 3 goes to the
// customer home, where the placed order waits with its payment (/orders is the history since 2026-11-20); step 1 goes back to where the
// customer came from (src/components/customer/booking-flow.ts, bookingBack). It is a real link with a
// plain address, so it works without JavaScript and opens in a new tab; a plain click reads the current
// address (step 2 keeps its choice there) and how the customer came in, then goes there. A 44 px
// target with the icon and the word; hover, pressed and the forest theme's focus ring.
export function BookingBackLink() {
  const t = useTranslations("BookingHeader");
  const pathname = usePathname();
  const router = useRouter();
  const step = bookingStepOf(pathname) ?? 1;

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    // A click with a modifier key opens the plain address in a new tab or window, as any link does.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    const action = bookingBack(step, window.location.search, currentFlowMemory());
    if (action.kind === "history") router.back();
    else router.push(action.href);
  }

  return (
    <Link
      href={plainHref[step]}
      onClick={goBack}
      prefetch={false}
      className="-ml-3 inline-flex min-h-touch items-center gap-2 rounded-full px-3 text-sm font-semibold text-ink transition-[background-color,transform] duration-150 ease-out-quart hover:bg-sunken active:scale-[0.98] active:bg-lime-wash motion-reduce:active:scale-100"
    >
      <ArrowLeft className="size-5 shrink-0" aria-hidden="true" />
      {step === 3 ? t("toOrders") : t("back")}
    </Link>
  );
}
