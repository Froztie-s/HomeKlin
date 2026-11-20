import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { AccountMenuSlot } from "@/components/auth/account-menu-slot";
import { AccountSlot } from "@/components/auth/account-slot";
import { Wordmark } from "@/components/brand/wordmark";
import { Link } from "@/i18n/navigation";
import { appNavigation } from "./app-navigation";
import { LanguageSwitch } from "./language-switch";
import type { AppTone } from "./mobile-shell";
import type { AppNavKey } from "./navigation";
import { RoleBadge } from "./role-badge";
import { TopNav } from "./top-nav";

type AppHeaderProps = {
  nav: AppNavKey;
  /** For staff shells ("Petugas"), next to the wordmark. */
  roleLabel?: string;
  tone?: AppTone;
};

// Where the account corner ("Masuk", or the signed-in user's chip) shows, by the room the bar has.
// Customer: on phones the sections sit in the bottom bar, so there is room; between 768 and 1023 px
// the five sections fill the bar (22 px left at 768 px) and their "Akun" leads to the same place;
// from 1024 px it returns. Cleaner: on phones the role badge fills the bar, so the account page (the
// "Akun" tab) carries the name and sign-out; from 768 px the two sections leave room.
const accountSlotPlacement: Record<AppNavKey, string> = {
  customer: "flex md:hidden lg:flex",
  cleaner: "hidden md:flex",
};

// The bar's width follows the pages under it: the customer pages since D5 use the wider redesign
// column (the Main and Customer-* mocks, 1200 px), the cleaner app keeps its phone column.
const barWidth: Record<AppNavKey, string> = {
  customer: "max-w-dashboard",
  cleaner: "max-w-content",
};

// The customer and cleaner app bar. On phones a slim 56 px bar: the wordmark (home link) on the left,
// the language switch and the account corner on the right, and the sections stay in the bottom bar; it
// scrolls away so the small screen keeps its height. From 768 px it becomes the 64 px sticky top bar
// with the sections between the brand and the switch. The customer's "Akun" is a menu in the sections
// (account-menu.tsx), so a signed-in customer has no chip. (From 16 to 18 Nov 2026 the customer switch
// floated at the bottom-left of the page and covered content; it is back in the bar, UX audit item 3.)
// The forest tone (the cleaner app, D4, and the customer pages, D5) draws the bar straight on the
// cream page with no edge, the forest wordmark tile and the redesign's switch, chip and section pills.
// The account corner reads the session, so it streams in behind <Suspense> while the rest of the bar
// stays prerendered.
export function AppHeader({ nav, roleLabel, tone = "default" }: AppHeaderProps) {
  const t = useTranslations("AppShell");
  const home = appNavigation[nav].items[0];
  const forest = tone === "forest";
  const palette = forest ? "forest" : "evergreen";

  return (
    <header
      className={`md:sticky md:top-0 md:z-(--z-sticky) ${forest ? "bg-canvas md:border-b md:border-border" : "border-b border-border bg-surface"}`}
    >
      <div className={`mx-auto flex h-top-bar ${barWidth[nav]} items-center justify-between gap-3 px-safe md:h-16 md:gap-6 md:px-gutter-wide`}>
        <span className="flex min-w-0 items-center gap-2">
          <Link href={home.href} aria-label={t("homeLink")} className="inline-flex min-h-touch items-center rounded-full">
            <Wordmark palette={palette} />
          </Link>
          {roleLabel ? <RoleBadge label={roleLabel} /> : null}
        </span>
        <div className="flex items-center gap-2 md:gap-4">
          <TopNav
            nav={nav}
            tone={tone}
            account={nav === "customer" ? <AccountMenuSlot variant="top" tone={tone} /> : undefined}
          />
          <LanguageSwitch palette={palette} />
          <div className={accountSlotPlacement[nav]}>
            <Suspense fallback={null}>
              <AccountSlot palette={palette} signedIn={nav === "customer" ? "hidden" : "chip"} />
            </Suspense>
          </div>
        </div>
      </div>
    </header>
  );
}
