"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { appNavigation } from "./app-navigation";
import { isActivePath } from "./is-active-path";
import type { AppNavKey } from "./navigation";

type TopNavProps = {
  nav: AppNavKey;
};

// From tablet width up, the bottom bar's sections move into the app bar (app-header.tsx). Between
// 768 and 1023 px the icons step aside so the labels and the language switch share one row; from
// 1024 px they come back. The labels carry the meaning either way (the icons are decorative).
export function TopNav({ nav }: TopNavProps) {
  const t = useTranslations("AppNavigation");
  const pathname = usePathname();
  const { labelKey, items } = appNavigation[nav];

  return (
    <nav aria-label={t(labelKey)} className="hidden md:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActivePath(pathname, item) ? "page" : undefined}
                className="flex min-h-touch items-center gap-2 rounded-full px-3.5 text-sm font-medium whitespace-nowrap text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-surface-sunken hover:text-ink active:bg-brand-50 aria-[current=page]:bg-brand-100 aria-[current=page]:font-semibold aria-[current=page]:text-brand-800"
              >
                <Icon className="hidden size-4.5 lg:block" aria-hidden="true" />
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
