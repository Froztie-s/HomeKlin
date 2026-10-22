import { useTranslations } from "next-intl";
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

// The customer and cleaner app bar. On phones a slim 56 px bar: the wordmark (home link) on the left,
// the language switch on the right, and the sections stay in the bottom bar; it scrolls away so the
// small screen keeps its height. From 768 px it becomes the 64 px sticky top bar with the sections
// between the brand and the switch.
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
        <div className="flex items-center gap-4">
          <TopNav nav={nav} />
          <LanguageSwitch />
        </div>
      </div>
    </header>
  );
}
