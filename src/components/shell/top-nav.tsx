"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { isActivePath } from "./is-active-path";
import { appNavigation } from "./app-navigation";
import type { AppNavKey } from "./navigation";
import { RoleBadge } from "./role-badge";

type TopNavProps = {
  nav: AppNavKey;
  roleLabel?: string;
};

const copy = { home: "HomeKlin, ke beranda" };

// From tablet width up, the bottom bar's sections move into this top bar.
export function TopNav({ nav, roleLabel }: TopNavProps) {
  const pathname = usePathname();
  const { label, items } = appNavigation[nav];
  const home = items[0];

  return (
    <header className="sticky top-0 z-(--z-sticky) hidden border-b border-border bg-surface md:block">
      <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-6 px-gutter-wide">
        <span className="flex items-center gap-2">
          <Link href={home.href} aria-label={copy.home} className="inline-flex min-h-touch items-center rounded-full">
            <Wordmark />
          </Link>
          {roleLabel ? <RoleBadge label={roleLabel} /> : null}
        </span>
        <nav aria-label={label}>
          <ul className="flex items-center gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActivePath(pathname, item) ? "page" : undefined}
                    className="flex min-h-touch items-center gap-2 rounded-full px-3.5 text-sm font-medium text-ink-muted transition-colors duration-150 ease-out-quart hover:bg-surface-sunken hover:text-ink active:bg-brand-50 aria-[current=page]:bg-brand-100 aria-[current=page]:font-semibold aria-[current=page]:text-brand-800"
                  >
                    <Icon className="size-4.5" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
