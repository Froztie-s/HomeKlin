"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { backOfficeNavigation } from "./back-office-navigation";
import { isActivePath } from "./is-active-path";
import type { BackOfficeNavKey } from "./navigation";

type SideNavListProps = {
  nav: BackOfficeNavKey;
  /** Called when a link starts a client-side navigation (the narrow-screen menu closes itself). */
  onNavigate?: () => void;
};

// The back-office sections, used by the desktop sidebar and by the narrow-screen menu.
export function SideNavList({ nav, onNavigate }: SideNavListProps) {
  const t = useTranslations("BackOfficeNavigation");
  const pathname = usePathname();
  const { labelKey, items } = backOfficeNavigation[nav];

  return (
    <nav aria-label={t(labelKey)}>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onNavigate={onNavigate}
                aria-current={isActivePath(pathname, item) ? "page" : undefined}
                className="group flex min-h-touch items-center gap-3 rounded-full px-4 text-sm font-medium text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-surface-sunken hover:text-ink active:bg-brand-50 aria-[current=page]:bg-brand-100 aria-[current=page]:font-semibold aria-[current=page]:text-brand-800"
              >
                <Icon
                  className="size-4.5 shrink-0 text-ink-faint transition-colors duration-150 group-hover:text-ink-muted group-aria-[current=page]:text-brand-700"
                  aria-hidden="true"
                />
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
