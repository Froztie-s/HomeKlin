import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { AccountSlot } from "@/components/auth/account-slot";
import { Wordmark } from "@/components/brand/wordmark";
import { Link } from "@/i18n/navigation";
import { appNavigation } from "./app-navigation";
import { LanguageSwitch } from "./language-switch";
import type { AppNavKey } from "./navigation";
import { RoleBadge } from "./role-badge";
import { TopNav } from "./top-nav";

type AppHeaderProps = {
  nav: AppNavKey;
  /** For staff shells ("Petugas"), next to the wordmark. */
  roleLabel?: string;
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

// The customer and cleaner app bar. On phones a slim 56 px bar: the wordmark (home link) on the left,
// the language switch and the account corner on the right, and the sections stay in the bottom bar; it
// scrolls away so the small screen keeps its height. From 768 px it becomes the 64 px sticky top bar
// with the sections between the brand and the switch. The account corner reads the session, so it
// streams in behind <Suspense> while the rest of the bar stays prerendered.
export function AppHeader({ nav, roleLabel }: AppHeaderProps) {
  const t = useTranslations("AppShell");
  const home = appNavigation[nav].items[0];

  return (
    <header className="border-b border-border bg-surface md:sticky md:top-0 md:z-(--z-sticky)">
      <div className="mx-auto flex h-top-bar max-w-content items-center justify-between gap-3 px-safe md:h-16 md:gap-6 md:px-gutter-wide">
        <span className="flex min-w-0 items-center gap-2">
          <Link href={home.href} aria-label={t("homeLink")} className="inline-flex min-h-touch items-center rounded-full">
            <Wordmark />
          </Link>
          {roleLabel ? <RoleBadge label={roleLabel} /> : null}
        </span>
        <div className="flex items-center gap-2 md:gap-4">
          <TopNav nav={nav} />
          <LanguageSwitch />
          <div className={accountSlotPlacement[nav]}>
            <Suspense fallback={null}>
              <AccountSlot />
            </Suspense>
          </div>
        </div>
      </div>
    </header>
  );
}
